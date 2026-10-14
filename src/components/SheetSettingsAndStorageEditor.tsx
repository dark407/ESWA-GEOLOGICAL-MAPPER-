import React, { useMemo, useRef, useState } from 'react';
import {
  EngineeringSheetConfig,
  SavedProjectRecord,
  SheetAdaptiveScaleMode,
  SheetEngineeringBlockId,
  SheetLogoPosition,
  TunnelSettings,
} from '../types/tunnel';
import {
  createDefaultEngineeringSheetConfig,
  loadSavedEngineeringSheetConfig,
  saveEngineeringSheetConfigToStorage,
} from '../engine/sheetLayoutEngine';
import {
  exportProjectHierarchyRegisterToCSV,
  generateSampleEngineeringLogoDataUrl,
  groupSavedProjectsByHierarchy,
  parseNumericChainageMeters,
} from '../engine/projectMemoryEngine';
import {
  ArrowDown,
  ArrowUp,
  Building2,
  CheckCircle2,
  Database,
  Download,
  FileSpreadsheet,
  FolderOpen,
  Image as ImageIcon,
  LayoutTemplate,
  Plus,
  RotateCcw,
  Save,
  Sliders,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';

interface SheetSettingsAndStorageEditorProps {
  settings: TunnelSettings;
  onUpdateSettings: React.Dispatch<React.SetStateAction<TunnelSettings>>;
  savedProjects: SavedProjectRecord[];
  onSaveCurrentProject: () => void;
  onLoadProjectRecord?: (record: SavedProjectRecord) => void;
  onDeleteProjectRecord?: (id: string) => void;
  onCreateNextChainageSection?: () => void;
  compactDrawerMode?: boolean;
}

const BLOCK_LABELS: Record<SheetEngineeringBlockId, { title: string; subtitle: string }> = {
  ORIENTATION_POLAR: {
    title: 'Polar Overbreak / Stereonet Diagram',
    subtitle: 'Cross-section radial deviation polar plot or stereographic pole net',
  },
  LEGEND_SUMMARY: {
    title: 'Engineering Legend & Volume Formulas',
    subtitle: 'Hatch patterns, control point symbols & prismoidal formulas',
  },
  DATA_TABLE: {
    title: 'Regional Overbreak / Discontinuity Table',
    subtitle: 'Adaptive zone-by-zone overbreak/undercut breakdown or joint sets',
  },
  Q_INDEX_AND_NOTES: {
    title: 'Quantity Summary, Volumes & Classification',
    subtitle: 'Design vs As-Built quantities, section volumes, RMR/Q-System & signatures',
  },
};

export const SheetSettingsAndStorageEditor: React.FC<SheetSettingsAndStorageEditorProps> = ({
  settings,
  onUpdateSettings,
  savedProjects,
  onSaveCurrentProject,
  onLoadProjectRecord,
  onDeleteProjectRecord,
  onCreateNextChainageSection,
  compactDrawerMode = false,
}) => {
  const [subSection, setSubSection] = useState<
    'project_and_logos' | 'layout_and_placement' | 'chainage_storage'
  >('project_and_logos');

  const clientLogoInputRef = useRef<HTMLInputElement | null>(null);
  const contractorLogoInputRef = useRef<HTMLInputElement | null>(null);
  const consultantLogoInputRef = useRef<HTMLInputElement | null>(null);

  const sheetConfig: EngineeringSheetConfig = useMemo(
    () => loadSavedEngineeringSheetConfig(settings),
    [settings]
  );

  const updateSheetConfig = (
    updater: (prev: EngineeringSheetConfig) => EngineeringSheetConfig
  ) => {
    onUpdateSettings((prevSettings) => {
      const currentCfg = loadSavedEngineeringSheetConfig(prevSettings);
      const nextCfg = updater(currentCfg);
      saveEngineeringSheetConfigToStorage(nextCfg);
      return {
        ...prevSettings,
        projectName: nextCfg.projectName,
        sheetConfig: nextCfg,
      };
    });
  };

  const handleUploadLogoFile = (
    role: 'CLIENT' | 'CONTRACTOR' | 'CONSULTANT',
    file: File
  ) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : null;
      if (!dataUrl) return;
      updateSheetConfig((prev) => ({
        ...prev,
        clientLogoDataUrl: role === 'CLIENT' ? dataUrl : prev.clientLogoDataUrl,
        contractorLogoDataUrl: role === 'CONTRACTOR' ? dataUrl : prev.contractorLogoDataUrl,
        consultantLogoDataUrl: role === 'CONSULTANT' ? dataUrl : prev.consultantLogoDataUrl,
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleMoveBlockOrder = (blockId: SheetEngineeringBlockId, dir: -1 | 1) => {
    updateSheetConfig((prev) => {
      const order = [...prev.blockOrder];
      const idx = order.indexOf(blockId);
      if (idx === -1) return prev;
      const target = idx + dir;
      if (target < 0 || target >= order.length) return prev;
      const [item] = order.splice(idx, 1);
      order.splice(target, 0, item);
      return { ...prev, blockOrder: order };
    });
  };

  const toggleBlockVisibility = (blockId: SheetEngineeringBlockId) => {
    updateSheetConfig((prev) => {
      const next = { ...prev };
      if (blockId === 'ORIENTATION_POLAR') {
        next.showOrientationPolarBlock = !prev.showOrientationPolarBlock;
      } else if (blockId === 'LEGEND_SUMMARY') {
        next.showLegendBlock = !prev.showLegendBlock;
      } else if (blockId === 'DATA_TABLE') {
        next.showDataTableBlock = !prev.showDataTableBlock;
      } else if (blockId === 'Q_INDEX_AND_NOTES') {
        next.showSummaryNotesBlock = !prev.showSummaryNotesBlock;
      }
      // Ensure at least 1 block stays visible in the engineering column
      if (
        !next.showOrientationPolarBlock &&
        !next.showLegendBlock &&
        !next.showDataTableBlock &&
        !next.showSummaryNotesBlock
      ) {
        next.showDataTableBlock = true;
      }
      return next;
    });
  };

  const hierarchyGroups = useMemo(
    () => groupSavedProjectsByHierarchy(savedProjects),
    [savedProjects]
  );

  const handleDownloadChainageRegisterCSV = () => {
    const csv = exportProjectHierarchyRegisterToCSV(savedProjects);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(sheetConfig.projectName || settings.tunnelName).replace(/\s+/g, '_')}_Chainage_Face_Register.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleAdvanceChainageByPull = () => {
    const curRd = parseNumericChainageMeters(settings.faceChainage, settings.chainage) ?? 0;
    const pull = Math.max(0.5, settings.roundLength || 3.5);
    const nextRd = Number((curRd + pull).toFixed(2));
    onUpdateSettings((prev) => ({
      ...prev,
      chainage: `RD ${curRd.toFixed(2)}m - ${nextRd.toFixed(2)}m`,
      faceChainage: `RD ${nextRd.toFixed(2)}m`,
    }));
  };

  return (
    <div className="flex flex-col h-full text-xs font-mono text-slate-100">
      {/* Sub-navigation Bar */}
      <div className="grid grid-cols-3 gap-1.5 p-2 bg-slate-900 border-b border-slate-800 shrink-0">
        <button
          type="button"
          onClick={() => setSubSection('project_and_logos')}
          className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded font-semibold transition-colors ${
            subSection === 'project_and_logos'
              ? 'bg-cyan-600 text-white'
              : 'bg-slate-800 text-slate-300 hover:text-white'
          }`}
        >
          <Building2 className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">1. Details &amp; Logos</span>
        </button>
        <button
          type="button"
          onClick={() => setSubSection('layout_and_placement')}
          className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded font-semibold transition-colors ${
            subSection === 'layout_and_placement'
              ? 'bg-cyan-600 text-white'
              : 'bg-slate-800 text-slate-300 hover:text-white'
          }`}
        >
          <LayoutTemplate className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">2. Placement &amp; Scale</span>
        </button>
        <button
          type="button"
          onClick={() => setSubSection('chainage_storage')}
          className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded font-semibold transition-colors ${
            subSection === 'chainage_storage'
              ? 'bg-emerald-600 text-white'
              : 'bg-slate-800 text-slate-300 hover:text-white'
          }`}
        >
          <Database className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">3. Chainage Storage ({savedProjects.length})</span>
        </button>
      </div>

      {/* Scrollable Editor Body */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
        {subSection === 'project_and_logos' && (
          <>
            {/* Project, Location, Tunnel & Chainage Details */}
            <div className="p-3 bg-slate-900/90 border border-slate-800 rounded space-y-2.5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                <span className="font-bold text-cyan-400 text-[11px]">
                  PROJECT, LOCATION, CLIENT &amp; CONTRACTOR DETAILS
                </span>
                <button
                  type="button"
                  onClick={onSaveCurrentProject}
                  className="flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded text-[10px]"
                  title="Save current face and sheet settings to Project & Chainage Memory"
                >
                  <Save className="w-3 h-3" />
                  Save to Storage
                </button>
              </div>

              <div
                className={`grid ${
                  compactDrawerMode ? 'grid-cols-1 gap-2' : 'grid-cols-1 sm:grid-cols-2 gap-2.5'
                }`}
              >
                <label className="space-y-1">
                  <span className="text-[10px] text-slate-400">Project / Package Name</span>
                  <input
                    type="text"
                    value={settings.projectName ?? sheetConfig.projectName}
                    placeholder="e.g. Hydroelectric Project Package-II"
                    onChange={(e) =>
                      updateSheetConfig((p) => ({ ...p, projectName: e.target.value }))
                    }
                    className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-slate-100"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-[10px] text-slate-400">Location / Adit / Portal</span>
                  <input
                    type="text"
                    value={settings.locationName || settings.location || sheetConfig.location || ''}
                    placeholder="e.g. Adit-II Downstream Heading"
                    onChange={(e) => {
                      const val = e.target.value;
                      onUpdateSettings((p) => {
                        const currentCfg = loadSavedEngineeringSheetConfig(p);
                        const nextCfg = { ...currentCfg, location: val };
                        saveEngineeringSheetConfigToStorage(nextCfg);
                        return {
                          ...p,
                          location: val,
                          locationName: val,
                          sheetConfig: nextCfg,
                        };
                      });
                    }}
                    className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-slate-100"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-[10px] text-slate-400">Tunnel / Structure Name</span>
                  <input
                    type="text"
                    value={settings.tunnelName}
                    onChange={(e) =>
                      onUpdateSettings((p) => ({ ...p, tunnelName: e.target.value }))
                    }
                    className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-slate-100"
                  />
                </label>

                <div className="grid grid-cols-3 gap-2">
                  <label className="space-y-1">
                    <span className="text-[10px] text-slate-400">Face Chainage (RD)</span>
                    <input
                      type="text"
                      value={settings.faceChainage}
                      onChange={(e) => {
                        const nextFace = e.target.value;
                        const numM = nextFace.match(/(\d+(?:\.\d+)?)/);
                        const pullM = Math.max(0.5, settings.roundLength || 3.5);
                        let nextChainage = settings.chainage;
                        if (numM) {
                          const faceVal = Number(numM[1]);
                          if (Number.isFinite(faceVal) && faceVal >= 0) {
                            const fromVal = Math.max(0, Number((faceVal - pullM).toFixed(2)));
                            const toVal = Number(faceVal.toFixed(2));
                            nextChainage =
                              toVal > fromVal
                                ? `RD ${fromVal.toFixed(2)}m - ${toVal.toFixed(2)}m`
                                : `RD 0.00m - ${pullM.toFixed(2)}m`;
                          }
                        }
                        onUpdateSettings((p) => ({
                          ...p,
                          faceChainage: nextFace,
                          chainage: nextChainage,
                        }));
                      }}
                      className="w-full px-2 py-1.5 bg-slate-950 border border-slate-700 rounded text-emerald-300 font-bold"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[10px] text-slate-400">Pull / Round (m)</span>
                    <input
                      type="number"
                      step="0.5"
                      min="0.5"
                      max="25"
                      value={settings.roundLength}
                      onChange={(e) => {
                        const nextPull = Math.max(0.5, Number(e.target.value) || 3.5);
                        const numM = (settings.faceChainage || '').match(/(\d+(?:\.\d+)?)/);
                        let nextChainage = settings.chainage;
                        if (numM) {
                          const faceVal = Number(numM[1]);
                          if (Number.isFinite(faceVal) && faceVal >= 0) {
                            const fromVal = Math.max(0, Number((faceVal - nextPull).toFixed(2)));
                            const toVal = Number(faceVal.toFixed(2));
                            nextChainage =
                              toVal > fromVal
                                ? `RD ${fromVal.toFixed(2)}m - ${toVal.toFixed(2)}m`
                                : `RD 0.00m - ${nextPull.toFixed(2)}m`;
                          }
                        }
                        onUpdateSettings((p) => ({
                          ...p,
                          roundLength: nextPull,
                          chainage: nextChainage,
                        }));
                      }}
                      className="w-full px-2 py-1.5 bg-slate-950 border border-slate-700 rounded text-amber-300 font-bold"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[10px] text-slate-400">Round Interval</span>
                    <input
                      type="text"
                      value={settings.chainage}
                      onChange={(e) =>
                        onUpdateSettings((p) => ({ ...p, chainage: e.target.value }))
                      }
                      className="w-full px-2 py-1.5 bg-slate-950 border border-slate-700 rounded text-slate-100"
                    />
                  </label>
                </div>

                <label className="space-y-1">
                  <span className="text-[10px] text-cyan-300 font-semibold">
                    Client / Employer Authority
                  </span>
                  <input
                    type="text"
                    value={sheetConfig.clientName}
                    placeholder="e.g. NHPC / Project Authority"
                    onChange={(e) =>
                      updateSheetConfig((p) => ({ ...p, clientName: e.target.value }))
                    }
                    className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-slate-100"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-[10px] text-emerald-300 font-semibold">
                    Contractor Name
                  </span>
                  <input
                    type="text"
                    value={sheetConfig.contractorName}
                    placeholder="e.g. Main Civil Works Contractor"
                    onChange={(e) =>
                      updateSheetConfig((p) => ({ ...p, contractorName: e.target.value }))
                    }
                    className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-slate-100"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-[10px] text-indigo-300 font-semibold">
                    Consultant / Engineer Name
                  </span>
                  <input
                    type="text"
                    value={sheetConfig.consultantName}
                    placeholder="e.g. Design & Supervision Consultant"
                    onChange={(e) =>
                      updateSheetConfig((p) => ({ ...p, consultantName: e.target.value }))
                    }
                    className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-slate-100"
                  />
                </label>

                <div className="grid grid-cols-3 gap-1.5">
                  <label className="space-y-1">
                    <span className="text-[10px] text-slate-400">Contract No.</span>
                    <input
                      type="text"
                      value={sheetConfig.contractNumber}
                      onChange={(e) =>
                        updateSheetConfig((p) => ({ ...p, contractNumber: e.target.value }))
                      }
                      className="w-full px-2 py-1.5 bg-slate-950 border border-slate-700 rounded text-slate-100"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[10px] text-slate-400">Drawing No.</span>
                    <input
                      type="text"
                      value={sheetConfig.drawingNumber}
                      onChange={(e) =>
                        updateSheetConfig((p) => ({ ...p, drawingNumber: e.target.value }))
                      }
                      className="w-full px-2 py-1.5 bg-slate-950 border border-slate-700 rounded text-slate-100"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[10px] text-slate-400">Revision</span>
                    <input
                      type="text"
                      value={sheetConfig.revisionNumber}
                      onChange={(e) =>
                        updateSheetConfig((p) => ({ ...p, revisionNumber: e.target.value }))
                      }
                      className="w-full px-2 py-1.5 bg-slate-950 border border-slate-700 rounded text-slate-100"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <label className="space-y-1">
                    <span className="text-[10px] text-slate-400">Mapped By (Geologist/Surveyor)</span>
                    <input
                      type="text"
                      value={settings.mappedBy}
                      placeholder="e.g. Sr. Engineering Geologist"
                      onChange={(e) =>
                        onUpdateSettings((p) => ({ ...p, mappedBy: e.target.value }))
                      }
                      className="w-full px-2 py-1.5 bg-slate-950 border border-slate-700 rounded text-slate-100"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[10px] text-slate-400">Mapping Date</span>
                    <input
                      type="date"
                      value={settings.date}
                      onChange={(e) =>
                        onUpdateSettings((p) => ({ ...p, date: e.target.value }))
                      }
                      className="w-full px-2 py-1.5 bg-slate-950 border border-slate-700 rounded text-slate-100"
                    />
                  </label>
                </div>

                <label className="space-y-1">
                  <span className="text-[10px] text-slate-400">Primary Lithology Header Text</span>
                  <input
                    type="text"
                    value={settings.lithology}
                    placeholder="e.g. Quartzite / Phyllite with Shear Seam"
                    onChange={(e) =>
                      onUpdateSettings((p) => ({ ...p, lithology: e.target.value }))
                    }
                    className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-slate-100"
                  />
                </label>
              </div>

              {/* Editable Sheet Titles */}
              <div className="pt-2 border-t border-slate-800 grid grid-cols-1 gap-2">
                <label className="space-y-1">
                  <span className="text-[10px] text-rose-300 font-semibold">
                    Engineering Quantity Sheet Title (Editable)
                  </span>
                  <input
                    type="text"
                    value={sheetConfig.quantitySheetTitle}
                    onChange={(e) =>
                      updateSheetConfig((p) => ({ ...p, quantitySheetTitle: e.target.value }))
                    }
                    className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-slate-100"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[10px] text-cyan-300 font-semibold">
                    Geological Mapping Sheet Title (Editable)
                  </span>
                  <input
                    type="text"
                    value={sheetConfig.geologySheetTitle}
                    onChange={(e) =>
                      updateSheetConfig((p) => ({ ...p, geologySheetTitle: e.target.value }))
                    }
                    className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-slate-100"
                  />
                </label>
              </div>
            </div>

            {/* Client, Contractor & Consultant Logo Upload & Placement */}
            <div className="p-3 bg-slate-900/90 border border-slate-800 rounded space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-1.5">
                <span className="font-bold text-emerald-400 text-[11px] flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5" />
                  CLIENT, CONTRACTOR &amp; CONSULTANT LOGOS &amp; POSITION
                </span>
                <div className="flex items-center gap-2">
                  <select
                    value={sheetConfig.logoPosition}
                    onChange={(e) =>
                      updateSheetConfig((p) => ({
                        ...p,
                        logoPosition: e.target.value as SheetLogoPosition,
                      }))
                    }
                    className="px-2 py-1 bg-slate-950 border border-slate-700 rounded text-[10px] text-cyan-300 font-semibold"
                    title="Choose where logos are placed on the Engineering Sheet"
                  >
                    <option value="HEADER_CORNERS">Logo Pos: Header Corners (Client L / Contractor R)</option>
                    <option value="HEADER_RIGHT_GROUP">Logo Pos: Header Right Title Block</option>
                    <option value="HEADER_LEFT_GROUP">Logo Pos: Header Left Title Block</option>
                    <option value="BOTTOM_SIGN_BLOCK">Logo Pos: Bottom Signature Block</option>
                    <option value="HIDDEN">Logo Pos: Hidden</option>
                  </select>
                  <select
                    value={sheetConfig.logoSize}
                    onChange={(e) =>
                      updateSheetConfig((p) => ({
                        ...p,
                        logoSize: e.target.value as 'COMPACT' | 'STANDARD' | 'LARGE',
                      }))
                    }
                    className="px-2 py-1 bg-slate-950 border border-slate-700 rounded text-[10px] text-slate-200"
                  >
                    <option value="COMPACT">Size: Compact</option>
                    <option value="STANDARD">Size: Standard</option>
                    <option value="LARGE">Size: Large</option>
                  </select>
                </div>
              </div>

              <div
                className={`grid ${
                  compactDrawerMode ? 'grid-cols-1 gap-2.5' : 'grid-cols-1 sm:grid-cols-3 gap-2.5'
                }`}
              >
                {/* 1. Client Logo Card */}
                <div className="p-2.5 bg-slate-950 border border-slate-800 rounded space-y-2 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-cyan-300 text-[10px]">1. CLIENT LOGO</span>
                    {sheetConfig.clientLogoDataUrl && (
                      <button
                        type="button"
                        onClick={() =>
                          updateSheetConfig((p) => ({ ...p, clientLogoDataUrl: null }))
                        }
                        className="text-rose-400 hover:text-rose-300 text-[10px] flex items-center gap-0.5"
                      >
                        <Trash2 className="w-3 h-3" /> Clear
                      </button>
                    )}
                  </div>
                  <div className="h-14 bg-white/95 rounded border border-slate-700 flex items-center justify-center p-1 overflow-hidden">
                    {sheetConfig.clientLogoDataUrl ? (
                      <img
                        src={sheetConfig.clientLogoDataUrl}
                        alt="Client Logo"
                        className="max-h-full max-w-full object-contain"
                      />
                    ) : (
                      <span className="text-[10px] text-slate-500">No Client Logo</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      ref={clientLogoInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleUploadLogoFile('CLIENT', f);
                        e.target.value = '';
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => clientLogoInputRef.current?.click()}
                      className="flex-1 py-1 px-2 bg-cyan-950 hover:bg-cyan-900 text-cyan-200 border border-cyan-700/60 rounded text-[10px] flex items-center justify-center gap-1"
                    >
                      <Upload className="w-3 h-3" /> Upload
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        updateSheetConfig((p) => ({
                          ...p,
                          clientLogoDataUrl: generateSampleEngineeringLogoDataUrl(
                            'CLIENT',
                            p.clientName
                          ),
                        }))
                      }
                      className="py-1 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded text-[10px]"
                      title="Generate clean engineering stamp badge from Client Name"
                    >
                      Auto Badge
                    </button>
                  </div>
                </div>

                {/* 2. Contractor Logo Card */}
                <div className="p-2.5 bg-slate-950 border border-slate-800 rounded space-y-2 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-emerald-300 text-[10px]">
                      2. CONTRACTOR LOGO
                    </span>
                    {sheetConfig.contractorLogoDataUrl && (
                      <button
                        type="button"
                        onClick={() =>
                          updateSheetConfig((p) => ({ ...p, contractorLogoDataUrl: null }))
                        }
                        className="text-rose-400 hover:text-rose-300 text-[10px] flex items-center gap-0.5"
                      >
                        <Trash2 className="w-3 h-3" /> Clear
                      </button>
                    )}
                  </div>
                  <div className="h-14 bg-white/95 rounded border border-slate-700 flex items-center justify-center p-1 overflow-hidden">
                    {sheetConfig.contractorLogoDataUrl ? (
                      <img
                        src={sheetConfig.contractorLogoDataUrl}
                        alt="Contractor Logo"
                        className="max-h-full max-w-full object-contain"
                      />
                    ) : (
                      <span className="text-[10px] text-slate-500">No Contractor Logo</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      ref={contractorLogoInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleUploadLogoFile('CONTRACTOR', f);
                        e.target.value = '';
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => contractorLogoInputRef.current?.click()}
                      className="flex-1 py-1 px-2 bg-emerald-950 hover:bg-emerald-900 text-emerald-200 border border-emerald-700/60 rounded text-[10px] flex items-center justify-center gap-1"
                    >
                      <Upload className="w-3 h-3" /> Upload
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        updateSheetConfig((p) => ({
                          ...p,
                          contractorLogoDataUrl: generateSampleEngineeringLogoDataUrl(
                            'CONTRACTOR',
                            p.contractorName
                          ),
                        }))
                      }
                      className="py-1 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded text-[10px]"
                      title="Generate clean engineering stamp badge from Contractor Name"
                    >
                      Auto Badge
                    </button>
                  </div>
                </div>

                {/* 3. Consultant Logo Card */}
                <div className="p-2.5 bg-slate-950 border border-slate-800 rounded space-y-2 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-indigo-300 text-[10px]">
                      3. CONSULTANT LOGO
                    </span>
                    {sheetConfig.consultantLogoDataUrl && (
                      <button
                        type="button"
                        onClick={() =>
                          updateSheetConfig((p) => ({ ...p, consultantLogoDataUrl: null }))
                        }
                        className="text-rose-400 hover:text-rose-300 text-[10px] flex items-center gap-0.5"
                      >
                        <Trash2 className="w-3 h-3" /> Clear
                      </button>
                    )}
                  </div>
                  <div className="h-14 bg-white/95 rounded border border-slate-700 flex items-center justify-center p-1 overflow-hidden">
                    {sheetConfig.consultantLogoDataUrl ? (
                      <img
                        src={sheetConfig.consultantLogoDataUrl}
                        alt="Consultant Logo"
                        className="max-h-full max-w-full object-contain"
                      />
                    ) : (
                      <span className="text-[10px] text-slate-500">No Consultant Logo</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      ref={consultantLogoInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleUploadLogoFile('CONSULTANT', f);
                        e.target.value = '';
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => consultantLogoInputRef.current?.click()}
                      className="flex-1 py-1 px-2 bg-indigo-950 hover:bg-indigo-900 text-indigo-200 border border-indigo-700/60 rounded text-[10px] flex items-center justify-center gap-1"
                    >
                      <Upload className="w-3 h-3" /> Upload
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        updateSheetConfig((p) => ({
                          ...p,
                          consultantLogoDataUrl: generateSampleEngineeringLogoDataUrl(
                            'CONSULTANT',
                            p.consultantName
                          ),
                        }))
                      }
                      className="py-1 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded text-[10px]"
                      title="Generate clean engineering stamp badge from Consultant Name"
                    >
                      Auto Badge
                    </button>
                  </div>
                </div>
              </div>

              {/* Signature Block Sign-off Customization */}
              <div className="pt-2 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-2">
                <label className="space-y-1">
                  <span className="text-[10px] text-slate-400">Contractor Signatory Label &amp; Name</span>
                  <div className="grid grid-cols-2 gap-1.5">
                    <input
                      type="text"
                      value={sheetConfig.contractorSignTitle}
                      onChange={(e) =>
                        updateSheetConfig((p) => ({ ...p, contractorSignTitle: e.target.value }))
                      }
                      placeholder="CONTRACTOR GEOLOGIST"
                      className="px-2 py-1 bg-slate-950 border border-slate-700 rounded text-[10px]"
                    />
                    <input
                      type="text"
                      value={sheetConfig.contractorSignName}
                      onChange={(e) =>
                        updateSheetConfig((p) => ({ ...p, contractorSignName: e.target.value }))
                      }
                      placeholder="Signatory Name (Optional)"
                      className="px-2 py-1 bg-slate-950 border border-slate-700 rounded text-[10px]"
                    />
                  </div>
                </label>
                <label className="space-y-1">
                  <span className="text-[10px] text-slate-400">Client Signatory Label &amp; Name</span>
                  <div className="grid grid-cols-2 gap-1.5">
                    <input
                      type="text"
                      value={sheetConfig.clientSignTitle}
                      onChange={(e) =>
                        updateSheetConfig((p) => ({ ...p, clientSignTitle: e.target.value }))
                      }
                      placeholder="CLIENT / ENGINEER"
                      className="px-2 py-1 bg-slate-950 border border-slate-700 rounded text-[10px]"
                    />
                    <input
                      type="text"
                      value={sheetConfig.clientSignName}
                      onChange={(e) =>
                        updateSheetConfig((p) => ({ ...p, clientSignName: e.target.value }))
                      }
                      placeholder="Signatory Name (Optional)"
                      className="px-2 py-1 bg-slate-950 border border-slate-700 rounded text-[10px]"
                    />
                  </div>
                </label>
              </div>
            </div>
          </>
        )}

        {subSection === 'layout_and_placement' && (
          <>
            {/* Layout Mode Toggle: Adaptive Layout vs Fixed Layout (Manual Control) */}
            <div className="p-3 bg-slate-900/90 border border-cyan-500/40 rounded space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-1.5">
                <span className="font-bold text-cyan-300 text-[11px] flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5" />
                  SHEET LAYOUT ENGINE: ADAPTIVE VS. FIXED LAYOUT
                </span>
                <button
                  type="button"
                  onClick={() =>
                    updateSheetConfig(() => createDefaultEngineeringSheetConfig(settings))
                  }
                  className="flex items-center gap-1 px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px]"
                  title="Reset sheet layout & placement to defaults"
                >
                  <RotateCcw className="w-3 h-3" /> Reset Defaults
                </button>
              </div>

              {/* Dual Segmented Toggle: Adaptive Layout vs Fixed Layout */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-1.5 bg-slate-950 border border-slate-800 rounded">
                <button
                  type="button"
                  onClick={() =>
                    updateSheetConfig((p) => ({
                      ...p,
                      layoutMode: 'ADAPTIVE_LAYOUT',
                    }))
                  }
                  className={`flex flex-col items-start p-2.5 rounded border text-left transition-all cursor-pointer ${
                    (sheetConfig.layoutMode || 'ADAPTIVE_LAYOUT') === 'ADAPTIVE_LAYOUT'
                      ? 'bg-cyan-950/90 border-cyan-400 text-white shadow-md'
                      : 'bg-slate-900/70 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="font-bold text-[11px] text-cyan-300 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      Adaptive Layout (Auto-Resizing)
                    </span>
                    {(sheetConfig.layoutMode || 'ADAPTIVE_LAYOUT') === 'ADAPTIVE_LAYOUT' && (
                      <span className="px-1.5 py-0.5 bg-cyan-600 text-white rounded text-[9px] font-bold">
                        ACTIVE
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-300 mt-1 leading-snug">
                    Automatically enlarges fonts &amp; table rows when content is sparse and
                    compacts when dense to eliminate empty white space.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    updateSheetConfig((p) => ({
                      ...p,
                      layoutMode: 'FIXED_LAYOUT',
                    }))
                  }
                  className={`flex flex-col items-start p-2.5 rounded border text-left transition-all cursor-pointer ${
                    sheetConfig.layoutMode === 'FIXED_LAYOUT'
                      ? 'bg-amber-950/90 border-amber-400 text-white shadow-md'
                      : 'bg-slate-900/70 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="font-bold text-[11px] text-amber-300 flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5" />
                      Fixed Layout (Manual Control)
                    </span>
                    {sheetConfig.layoutMode === 'FIXED_LAYOUT' && (
                      <span className="px-1.5 py-0.5 bg-amber-600 text-white rounded text-[9px] font-bold">
                        ACTIVE
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-300 mt-1 leading-snug">
                    Locks fixed block proportions and lets you manually set font scale, table row
                    height (px), and table block ratio (%).
                  </p>
                </button>
              </div>

              {(sheetConfig.layoutMode || 'ADAPTIVE_LAYOUT') === 'ADAPTIVE_LAYOUT' ? (
                <div
                  className={`grid ${
                    compactDrawerMode ? 'grid-cols-1 gap-2.5' : 'grid-cols-1 sm:grid-cols-3 gap-2.5'
                  }`}
                >
                  <label className="space-y-1">
                    <span className="text-[10px] text-slate-400">Adaptive Scaling Density Profile</span>
                    <select
                      value={sheetConfig.adaptiveScaleMode}
                      onChange={(e) =>
                        updateSheetConfig((p) => ({
                          ...p,
                          adaptiveScaleMode: e.target.value as SheetAdaptiveScaleMode,
                        }))
                      }
                      className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-cyan-300 font-semibold"
                    >
                      <option value="AUTO_CONTENT">Auto-Adaptive (By Content)</option>
                      <option value="SPACIOUS_LARGE">Spacious (Larger Fonts &amp; Tables)</option>
                      <option value="COMPACT_DENSE">Compact (Dense Multi-Zone Data)</option>
                    </select>
                  </label>

                  <label className="space-y-1">
                    <span className="text-[10px] text-slate-400">
                      Font &amp; Table Fine-Tune ({Math.round((sheetConfig.fontScaleMultiplier || 1) * 100)}%)
                    </span>
                    <input
                      type="range"
                      min="0.85"
                      max="1.30"
                      step="0.03"
                      value={sheetConfig.fontScaleMultiplier || 1.0}
                      onChange={(e) =>
                        updateSheetConfig((p) => ({
                          ...p,
                          fontScaleMultiplier: parseFloat(e.target.value) || 1.0,
                        }))
                      }
                      className="w-full accent-cyan-500 cursor-pointer mt-2"
                    />
                  </label>

                  <label className="space-y-1">
                    <span className="text-[10px] text-slate-400">Drawing vs. Table Width Balance</span>
                    <select
                      value={sheetConfig.columnWidthMode}
                      onChange={(e) =>
                        updateSheetConfig((p) => ({
                          ...p,
                          columnWidthMode: e.target.value as
                            | 'BALANCED'
                            | 'WIDE_TABLES'
                            | 'MAX_DRAWING',
                        }))
                      }
                      className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-slate-100"
                    >
                      <option value="BALANCED">Balanced (Standard Engineering)</option>
                      <option value="WIDE_TABLES">Wider Tables &amp; Quantity Column</option>
                      <option value="MAX_DRAWING">Expanded Face Drawing Arena</option>
                    </select>
                  </label>
                </div>
              ) : (
                <div
                  className={`grid ${
                    compactDrawerMode ? 'grid-cols-1 gap-2.5' : 'grid-cols-1 sm:grid-cols-4 gap-2.5'
                  }`}
                >
                  <label className="space-y-1">
                    <span className="text-[10px] text-amber-300 font-semibold">
                      Manual Font Scale ({Math.round((sheetConfig.fontScaleMultiplier || 1) * 100)}%)
                    </span>
                    <input
                      type="range"
                      min="0.80"
                      max="1.35"
                      step="0.03"
                      value={sheetConfig.fontScaleMultiplier || 1.0}
                      onChange={(e) =>
                        updateSheetConfig((p) => ({
                          ...p,
                          fontScaleMultiplier: parseFloat(e.target.value) || 1.0,
                        }))
                      }
                      className="w-full accent-amber-500 cursor-pointer mt-2"
                    />
                  </label>

                  <label className="space-y-1">
                    <span className="text-[10px] text-amber-300 font-semibold">
                      Manual Table Row Height ({sheetConfig.manualTableRowHeight ?? 34} px)
                    </span>
                    <input
                      type="range"
                      min="20"
                      max="64"
                      step="2"
                      value={sheetConfig.manualTableRowHeight ?? 34}
                      onChange={(e) =>
                        updateSheetConfig((p) => ({
                          ...p,
                          manualTableRowHeight: parseInt(e.target.value, 10) || 34,
                        }))
                      }
                      className="w-full accent-amber-500 cursor-pointer mt-2"
                    />
                  </label>

                  <label className="space-y-1">
                    <span className="text-[10px] text-amber-300 font-semibold">
                      Table Block Height Share ({Math.round((sheetConfig.manualTableBlockRatio ?? 0.38) * 100)}%)
                    </span>
                    <input
                      type="range"
                      min="0.25"
                      max="0.55"
                      step="0.02"
                      value={sheetConfig.manualTableBlockRatio ?? 0.38}
                      onChange={(e) =>
                        updateSheetConfig((p) => ({
                          ...p,
                          manualTableBlockRatio: parseFloat(e.target.value) || 0.38,
                        }))
                      }
                      className="w-full accent-amber-500 cursor-pointer mt-2"
                    />
                  </label>

                  <label className="space-y-1">
                    <span className="text-[10px] text-slate-400">Drawing vs. Table Width</span>
                    <select
                      value={sheetConfig.columnWidthMode}
                      onChange={(e) =>
                        updateSheetConfig((p) => ({
                          ...p,
                          columnWidthMode: e.target.value as
                            | 'BALANCED'
                            | 'WIDE_TABLES'
                            | 'MAX_DRAWING',
                        }))
                      }
                      className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-slate-100"
                    >
                      <option value="BALANCED">Balanced (Standard)</option>
                      <option value="WIDE_TABLES">Wider Tables Column</option>
                      <option value="MAX_DRAWING">Expanded Face Drawing</option>
                    </select>
                  </label>
                </div>
              )}
            </div>

            {/* Where Things Are Placed (Header Position, Column Side & Block Order) */}
            <div className="p-3 bg-slate-900/90 border border-slate-800 rounded space-y-3">
              <div className="font-bold text-emerald-400 text-[11px] border-b border-slate-800 pb-1.5">
                SHEET ZONE PLACEMENT &amp; BLOCK ORDERING
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <label className="space-y-1">
                  <span className="text-[10px] text-slate-400">
                    Project Title &amp; Metadata Header Position
                  </span>
                  <select
                    value={sheetConfig.headerPosition}
                    onChange={(e) =>
                      updateSheetConfig((p) => ({
                        ...p,
                        headerPosition: e.target.value as 'TOP' | 'BOTTOM',
                      }))
                    }
                    className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-slate-100"
                  >
                    <option value="TOP">Top of Sheet (Standard Engineering Header)</option>
                    <option value="BOTTOM">Bottom of Sheet (CAD Title Block Style)</option>
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="text-[10px] text-slate-400">
                    Tables &amp; Quantities Column Position
                  </span>
                  <select
                    value={sheetConfig.engineeringColumnPosition}
                    onChange={(e) =>
                      updateSheetConfig((p) => ({
                        ...p,
                        engineeringColumnPosition: e.target.value as 'RIGHT' | 'LEFT',
                      }))
                    }
                    className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-slate-100"
                  >
                    <option value="RIGHT">Right Side (Face Drawing on Left)</option>
                    <option value="LEFT">Left Side (Face Drawing on Right)</option>
                  </select>
                </label>
              </div>

              {/* Reorderable Engineering Column Blocks + Visibility Toggles */}
              <div className="space-y-1.5 pt-1">
                <div className="text-[10px] text-slate-400">
                  Order &amp; Visibility of Engineering Column Blocks (Hidden blocks automatically
                  give 100% of their height to remaining blocks):
                </div>
                {sheetConfig.blockOrder.map((blockId, idx) => {
                  const meta = BLOCK_LABELS[blockId];
                  const isVisible =
                    blockId === 'ORIENTATION_POLAR'
                      ? sheetConfig.showOrientationPolarBlock
                      : blockId === 'LEGEND_SUMMARY'
                      ? sheetConfig.showLegendBlock
                      : blockId === 'DATA_TABLE'
                      ? sheetConfig.showDataTableBlock
                      : sheetConfig.showSummaryNotesBlock;

                  return (
                    <div
                      key={blockId}
                      className={`p-2 rounded border flex items-center justify-between gap-2 ${
                        isVisible
                          ? 'bg-slate-950 border-slate-700'
                          : 'bg-slate-950/40 border-slate-800/60 opacity-60'
                      }`}
                    >
                      <label className="flex items-center gap-2 cursor-pointer flex-1 min-w-0">
                        <input
                          type="checkbox"
                          checked={isVisible}
                          onChange={() => toggleBlockVisibility(blockId)}
                          className="rounded border-slate-700 bg-slate-900 text-cyan-500"
                        />
                        <div className="min-w-0">
                          <div className="font-bold text-slate-100 text-[11px] truncate">
                            #{idx + 1}. {meta.title}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate">{meta.subtitle}</div>
                        </div>
                      </label>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => handleMoveBlockOrder(blockId, -1)}
                          className="p-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 rounded text-slate-200"
                          title="Move block higher on sheet"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === sheetConfig.blockOrder.length - 1}
                          onClick={() => handleMoveBlockOrder(blockId, 1)}
                          className="p-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 rounded text-slate-200"
                          title="Move block lower on sheet"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Additional Drawing & Sheet Element Checkboxes */}
              <div className="pt-2 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-2">
                <label className="flex items-center gap-2 p-2 bg-slate-950 border border-slate-800 rounded cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sheetConfig.showPerimeterPlan}
                    onChange={(e) =>
                      updateSheetConfig((p) => ({ ...p, showPerimeterPlan: e.target.checked }))
                    }
                    className="rounded border-slate-700 bg-slate-900 text-cyan-500"
                  />
                  <span className="text-[10px] text-slate-200">
                    Show Developed Perimeter Strip (Walls + Crown)
                  </span>
                </label>

                <label className="flex items-center gap-2 p-2 bg-slate-950 border border-slate-800 rounded cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sheetConfig.showSignatureStrip}
                    onChange={(e) =>
                      updateSheetConfig((p) => ({ ...p, showSignatureStrip: e.target.checked }))
                    }
                    className="rounded border-slate-700 bg-slate-900 text-cyan-500"
                  />
                  <span className="text-[10px] text-slate-200">
                    Show Contractor &amp; Client Sign-off Strip
                  </span>
                </label>

                <label className="flex items-center gap-2 p-2 bg-slate-950 border border-slate-800 rounded cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sheetConfig.showBackgroundGrid}
                    onChange={(e) =>
                      updateSheetConfig((p) => ({ ...p, showBackgroundGrid: e.target.checked }))
                    }
                    className="rounded border-slate-700 bg-slate-900 text-cyan-500"
                  />
                  <span className="text-[10px] text-slate-200">
                    Show Technical Engineering Grid Background
                  </span>
                </label>
              </div>
            </div>
          </>
        )}

        {subSection === 'chainage_storage' && (
          <>
            {/* Quick Chainage Save & Advance Controls */}
            <div className="p-3 bg-slate-900/90 border border-emerald-500/40 rounded space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-1.5">
                <div>
                  <div className="font-bold text-emerald-300 text-[11px]">
                    HIERARCHICAL STORAGE: PROJECT → LOCATION → TUNNEL → CHAINAGE (RD)
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Stores all face details (geometry, photos, joints, RMR/Q, control points,
                    overbreak &amp; sheet logos) indexed by chainage.
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={onSaveCurrentProject}
                    className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded text-[11px]"
                  >
                    <Save className="w-3.5 h-3.5" />
                    Save Current Face ({settings.faceChainage})
                  </button>
                  {onCreateNextChainageSection ? (
                    <button
                      type="button"
                      onClick={onCreateNextChainageSection}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold rounded text-[10px]"
                      title="Save current face and create next consecutive chainage face (+Pull)"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      +Next Chainage ({settings.roundLength}m)
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        onSaveCurrentProject();
                        handleAdvanceChainageByPull();
                      }}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold rounded text-[10px]"
                      title="Save current face and advance chainage by pull length"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Save &amp; Advance RD (+{settings.roundLength}m)
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleDownloadChainageRegisterCSV}
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 rounded text-[10px]"
                    title="Export complete Project & Location Chainage Face Ledger to CSV"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    CSV Ledger
                  </button>
                </div>
              </div>

              {/* Active Chainage Index Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
                <div className="p-2 bg-slate-950 rounded border border-slate-800">
                  <div className="text-slate-500">PROJECT</div>
                  <div className="font-bold text-slate-100 truncate">
                    {sheetConfig.projectName}
                  </div>
                </div>
                <div className="p-2 bg-slate-950 rounded border border-slate-800">
                  <div className="text-slate-500">LOCATION / ADIT</div>
                  <div className="font-bold text-cyan-300 truncate">
                    {settings.locationName || settings.location || 'Main Heading'}
                  </div>
                </div>
                <div className="p-2 bg-slate-950 rounded border border-slate-800">
                  <div className="text-slate-500">TUNNEL</div>
                  <div className="font-bold text-slate-100 truncate">{settings.tunnelName}</div>
                </div>
                <div className="p-2 bg-slate-950 rounded border border-emerald-700/60">
                  <div className="text-slate-500">ACTIVE FACE CHAINAGE</div>
                  <div className="font-bold text-emerald-300 truncate">{settings.faceChainage}</div>
                </div>
              </div>
            </div>

            {/* Grouped Project -> Location -> Chainage Cards */}
            {hierarchyGroups.length === 0 ? (
              <div className="p-6 bg-slate-900/60 border border-slate-800 rounded text-center text-slate-400 space-y-2">
                <div>No tunnel faces saved in Project &amp; Chainage Storage yet.</div>
                <div>
                  Click <strong className="text-emerald-300">&quot;Save Current Face&quot;</strong>{' '}
                  above to store all details of {settings.faceChainage} under{' '}
                  <strong className="text-cyan-300">{sheetConfig.projectName}</strong>.
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {hierarchyGroups.map((grp) => (
                  <div
                    key={grp.groupKey}
                    className="p-3 bg-slate-900 border border-slate-800 rounded space-y-2.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2 py-0.5 bg-cyan-950 text-cyan-300 border border-cyan-700/60 rounded text-[10px] font-bold">
                            PROJECT: {grp.projectName}
                          </span>
                          <span className="px-2 py-0.5 bg-slate-800 text-slate-200 border border-slate-700 rounded text-[10px]">
                            LOCATION: {grp.location}
                          </span>
                          <span className="font-bold text-white text-xs">{grp.tunnelName}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-1">
                          {grp.faces.length} Stored Face(s) · Chainage Span:{' '}
                          {grp.minRdMeters !== null && grp.maxRdMeters !== null
                            ? `RD ${grp.minRdMeters.toFixed(2)}m → RD ${grp.maxRdMeters.toFixed(2)}m`
                            : 'Custom RD'}{' '}
                          · Cumulative OB:{' '}
                          <strong className="text-rose-300">
                            +{grp.totalOverbreakAreaSqM.toFixed(2)} m² (+{grp.totalOverbreakVolM3.toFixed(1)} m³)
                          </strong>{' '}
                          · Cumulative UC:{' '}
                          <strong className="text-amber-300">
                            -{grp.totalUndercutAreaSqM.toFixed(2)} m²
                          </strong>
                        </div>
                      </div>
                    </div>

                    {/* Visual Chainage Timeline Strip */}
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                      {grp.faces.map((faceRec) => {
                        const isCurrent =
                          faceRec.faceChainage.trim().toLowerCase() ===
                            settings.faceChainage.trim().toLowerCase() &&
                          faceRec.tunnelName.trim().toLowerCase() ===
                            settings.tunnelName.trim().toLowerCase();
                        return (
                          <div
                            key={faceRec.id}
                            className={`p-2 rounded border min-w-[185px] flex flex-col justify-between gap-1.5 transition-colors ${
                              isCurrent
                                ? 'bg-emerald-950/50 border-emerald-500/80'
                                : 'bg-slate-950 border-slate-800 hover:border-cyan-500/50'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-bold text-emerald-300 text-[11px]">
                                {faceRec.faceChainage || faceRec.chainage}
                              </span>
                              <span className="text-[9px] text-slate-400">{faceRec.date}</span>
                            </div>
                            <div className="text-[10px] text-slate-300 space-y-0.5">
                              <div>
                                OB:{' '}
                                <strong className="text-rose-300">
                                  +{faceRec.quantitySummary.overbreakAreaSqM.toFixed(2)}m² (
                                  {faceRec.quantitySummary.overbreakPct.toFixed(1)}%)
                                </strong>
                              </div>
                              <div>
                                UC:{' '}
                                <strong className="text-amber-300">
                                  -{faceRec.quantitySummary.undercutAreaSqM.toFixed(2)}m²
                                </strong>{' '}
                                · {faceRec.joints.length}J · {faceRec.controlPoints.length}CP
                              </div>
                            </div>
                            <div className="flex items-center justify-between gap-1 pt-1 border-t border-slate-800/80">
                              {onLoadProjectRecord && (
                                <button
                                  type="button"
                                  onClick={() => onLoadProjectRecord(faceRec)}
                                  className="flex-1 py-1 px-2 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold rounded text-[10px] flex items-center justify-center gap-1"
                                >
                                  <FolderOpen className="w-3 h-3" />
                                  {isCurrent ? 'Reload Face' : 'Open Face'}
                                </button>
                              )}
                              {onDeleteProjectRecord && (
                                <button
                                  type="button"
                                  onClick={() => onDeleteProjectRecord(faceRec.id)}
                                  className="p-1 bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-300 rounded"
                                  title="Delete Face Record"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
