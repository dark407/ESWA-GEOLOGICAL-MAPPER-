import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Crosshair,
  FileText,
  Image as ImageIcon,
  Info,
  Plus,
  Shield,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  APERTURE_OPTIONS,
  buildAutoPopulatedTemplateDictionary,
  computeFaceTunnelOutlineDetails,
  computeFieldQValue,
  computeFieldRmrValue,
  FIELD_JOINT_GROUP_COLORS,
  FIELD_JOINT_SET_IDS,
  FieldCustomTickBoxGroup,
  FieldDiscontinuitySetRecord,
  FieldExcavationRound,
  FieldJointSetId,
  FieldPanelId,
  FieldPoint2D,
  FieldProjectItem,
  FieldSpotBoltItem,
  FieldSupportSystemConfig,
  FieldSurveyOverbreakData,
  FieldTunnelLocationItem,
  GROUNDWATER_OPTIONS,
  INFILLING_OPTIONS,
  parseUploadedWordTemplateFile,
  PERSISTENCE_OPTIONS,
  ROUGHNESS_OPTIONS,
  SPACING_OPTIONS,
  WEATHERING_OPTIONS,
  computePaylinePolygon,
  computeJunctionGeotechnicalAdjustments,
  createDefaultSupportSystem,
  createDefaultSurveyOverbreak,
  generateOverbreakSummarySentence,
  generateProfessionalGeologicalDescription,
  getLocationSurfaceConfig,
} from '../engine/fieldMappingEngine';
import {
  MappingDomainType,
  SurfaceGeometryParameters,
  evaluateSurfaceStabilityAndRomanaSmr,
  getDomainExcavationMethodOptions,
} from '../engine/surfaceMappingEngine';
import { FieldSupport3DInteractiveCanvas } from './FieldSupport3DInteractiveCanvas';
import { TunnelJunctionFactorModal } from './TunnelJunctionFactorModal';

// ============================================================================
// REUSABLE TEMPLATE EDIT PANEL (HEADER LOGOS, MISSING TICK-BOXES, CUSTOM WORD TEMPLATE)
// Only shown and opened when the user explicitly clicks "Template Edit"
// ============================================================================
export const FieldReportTemplateEditorPanel: React.FC<{
  activeProject: FieldProjectItem;
  activeLocation: FieldTunnelLocationItem;
  activeRound: FieldExcavationRound;
  onUpdateProject: (updater: (prev: FieldProjectItem) => FieldProjectItem) => void;
  onUpdateRound: (updater: (prev: FieldExcavationRound) => FieldExcavationRound) => void;
  onClose?: () => void;
  className?: string;
}> = ({
  activeProject,
  activeLocation,
  activeRound,
  onUpdateProject,
  onUpdateRound,
  onClose,
  className = '',
}) => {
  const [newTickCategory, setNewTickCategory] = useState('');
  const [newTickOptionsCsv, setNewTickOptionsCsv] = useState('Option A, Option B, Option C');
  const [templateStatus, setTemplateStatus] = useState<string>('');

  const autoDict = buildAutoPopulatedTemplateDictionary(
    activeProject,
    activeLocation,
    activeRound
  );

  const handleLogoUpload = (side: 'left' | 'right', file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      onUpdateProject((p) =>
        side === 'left' ? { ...p, leftLogoDataUrl: dataUrl } : { ...p, rightLogoDataUrl: dataUrl }
      );
    };
    reader.readAsDataURL(file);
  };

  const handleAddMissingTickBoxRow = () => {
    const title = newTickCategory.trim();
    if (!title) return;
    const parsedOptions = newTickOptionsCsv
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((label, i) => ({ label, checked: i === 0 }));
    if (parsedOptions.length === 0) return;

    const newGroup: FieldCustomTickBoxGroup = {
      id: `tbg-${Date.now()}`,
      categoryTitle: title,
      options: parsedOptions,
    };
    onUpdateRound((r) => ({
      ...r,
      customTickBoxGroups: [...(r.customTickBoxGroups || []), newGroup],
    }));
    setNewTickCategory('');
  };

  const handleWordTemplateUpload = async (file: File | undefined) => {
    if (!file) return;
    try {
      const parsed = await parseUploadedWordTemplateFile(file);
      onUpdateProject((p) => ({
        ...p,
        customWordTemplate: parsed,
      }));
      setTemplateStatus(
        `Adapted template "${parsed.fileName}" (${parsed.detectedPlaceholders.length} auto-fed & custom fields active).`
      );
    } catch {
      setTemplateStatus('Could not parse uploaded template file.');
    }
  };

  return (
    <div
      className={`min-h-0 bg-slate-900/95 border border-amber-500/40 rounded-xl p-2.5 sm:p-3 flex flex-col gap-3 overflow-y-auto touch-pan-y shadow-2xl ${className}`}
    >
      <div className="flex items-center justify-between border-b border-slate-800 pb-2 shrink-0">
        <div className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5" />
          <span>Template Edit Options</span>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] font-bold cursor-pointer"
          >
            Close ✕
          </button>
        )}
      </div>

      {/* 1. Upload Client & Contractor Logos for Report Header */}
      <div className="bg-slate-950/90 border border-slate-800 rounded-lg p-3">
        <div className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5 mb-2">
          <ImageIcon className="w-3.5 h-3.5" />
          1. Report Header Logo Position (Left &amp; Right)
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="cursor-pointer py-2 px-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-center text-xs font-semibold text-slate-200 flex flex-col items-center gap-1">
            <Upload className="w-3.5 h-3.5 text-amber-400" />
            <span>Upload Left Logo (Client)</span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleLogoUpload('left', e.target.files?.[0])}
            />
          </label>
          <label className="cursor-pointer py-2 px-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-center text-xs font-semibold text-slate-200 flex flex-col items-center gap-1">
            <Upload className="w-3.5 h-3.5 text-cyan-400" />
            <span>Upload Right Logo (Contractor)</span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleLogoUpload('right', e.target.files?.[0])}
            />
          </label>
        </div>
      </div>

      {/* 2. Add Missing Data Tick-Box Row to Page 2 */}
      <div className="bg-slate-950/90 border border-slate-800 rounded-lg p-3 space-y-2">
        <div className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5" />
          2. Add Missing Data Tick-Box to Page 2
        </div>
        <p className="text-[11px] text-slate-400">
          Need an extra tick-box row on Page 2 (e.g. Overbreak Type, Seepage Class, Blasting Quality)? Add it here and tick it directly on the sheet.
        </p>
        <input
          type="text"
          value={newTickCategory}
          onChange={(e) => setNewTickCategory(e.target.value)}
          placeholder="Category Title (e.g. Blasting Half-Cast %)"
          className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white"
        />
        <input
          type="text"
          value={newTickOptionsCsv}
          onChange={(e) => setNewTickOptionsCsv(e.target.value)}
          placeholder="Comma-separated tick options (e.g. >80%, 50-80%, <50%)"
          className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white"
        />
        <button
          type="button"
          onClick={handleAddMissingTickBoxRow}
          className="w-full py-1.5 px-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Tick-Box Row to Page 2
        </button>
      </div>

      {/* 3. Attach Custom Word Template (.docx / .doc) & Auto-Adapt */}
      <div className="bg-slate-950/90 border border-slate-800 rounded-lg p-3 space-y-2 flex-1 flex flex-col">
        <div className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5" />
          3. Upload Custom Word Template (Auto-Feed)
        </div>
        <p className="text-[11px] text-slate-400">
          Attach your site Word sheet template. Our engine detects all fields, auto-feeds mapped data, and lets you fill any unmapped fields below.
        </p>
        <label className="cursor-pointer py-2 px-3 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/50 text-cyan-300 font-bold text-xs flex items-center justify-center gap-2">
          <Upload className="w-3.5 h-3.5" />
          <span>
            {activeProject.customWordTemplate
              ? `Replace Template (${activeProject.customWordTemplate.fileName})`
              : 'Attach Custom Word Sheet Template (.docx / .doc)'}
          </span>
          <input
            type="file"
            accept=".doc,.docx,.xml,.html,.txt"
            className="hidden"
            onChange={(e) => handleWordTemplateUpload(e.target.files?.[0])}
          />
        </label>
        {templateStatus && (
          <div className="text-[11px] text-emerald-400 font-semibold">{templateStatus}</div>
        )}

        {/* Extra / Missing Template Fields Editor */}
        <div className="flex-1 overflow-y-auto space-y-1.5 pt-1 pr-1">
          {(
            activeProject.customWordTemplate?.detectedPlaceholders || [
              'Drawing_No',
              'Sheet_No',
              'Contract_Package',
              'Shift_Engineer',
              'Rock_Cover_m',
            ]
          ).map((token) => {
            const autoVal = autoDict[token] || autoDict[token.toUpperCase()];
            const customVal = activeRound.customTemplateFields?.[token] ?? '';
            return (
              <div
                key={token}
                className="bg-slate-900 border border-slate-800 rounded px-2 py-1 flex items-center justify-between gap-2 text-[11px]"
              >
                <span className="font-mono text-slate-300 truncate" title={token}>
                  {token.replace(/_/g, ' ')}
                </span>
                <input
                  type="text"
                  value={customVal || autoVal || ''}
                  onChange={(e) =>
                    onUpdateRound((r) => ({
                      ...r,
                      customTemplateFields: {
                        ...(r.customTemplateFields || {}),
                        [token]: e.target.value,
                      },
                    }))
                  }
                  placeholder="Fill missing data..."
                  className="w-36 bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 text-xs text-amber-300"
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// STAGE 5A: DEDICATED DISCONTINUITY SETS WINDOW
// Includes Custom Option for Persistence, Spacing, and Aperture + Template Edit Toggle
// ============================================================================
export const FieldDiscontinuitySetsStage: React.FC<{
  activeProject?: FieldProjectItem;
  activeLocation?: FieldTunnelLocationItem;
  activeRound: FieldExcavationRound;
  onUpdateProject?: (updater: (prev: FieldProjectItem) => FieldProjectItem) => void;
  onUpdateRound: (updater: (prev: FieldExcavationRound) => FieldExcavationRound) => void;
  onUpdateSetRecord: (
    setId: FieldJointSetId,
    patch: Partial<FieldDiscontinuitySetRecord>
  ) => void;
  onBackToStripAlign: () => void;
  onContinueToClassifications: () => void;
}> = ({
  activeProject,
  activeLocation,
  activeRound,
  onUpdateProject,
  onUpdateRound,
  onUpdateSetRecord,
  onBackToStripAlign,
  onContinueToClassifications,
}) => {
  const [showAllSets, setShowAllSets] = useState<boolean>(false);
  const [showTemplateEditor, setShowTemplateEditor] = useState<boolean>(false);

  const spacingOptionsWithCustom = useMemo(
    () => (SPACING_OPTIONS.includes('Custom') ? SPACING_OPTIONS : [...SPACING_OPTIONS, 'Custom']),
    []
  );
  const persistenceOptionsWithCustom = useMemo(
    () =>
      PERSISTENCE_OPTIONS.includes('Custom')
        ? PERSISTENCE_OPTIONS
        : [...PERSISTENCE_OPTIONS, 'Custom'],
    []
  );
  const apertureOptionsWithCustom = useMemo(
    () =>
      APERTURE_OPTIONS.includes('Custom') ? APERTURE_OPTIONS : [...APERTURE_OPTIONS, 'Custom'],
    []
  );

  const visibleSets = useMemo(() => {
    if (showAllSets) return FIELD_JOINT_SET_IDS;
    const mapped = FIELD_JOINT_SET_IDS.filter((setId) => {
      const countInSet =
        activeRound.jointTraces.filter((j) => j.setId === setId).length +
        activeRound.dipPlaneSurfaces.filter((d) => d.setId === setId).length;
      return (
        countInSet > 0 ||
        activeRound.discontinuitySets[setId]?.manualOrientationOverride ||
        activeRound.discontinuitySets[setId]?.enabled
      );
    });
    return mapped.length > 0 ? mapped : (['J1', 'J2', 'J3', 'J-Bedding', 'J-Random'] as FieldJointSetId[]);
  }, [showAllSets, activeRound.jointTraces, activeRound.dipPlaneSurfaces, activeRound.discontinuitySets]);

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-2 p-2 sm:p-3 bg-slate-950 overflow-hidden">
      {/* Top Action Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-amber-400">
            Discontinuity Sets &amp; Field Properties (Parameters)
          </span>
          <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-700/50 px-2 py-0.5 rounded">
            {activeRound.jointTraces.length} Traces • {activeRound.dipPlaneSurfaces.length} Dip Surfaces
          </span>
          <button
            type="button"
            onClick={() => setShowAllSets((s) => !s)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border cursor-pointer ${
              showAllSets
                ? 'bg-amber-500 text-slate-950 border-amber-400'
                : 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
            }`}
          >
            {showAllSets ? 'Showing All 9 Sets' : '+ Show All Sets (J1–J5, JR1–JR2, Bedding)'}
          </button>
          {activeProject && activeLocation && onUpdateProject && (
            <button
              type="button"
              onClick={() => setShowTemplateEditor((prev) => !prev)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1.5 border cursor-pointer transition-all ${
                showTemplateEditor
                  ? 'bg-amber-500 text-slate-950 border-amber-300 shadow'
                  : 'bg-slate-800 hover:bg-slate-700 text-amber-300 border-amber-500/40'
              }`}
              title="Open or close Template Edit Options (Header Logos, Missing Tick-Boxes & Custom Word Template)"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>{showTemplateEditor ? 'Close Template Edit' : 'Template Edit'}</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBackToStripAlign}
            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center gap-1 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Strip Align
          </button>
          <button
            type="button"
            onClick={onContinueToClassifications}
            className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow cursor-pointer"
          >
            <span>Next: Q, RMR &amp; GSI</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {showTemplateEditor && activeProject && activeLocation && onUpdateProject && (
        <FieldReportTemplateEditorPanel
          activeProject={activeProject}
          activeLocation={activeLocation}
          activeRound={activeRound}
          onUpdateProject={onUpdateProject}
          onUpdateRound={onUpdateRound}
          onClose={() => setShowTemplateEditor(false)}
          className="max-h-[420px] shrink-0"
        />
      )}

      {/* Main Scrollable Discontinuity Sets Table/Cards + Weathering/Strength Indices */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-2.5 pr-1">
        {visibleSets.map((setId) => {
          const rec = activeRound.discontinuitySets[setId];
          const countInSet =
            activeRound.jointTraces.filter((j) => j.setId === setId).length +
            activeRound.dipPlaneSurfaces.filter((d) => d.setId === setId).length;
          const grpColor = FIELD_JOINT_GROUP_COLORS[setId];

          const isSpacingCustom =
            rec.spacing === 'Custom' || !SPACING_OPTIONS.includes(rec.spacing);
          const isPersistenceCustom =
            rec.persistence === 'Custom' || !PERSISTENCE_OPTIONS.includes(rec.persistence);
          const isApertureCustom =
            rec.aperture === 'Custom' || !APERTURE_OPTIONS.includes(rec.aperture);

          return (
            <div
              key={setId}
              className="p-3 rounded-xl border bg-slate-900/90 border-slate-800 hover:border-slate-700 transition-all"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5 pb-2 border-b border-slate-800/80">
                <div className="flex items-center gap-2">
                  <span
                    className="px-2.5 py-0.5 rounded font-black text-xs text-white"
                    style={{ backgroundColor: grpColor.stroke }}
                  >
                    {setId}
                  </span>
                  <span className="text-xs font-semibold text-slate-300">{grpColor.label}</span>
                  <span className="text-[11px] font-mono text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                    {countInSet} mapped
                  </span>
                </div>

                {/* Dip Direction & Dip Amount Range */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1">
                    <span className="text-[10px] text-slate-400 font-bold uppercase">
                      Dip Dir (°):
                    </span>
                    <input
                      type="number"
                      min={0}
                      max={360}
                      value={rec.dipDirectionFrom ?? 0}
                      onChange={(e) =>
                        onUpdateSetRecord(setId, {
                          dipDirectionFrom: Number(e.target.value),
                          manualOrientationOverride: true,
                          enabled: true,
                        })
                      }
                      className="w-14 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-xs font-mono text-amber-300 text-center"
                    />
                    <span className="text-slate-500 text-xs">–</span>
                    <input
                      type="number"
                      min={0}
                      max={360}
                      value={rec.dipDirectionTo ?? 0}
                      onChange={(e) =>
                        onUpdateSetRecord(setId, {
                          dipDirectionTo: Number(e.target.value),
                          manualOrientationOverride: true,
                          enabled: true,
                        })
                      }
                      className="w-14 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-xs font-mono text-amber-300 text-center"
                    />
                  </div>

                  <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1">
                    <span className="text-[10px] text-slate-400 font-bold uppercase">
                      Dip Amt (°):
                    </span>
                    <input
                      type="number"
                      min={0}
                      max={90}
                      value={rec.dipAmountFrom ?? 0}
                      onChange={(e) =>
                        onUpdateSetRecord(setId, {
                          dipAmountFrom: Number(e.target.value),
                          manualOrientationOverride: true,
                          enabled: true,
                        })
                      }
                      className="w-12 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-xs font-mono text-cyan-300 text-center"
                    />
                    <span className="text-slate-500 text-xs">–</span>
                    <input
                      type="number"
                      min={0}
                      max={90}
                      value={rec.dipAmountTo ?? 0}
                      onChange={(e) =>
                        onUpdateSetRecord(setId, {
                          dipAmountTo: Number(e.target.value),
                          manualOrientationOverride: true,
                          enabled: true,
                        })
                      }
                      className="w-12 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-xs font-mono text-cyan-300 text-center"
                    />
                  </div>
                </div>
              </div>

              {/* 7 ISRM Discontinuity Parameters with Custom Inputs for Spacing, Persistence & Aperture */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 text-xs">
                {/* 1. Spacing (+ Custom Option) */}
                <div>
                  <label className="block text-[10px] font-bold uppercase text-amber-300 mb-1">
                    Spacing
                  </label>
                  <select
                    value={isSpacingCustom ? 'Custom' : rec.spacing}
                    onChange={(e) => {
                      const val = e.target.value;
                      onUpdateSetRecord(setId, {
                        spacing: val,
                        enabled: true,
                      });
                    }}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-white text-xs"
                  >
                    {spacingOptionsWithCustom.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                  {isSpacingCustom && (
                    <input
                      type="text"
                      value={
                        rec.spacingCustom ??
                        (rec.spacing !== 'Custom' ? rec.spacing : '')
                      }
                      onChange={(e) =>
                        onUpdateSetRecord(setId, {
                          spacing: 'Custom',
                          spacingCustom: e.target.value,
                          enabled: true,
                        })
                      }
                      placeholder="Custom (e.g. 15–30 cm)"
                      className="mt-1 w-full bg-slate-950 border border-amber-500/70 rounded px-2 py-1 text-[11px] font-mono text-amber-200"
                    />
                  )}
                </div>

                {/* 2. Persistence (+ Custom Option) */}
                <div>
                  <label className="block text-[10px] font-bold uppercase text-amber-300 mb-1">
                    Persistence
                  </label>
                  <select
                    value={isPersistenceCustom ? 'Custom' : rec.persistence}
                    onChange={(e) => {
                      const val = e.target.value;
                      onUpdateSetRecord(setId, {
                        persistence: val,
                        enabled: true,
                      });
                    }}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-white text-xs"
                  >
                    {persistenceOptionsWithCustom.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                  {isPersistenceCustom && (
                    <input
                      type="text"
                      value={
                        rec.persistenceCustom ??
                        (rec.persistence !== 'Custom' ? rec.persistence : '')
                      }
                      onChange={(e) =>
                        onUpdateSetRecord(setId, {
                          persistence: 'Custom',
                          persistenceCustom: e.target.value,
                          enabled: true,
                        })
                      }
                      placeholder="Custom (e.g. 4.5 m)"
                      className="mt-1 w-full bg-slate-950 border border-amber-500/70 rounded px-2 py-1 text-[11px] font-mono text-amber-200"
                    />
                  )}
                </div>

                {/* 3. Aperture (+ Custom Option) */}
                <div>
                  <label className="block text-[10px] font-bold uppercase text-amber-300 mb-1">
                    Aperture
                  </label>
                  <select
                    value={isApertureCustom ? 'Custom' : rec.aperture}
                    onChange={(e) => {
                      const val = e.target.value;
                      onUpdateSetRecord(setId, {
                        aperture: val,
                        enabled: true,
                      });
                    }}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-white text-xs"
                  >
                    {apertureOptionsWithCustom.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                  {isApertureCustom && (
                    <input
                      type="text"
                      value={
                        rec.apertureCustom ??
                        (rec.aperture !== 'Custom' ? rec.aperture : '')
                      }
                      onChange={(e) =>
                        onUpdateSetRecord(setId, {
                          aperture: 'Custom',
                          apertureCustom: e.target.value,
                          enabled: true,
                        })
                      }
                      placeholder="Custom (e.g. 1.5–3 mm)"
                      className="mt-1 w-full bg-slate-950 border border-amber-500/70 rounded px-2 py-1 text-[11px] font-mono text-amber-200"
                    />
                  )}
                </div>

                {/* 4. Roughness */}
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                    Roughness
                  </label>
                  <select
                    value={rec.roughness}
                    onChange={(e) => onUpdateSetRecord(setId, { roughness: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-white text-xs"
                  >
                    {ROUGHNESS_OPTIONS.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 5. Infilling */}
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                    Infilling
                  </label>
                  <select
                    value={rec.infilling}
                    onChange={(e) => onUpdateSetRecord(setId, { infilling: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-white text-xs"
                  >
                    {INFILLING_OPTIONS.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 6. Weathering */}
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                    Weathering
                  </label>
                  <select
                    value={rec.weathering}
                    onChange={(e) => onUpdateSetRecord(setId, { weathering: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-white text-xs"
                  >
                    {WEATHERING_OPTIONS.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 7. Groundwater */}
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                    Groundwater
                  </label>
                  <select
                    value={rec.groundwater}
                    onChange={(e) => onUpdateSetRecord(setId, { groundwater: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-white text-xs"
                  >
                    {GROUNDWATER_OPTIONS.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          );
        })}

        {/* Weathering Index (WI–WVI) & Strength Index (S1–S6) */}
        <div className="grid grid-cols-1 gap-2.5">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-2.5">
            <div className="text-xs font-bold uppercase tracking-wider text-cyan-400">
              Rock Mass Weathering &amp; Intact Strength Index
            </div>
            <div>
              <span className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                Weathering Grade (ISRM WI – WVI)
              </span>
              <div className="grid grid-cols-6 gap-1.5">
                {(
                  [
                    { id: 'WI', sub: 'Fresh' },
                    { id: 'WII', sub: 'Sl. Weath' },
                    { id: 'WIII', sub: 'Mod. Weath' },
                    { id: 'WIV', sub: 'High Weath' },
                    { id: 'WV', sub: 'Comp. Weath' },
                    { id: 'WVI', sub: 'Residual' },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onUpdateRound((r) => ({ ...r, weatheringIndex: item.id }))}
                    className={`py-1.5 px-1 rounded-lg border text-center cursor-pointer transition-all ${
                      activeRound.weatheringIndex === item.id
                        ? 'bg-amber-500 text-slate-950 border-amber-300 font-black'
                        : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="text-xs font-bold">{item.id}</div>
                    <div className="text-[9px] opacity-80">{item.sub}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                Rock Strength Index (ISRM R0/S1 – R6/S6)
              </span>
              <div className="grid grid-cols-6 gap-1.5">
                {(
                  [
                    { id: 'S1', sub: '>250 MPa' },
                    { id: 'S2', sub: '100–250' },
                    { id: 'S3', sub: '50–100' },
                    { id: 'S4', sub: '25–50' },
                    { id: 'S5', sub: '5–25 MPa' },
                    { id: 'S6', sub: '1–5 MPa' },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onUpdateRound((r) => ({ ...r, strengthIndex: item.id }))}
                    className={`py-1.5 px-1 rounded-lg border text-center cursor-pointer transition-all ${
                      activeRound.strengthIndex === item.id
                        ? 'bg-cyan-500 text-slate-950 border-cyan-300 font-black'
                        : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="text-xs font-bold">{item.id}</div>
                    <div className="text-[9px] opacity-80">{item.sub}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// STAGE 5B: DEDICATED Q, RMR & GSI ROCK MASS CLASSIFICATION WINDOW
// Detailed, Simply Choosable Interactive Cards for Q & RMR89 + Full 2D GSI Sheet
// ============================================================================
const Q_PARAMETER_GUIDES = {
  rqd: [
    { val: 10, label: '10%', desc: 'Very Poor (<25%)' },
    { val: 35, label: '35%', desc: 'Poor (25–50%)' },
    { val: 60, label: '60%', desc: 'Fair (50–75%)' },
    { val: 80, label: '80%', desc: 'Good (75–90%)' },
    { val: 95, label: '95%', desc: 'Excellent (90–100%)' },
  ],
  jn: [
    { val: 0.5, label: '0.5', desc: 'Massive, no or few joints' },
    { val: 2, label: '2.0', desc: 'One joint set' },
    { val: 3, label: '3.0', desc: 'One joint set + random' },
    { val: 4, label: '4.0', desc: 'Two joint sets' },
    { val: 6, label: '6.0', desc: 'Two joint sets + random' },
    { val: 9, label: '9.0', desc: 'Three joint sets' },
    { val: 12, label: '12', desc: 'Three sets + random' },
    { val: 15, label: '15', desc: 'Four or more sets, heavily jointed' },
    { val: 20, label: '20', desc: 'Crushed rock, earth-like' },
  ],
  jr: [
    { val: 4, label: '4.0', desc: 'Discontinuous joints' },
    { val: 3, label: '3.0', desc: 'Rough or irregular, undulating' },
    { val: 2, label: '2.0', desc: 'Smooth, undulating' },
    { val: 1.5, label: '1.5', desc: 'Rough or irregular, planar' },
    { val: 1.0, label: '1.0', desc: 'Smooth, planar' },
    { val: 0.5, label: '0.5', desc: 'Slickensided, planar' },
  ],
  ja: [
    { val: 0.75, label: '0.75', desc: 'Tightly healed, hard non-softening' },
    { val: 1.0, label: '1.0', desc: 'Unaltered joint walls, surface staining' },
    { val: 2.0, label: '2.0', desc: 'Slightly altered walls, non-softening' },
    { val: 3.0, label: '3.0', desc: 'Silty or sandy clay coatings' },
    { val: 4.0, label: '4.0', desc: 'Softening or low-friction clay (<1–2mm)' },
    { val: 6.0, label: '6.0', desc: 'Thick clay / shear infilling (>5mm)' },
    { val: 8.0, label: '8.0', desc: 'Swelling clay gouge' },
  ],
  jw: [
    { val: 1.0, label: '1.0', desc: 'Dry or minor inflow (<5 L/min)' },
    { val: 0.66, label: '0.66', desc: 'Medium inflow or pressure' },
    { val: 0.5, label: '0.50', desc: 'Large steady inflow, unfilled joints' },
    { val: 0.33, label: '0.33', desc: 'Large inflow with outwash of infilling' },
    { val: 0.2, label: '0.20', desc: 'Exceptionally high inflow / pressure' },
  ],
  srf: [
    { val: 1.0, label: '1.0', desc: 'Medium stress, favorable stability' },
    { val: 2.5, label: '2.5', desc: 'Single weakness zone (>50m depth) or low stress' },
    { val: 5.0, label: '5.0', desc: 'Single shear zone (<50m) or high stress' },
    { val: 7.5, label: '7.5', desc: 'Multiple weakness zones / loose rock' },
    { val: 10.0, label: '10.0', desc: 'Heavy squeezing or multiple fault zones' },
  ],
};

const RMR_PARAMETER_GUIDES = {
  ucsRating: [
    { val: 15, label: '15 pts', desc: '> 250 MPa (Extremely strong)' },
    { val: 12, label: '12 pts', desc: '100 – 250 MPa (Very strong)' },
    { val: 7, label: '7 pts', desc: '50 – 100 MPa (Strong)' },
    { val: 4, label: '4 pts', desc: '25 – 50 MPa (Medium strong)' },
    { val: 2, label: '2 pts', desc: '5 – 25 MPa (Weak)' },
    { val: 1, label: '1 pt', desc: '1 – 5 MPa (Very weak)' },
    { val: 0, label: '0 pts', desc: '< 1 MPa (Extremely weak)' },
  ],
  rqdRating: [
    { val: 20, label: '20 pts', desc: '90% – 100% RQD' },
    { val: 17, label: '17 pts', desc: '75% – 90% RQD' },
    { val: 13, label: '13 pts', desc: '50% – 75% RQD' },
    { val: 8, label: '8 pts', desc: '25% – 50% RQD' },
    { val: 3, label: '3 pts', desc: '< 25% RQD' },
  ],
  spacingRating: [
    { val: 20, label: '20 pts', desc: '> 2.0 m (Very wide)' },
    { val: 15, label: '15 pts', desc: '0.6 – 2.0 m (Wide)' },
    { val: 10, label: '10 pts', desc: '200 – 600 mm (Moderate)' },
    { val: 8, label: '8 pts', desc: '60 – 200 mm (Close)' },
    { val: 5, label: '5 pts', desc: '< 60 mm (Very close)' },
  ],
  conditionRating: [
    { val: 30, label: '30 pts', desc: 'Very rough, not continuous, tight, unweathered' },
    { val: 25, label: '25 pts', desc: 'Slightly rough, aperture <1mm, slightly weathered' },
    { val: 20, label: '20 pts', desc: 'Slightly rough, aperture <1mm, highly weathered' },
    { val: 10, label: '10 pts', desc: 'Slickensided OR gouge <5mm OR open 1–5mm' },
    { val: 0, label: '0 pts', desc: 'Soft gouge >5mm OR open >5mm continuous' },
  ],
  waterRating: [
    { val: 15, label: '15 pts', desc: 'Completely Dry' },
    { val: 10, label: '10 pts', desc: 'Damp' },
    { val: 7, label: '7 pts', desc: 'Wet' },
    { val: 4, label: '4 pts', desc: 'Dripping' },
    { val: 0, label: '0 pts', desc: 'Flowing' },
  ],
  orientationAdj: [
    { val: 0, label: '0 pts', desc: 'Very Favorable drive vs dip' },
    { val: -2, label: '-2 pts', desc: 'Favorable' },
    { val: -5, label: '-5 pts', desc: 'Fair' },
    { val: -10, label: '-10 pts', desc: 'Unfavorable' },
    { val: -12, label: '-12 pts', desc: 'Very Unfavorable' },
  ],
};

const GSI_STRUCTURES: {
  id: string;
  title: string;
  desc: string;
  baseGsiCols: [number, number, number, number, number];
}[] = [
  {
    id: 'Intact or Massive',
    title: 'INTACT OR MASSIVE',
    desc: 'Intact rock specimens or massive in-situ rock with very few widely spaced discontinuities',
    baseGsiCols: [90, 80, 70, 60, 50],
  },
  {
    id: 'Blocky',
    title: 'BLOCKY',
    desc: 'Well interlocked undisturbed rock mass consisting of cubical blocks formed by three intersecting discontinuity sets',
    baseGsiCols: [78, 68, 58, 48, 38],
  },
  {
    id: 'Very Blocky',
    title: 'VERY BLOCKY',
    desc: 'Interlocked, partially disturbed mass with multi-faceted angular blocks formed by 4 or more joint sets',
    baseGsiCols: [68, 58, 48, 38, 28],
  },
  {
    id: 'Blocky / Disturbed / Seamy',
    title: 'BLOCKY / DISTURBED / SEAMY',
    desc: 'Folded with angular blocks formed by many intersecting discontinuity sets; persistence of bedding or schistosity',
    baseGsiCols: [56, 46, 36, 27, 19],
  },
  {
    id: 'Disintegrated',
    title: 'DISINTEGRATED',
    desc: 'Poorly interlocked, heavily broken rock mass with mixture of angular and rounded rock pieces',
    baseGsiCols: [45, 36, 27, 19, 12],
  },
  {
    id: 'Laminated / Sheared',
    title: 'LAMINATED / SHEARED',
    desc: 'Lack of blockiness due to close spacing of weak schistosity or shear planes',
    baseGsiCols: [34, 26, 18, 12, 8],
  },
];

const GSI_SURFACE_COLS: {
  id: string;
  short: string;
  desc: string;
}[] = [
  {
    id: 'Very Good',
    short: 'VERY GOOD',
    desc: 'Very rough, fresh unweathered surfaces',
  },
  {
    id: 'Good',
    short: 'GOOD',
    desc: 'Rough, slightly weathered, iron-stained surfaces',
  },
  {
    id: 'Fair',
    short: 'FAIR',
    desc: 'Smooth, moderately weathered and altered surfaces',
  },
  {
    id: 'Poor',
    short: 'POOR',
    desc: 'Slickensided, highly weathered surfaces with compact coatings or angular fragments',
  },
  {
    id: 'Very Poor',
    short: 'VERY POOR',
    desc: 'Slickensided, highly weathered surfaces with soft clay coatings or fillings',
  },
];

export function buildSupportRecommendationText(
  next: FieldSupportSystemConfig,
  round?: FieldExcavationRound | null
): string {
  const parts: string[] = [`Support ${next.supportClass}:`];
  if (next.junctionFactorEnabled) {
    const jAdj = computeJunctionGeotechnicalAdjustments(next, round);
    parts.push(
      `[Junction Zone: ${next.junctionTypeLabel || 'Intersection'} (Jf=${jAdj.effectiveMultiplier}x, ∠${jAdj.junctionAngleDeg}°, Adv Factor=${jAdj.junctionAdvanceFactor}x, Rec Pull=${jAdj.recommendedAdvancePullM}m | Eff. Q=${jAdj.adjustedQ}, Eff. RMR=${jAdj.adjustedRmr})]`
    );
  }
  if (next.rockBoltsEnabled) {
    parts.push(
      `${next.rockBoltType} Rock Bolts L=${next.rockBoltLengthM}m @ ${next.rockBoltInPlaneSpacingM}m×${next.rockBoltLongitudinalSpacingM}m (${
        next.rockBoltScope === 'crown_and_wall' ? 'Crown+Wall' : 'Crown'
      })`
    );
  }
  if (next.shotcreteEnabled) {
    parts.push(
      `${next.shotcreteType} Shotcrete Crown ${next.shotcreteCrownThicknessMm}mm${
        next.shotcreteScope === 'crown_and_wall'
          ? ` / Wall ${next.shotcreteWallThicknessMm}mm`
          : ''
      }`
    );
  }
  if (next.wireMeshEnabled) {
    parts.push(
      `Wire Mesh (${next.wireMeshScope === 'crown_and_wall' ? 'Crown+Wall' : 'Crown'})`
    );
  }
  if (next.latticeGirderEnabled) {
    parts.push(`${next.latticeGirderSpec} @ ${next.latticeGirderSpacingM}m`);
  }
  if (next.ismbEnabled) {
    parts.push(`${next.ismbSpec} @ ${next.ismbSpacingM}m`);
  }
  if (next.spotBoltsEnabled && (next.spotBolts || []).length > 0) {
    parts.push(`${next.spotBolts.length} Spot Bolt(s)`);
  }
  if (next.protectionSupportEnabled) {
    const protItems: string[] = [];
    if (next.forepolingEnabled) {
      protItems.push(
        `Forepoling (${next.forepolingType || 'Rebar Spiles'} Ø${next.forepolingDiameterMm ?? 25}mm, L=${next.forepolingLengthM ?? 4.0}m, Ovlp=${next.forepolingOverlapM ?? 1.5}m @ ${next.forepolingSpacingCm ?? 30}cm c/c, ∠${next.forepolingAngleDeg ?? 10}°, ${next.forepolingSector || 'Crown Arch (120°)'})`
      );
    }
    if (next.pipeRoofingEnabled) {
      protItems.push(
        `Pipe Roofing (${next.pipeRoofingSpec || 'Perforated Steel Pipe'} Ø${next.pipeRoofingDiameterMm ?? 114}mm, L=${next.pipeRoofingLengthM ?? 12.0}m, Ovlp=${next.pipeRoofingOverlapM ?? 4.0}m @ ${next.pipeRoofingSpacingCm ?? 40}cm c/c, ∠${next.pipeRoofingAngleDeg ?? 7}°, ${next.pipeRoofingSector || 'Crown Arch (120°)'})`
      );
    }
    if (next.groutingEnabled) {
      protItems.push(
        `Grouting (${next.groutingType || 'Consolidation & Cavity Grouting'} — ${next.groutingMaterial || 'OPC Cement Grout'}, ${next.groutingHoleCount ?? 8} holes × L=${next.groutingHoleLengthM ?? 6.0}m @ ${next.groutingSpacingM ?? 1.5}m, P=${next.groutingPressureBar ?? 10} bar)`
      );
    }
    if (
      (next.protectionSupportMode === 'Cavity Support' ||
        next.protectionSupportMode === 'Protection & Cavity Support') &&
      (next.cavityDepthM || next.cavityWidthM)
    ) {
      protItems.push(
        `Cavity Treatment (${next.cavityWidthM ?? 3.5}m W × ${next.cavityDepthM ?? 1.2}m D: ${next.cavityBackfillMethod || 'SFRS Sealing + Grout Backfill'})`
      );
    }
    if (protItems.length > 0) {
      parts.push(`[${next.protectionSupportMode || 'Protection / Cavity Support'}: ${protItems.join('; ')}]`);
    }
  }
  return parts.join(' + ');
}

export const FIELD_JUNCTION_PRESETS = [
  {
    id: 'T_JUNCTION' as const,
    label: 'T-Junction',
    fullLabel: 'T-Junction (90° Intersect)',
    multiplier: 1.5,
    angleDeg: 90,
    advanceFactor: 0.7,
    description: '3-way orthogonal opening; diagonal span 1.41×, 3D stress concentration K ≈ 1.5×',
    badgeColor: 'border-amber-500/80 bg-amber-500/10 text-amber-300',
  },
  {
    id: 'CROSS_INTERSECTION' as const,
    label: '4-Way Cross',
    fullLabel: '4-Way Cross Intersection (+)',
    multiplier: 1.75,
    angleDeg: 90,
    advanceFactor: 0.6,
    description: 'Orthogonal cross opening; maximum unsupported roof corner diagonals & stress concentration',
    badgeColor: 'border-orange-500/80 bg-orange-500/10 text-orange-300',
  },
  {
    id: 'Y_BIFURCATION' as const,
    label: 'Y-Bifurcation',
    fullLabel: 'Y-Bifurcation / Fork (Branching)',
    multiplier: 2.0,
    angleDeg: 45,
    advanceFactor: 0.5,
    description: 'Acute divergence crotch pillar with critical stress peak at the bullnose wedge',
    badgeColor: 'border-rose-500/80 bg-rose-500/10 text-rose-300',
  },
  {
    id: 'CROSS_PASSAGE' as const,
    label: 'Cross-Passage',
    fullLabel: 'Cross-Passage / Niche Breakout',
    multiplier: 1.25,
    angleDeg: 90,
    advanceFactor: 0.8,
    description: 'Breakout into connecting cross-passage, refuge niche, or transformer chamber',
    badgeColor: 'border-sky-500/80 bg-sky-500/10 text-sky-300',
  },
  {
    id: 'PORTAL_BREAK_IN' as const,
    label: 'Portal Break-in',
    fullLabel: 'Portal Break-in / Shallow Junction',
    multiplier: 1.35,
    angleDeg: 90,
    advanceFactor: 0.75,
    description: 'Transition from canopy umbrella / low cover portal into standard tunnel drive',
    badgeColor: 'border-purple-500/80 bg-purple-500/10 text-purple-300',
  },
  {
    id: 'CUSTOM' as const,
    label: 'Custom',
    fullLabel: 'Custom Geotechnical Junction',
    multiplier: 1.5,
    angleDeg: 90,
    advanceFactor: 0.7,
    description: 'Custom site-specific junction factor, intersection geometry & advance pull factor',
    badgeColor: 'border-emerald-500/80 bg-emerald-500/10 text-emerald-300',
  },
];

export const FieldJunctionFactorSystemCard: React.FC<{
  support: FieldSupportSystemConfig;
  round: FieldExcavationRound;
  location?: FieldTunnelLocationItem;
  onUpdateSupport: (patch: Partial<FieldSupportSystemConfig>) => void;
  onUpdateRound?: (updater: (prev: FieldExcavationRound) => FieldExcavationRound) => void;
  onApplyClassPreset?: (cls: 'Class I' | 'Class II' | 'Class III' | 'Class IV' | 'Class V' | 'Custom') => void;
}> = ({ support, round, location, onUpdateSupport, onUpdateRound, onApplyClassPreset }) => {
  const isEnabled = Boolean(support.junctionFactorEnabled);
  const [modalOpen, setModalOpen] = useState(false);
  const [appliedMsg, setAppliedMsg] = useState<string | null>(null);

  const adj = useMemo(
    () => computeJunctionGeotechnicalAdjustments(support, round),
    [support, round]
  );

  const handleToggle = (checked: boolean) => {
    onUpdateSupport({
      junctionFactorEnabled: checked,
      ...(checked && !support.junctionType
        ? {
            junctionType: 'T_JUNCTION',
            junctionTypeLabel: 'T-Junction (90° Intersect)',
            junctionMultiplier: 1.5,
            junctionAngleDeg: 90,
            junctionAdvanceFactor: 0.7,
            junctionAdjustQ: true,
            junctionAdjustRmr: true,
          }
        : {}),
    });
  };

  const handleSelectPreset = (preset: (typeof FIELD_JUNCTION_PRESETS)[number]) => {
    onUpdateSupport({
      junctionType: preset.id,
      junctionTypeLabel: preset.fullLabel,
      junctionMultiplier: preset.multiplier,
      junctionAngleDeg: preset.angleDeg,
      junctionAdvanceFactor: preset.advanceFactor,
      junctionFactorEnabled: true,
    });
  };

  const handleAutoAdjustSupport = () => {
    const jf = Math.max(1.0, adj.effectiveMultiplier);
    const sqrtJf = Math.sqrt(jf);

    // 1. Rock Bolts: tighten spacing, increase length
    const baseInPlane = support.rockBoltInPlaneSpacingM || 1.5;
    const baseLong = support.rockBoltLongitudinalSpacingM || 1.5;
    const nextInPlane = Math.max(0.8, Number((baseInPlane / sqrtJf).toFixed(1)));
    const nextLong = Math.max(0.8, Number((baseLong / sqrtJf).toFixed(1)));
    const baseLen = support.rockBoltLengthM || 4.0;
    const nextLen = Math.min(12, Number((baseLen * 1.2).toFixed(1)));

    // 2. Shotcrete: thicken crown & wall
    const thickMultiplier = 1.0 + (jf - 1.0) * 0.5;
    const baseCrown = support.shotcreteCrownThicknessMm || 100;
    const baseWall = support.shotcreteWallThicknessMm || 75;
    const nextCrown = Math.min(350, Math.round((baseCrown * thickMultiplier) / 25) * 25);
    const nextWall = Math.min(300, Math.round((baseWall * thickMultiplier) / 25) * 25);

    // 3. Lattice Girder / ISMB
    const nextLgSpacing = support.latticeGirderEnabled
      ? Math.max(0.6, Number(((support.latticeGirderSpacingM || 1.2) / sqrtJf).toFixed(1)))
      : support.latticeGirderSpacingM;
    const nextIsmbSpacing = support.ismbEnabled
      ? Math.max(0.5, Number(((support.ismbSpacingM || 1.0) / sqrtJf).toFixed(1)))
      : support.ismbSpacingM;

    onUpdateSupport({
      rockBoltsEnabled: true,
      rockBoltInPlaneSpacingM: nextInPlane,
      rockBoltLongitudinalSpacingM: nextLong,
      rockBoltLengthM: nextLen,
      shotcreteEnabled: true,
      shotcreteCrownThicknessMm: nextCrown,
      shotcreteWallThicknessMm: nextWall,
      wireMeshEnabled: true,
      ...(support.latticeGirderEnabled ? { latticeGirderSpacingM: nextLgSpacing } : {}),
      ...(support.ismbEnabled ? { ismbSpacingM: nextIsmbSpacing } : {}),
    });

    setAppliedMsg(
      `Support adjusted for Junction: Bolts ${nextInPlane}×${nextLong}m (L=${nextLen}m), Shotcrete Crown ${nextCrown}mm / Wall ${nextWall}mm`
    );
    setTimeout(() => setAppliedMsg(null), 4500);
  };

  const handleApplyAdvancePullToRound = () => {
    if (onUpdateRound) {
      onUpdateRound((r) => ({
        ...r,
        pullLengthMeters: adj.recommendedAdvancePullM,
      }));
      setAppliedMsg(
        `Round advance pull updated to ${adj.recommendedAdvancePullM}m (Adv Factor ${adj.junctionAdvanceFactor}x, -${adj.advanceReductionPct}%)`
      );
      setTimeout(() => setAppliedMsg(null), 4500);
    }
  };

  const handleResetToBaseline = () => {
    if (onApplyClassPreset) {
      onApplyClassPreset(support.supportClass);
      setAppliedMsg(`Support parameters restored to standard ${support.supportClass} baseline`);
      setTimeout(() => setAppliedMsg(null), 4000);
    }
  };

  return (
    <div
      className={`rounded-xl border transition-all ${
        isEnabled
          ? 'bg-slate-900 border-amber-500/60 shadow-lg shadow-amber-950/20'
          : 'bg-slate-900/80 border-slate-800'
      } p-3 space-y-2.5`}
    >
      {/* Header & ON/OFF Toggle Switch */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <div
            className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
              isEnabled ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-400'
            }`}
          >
            Jf
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-amber-400">
                Junction Factor &amp; Advance Optimization
              </span>
              {isEnabled && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-black uppercase bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  {support.junctionTypeLabel || 'Active'} • Jf={adj.effectiveMultiplier}x
                </span>
              )}
            </div>
            <p className="text-[10px] text-slate-400">
              Adjust support dimensions, recall Q &amp; RMR ratings, and control safe advance pull for tunnel intersections
            </p>
          </div>
        </div>

        {/* ON / OFF Switch */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-slate-300">
            Junction Factor:
          </span>
          <button
            type="button"
            onClick={() => handleToggle(!isEnabled)}
            className={`relative inline-flex h-6 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              isEnabled ? 'bg-emerald-500' : 'bg-slate-700'
            }`}
            role="switch"
            aria-checked={isEnabled}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                isEnabled ? 'translate-x-6' : 'translate-x-0'
              }`}
            />
          </button>
          <span
            className={`text-xs font-black uppercase px-2 py-0.5 rounded ${
              isEnabled
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : 'bg-slate-800 text-slate-400 border border-slate-700'
            }`}
          >
            {isEnabled ? 'ON' : 'OFF'}
          </span>
        </div>
      </div>

      {/* Main Junction Controls (When Enabled) */}
      {isEnabled && (
        <div className="space-y-2.5 pt-0.5">
          {/* 1. Junction Presets */}
          <div>
            <div className="flex items-center justify-between text-[10.5px] font-bold text-slate-300 mb-1">
              <span>Select Geotechnical Junction Type:</span>
              <span className="text-[10px] text-amber-300/80 font-mono">
                {FIELD_JUNCTION_PRESETS.find((p) => p.id === support.junctionType)?.description || ''}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1.5">
              {FIELD_JUNCTION_PRESETS.map((p) => {
                const isSelected = (support.junctionType || 'T_JUNCTION') === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleSelectPreset(p)}
                    className={`px-2 py-1.5 rounded-lg border text-left transition-all cursor-pointer ${
                      isSelected
                        ? `${p.badgeColor} ring-1 ring-amber-400 shadow`
                        : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                    }`}
                  >
                    <div className="text-[11px] font-black">{p.label}</div>
                    <div className="text-[9.5px] font-mono opacity-80">
                      Jf={p.multiplier}x | ∠{p.angleDeg}°
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Accurate Numerical Sliders & Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-slate-950/80 border border-slate-800 rounded-lg p-2 text-xs">
            {/* Multiplier Jf */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-black uppercase text-amber-400">
                  Junction Multiplier (Jf)
                </label>
                <span className="font-mono text-xs font-black text-amber-300">
                  {adj.junctionMultiplier.toFixed(2)}x
                </span>
              </div>
              <input
                type="range"
                min={1.0}
                max={2.5}
                step={0.05}
                value={support.junctionMultiplier ?? 1.5}
                onChange={(e) =>
                  onUpdateSupport({ junctionMultiplier: Number(e.target.value) })
                }
                className="w-full accent-amber-500 cursor-pointer h-1.5 bg-slate-800 rounded"
              />
              <div className="flex items-center justify-between text-[9px] text-slate-500 font-mono">
                <span>1.0x (Straight)</span>
                <span>1.75x (Cross)</span>
                <span>2.5x (Severe)</span>
              </div>
            </div>

            {/* Intersection Angle Theta */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-black uppercase text-sky-400">
                  Intersection Angle (θ)
                </label>
                <span className="font-mono text-xs font-black text-sky-300">
                  {adj.junctionAngleDeg}°
                  {adj.junctionAngleDeg < 90 && (
                    <span className="ml-1 text-[9px] text-rose-400 font-normal">
                      (+{Math.round((adj.effectiveMultiplier / adj.junctionMultiplier - 1) * 100)}% wedge stress)
                    </span>
                  )}
                </span>
              </div>
              <input
                type="range"
                min={20}
                max={90}
                step={5}
                value={support.junctionAngleDeg ?? 90}
                onChange={(e) =>
                  onUpdateSupport({ junctionAngleDeg: Number(e.target.value) })
                }
                className="w-full accent-sky-500 cursor-pointer h-1.5 bg-slate-800 rounded"
              />
              <div className="flex items-center justify-between text-[9px] text-slate-500 font-mono">
                <span>20° (Skew Crotch)</span>
                <span>60° (Branch)</span>
                <span>90° (Tee / +)</span>
              </div>
            </div>

            {/* Junction Advance Factor */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-black uppercase text-emerald-400">
                  Junction Advance Factor
                </label>
                <span className="font-mono text-xs font-black text-emerald-300">
                  {adj.junctionAdvanceFactor.toFixed(2)}x
                </span>
              </div>
              <input
                type="range"
                min={0.4}
                max={1.0}
                step={0.05}
                value={support.junctionAdvanceFactor ?? 0.7}
                onChange={(e) =>
                  onUpdateSupport({ junctionAdvanceFactor: Number(e.target.value) })
                }
                className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-slate-800 rounded"
              />
              <div className="flex items-center justify-between text-[9px] text-slate-500 font-mono">
                <span>0.4x (Cautious)</span>
                <span>0.7x (Standard)</span>
                <span>1.0x (Full Pull)</span>
              </div>
            </div>
          </div>

          {/* 3. Recalled Geotechnical Ratings Box (Barton Q & Bieniawski RMR89 & Advance Pull) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {/* Barton Q Call & Adjustment */}
            <div className="bg-slate-950 border border-amber-500/30 rounded-lg p-2 space-y-1">
              <div className="flex items-center justify-between text-[10.5px]">
                <span className="font-black text-amber-400">Barton Q-System</span>
                <label className="inline-flex items-center gap-1 text-[9.5px] text-slate-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={support.junctionAdjustQ !== false}
                    onChange={(e) => onUpdateSupport({ junctionAdjustQ: e.target.checked })}
                    className="w-3 h-3 accent-amber-500 cursor-pointer"
                  />
                  <span>Adjust Q</span>
                </label>
              </div>
              <div className="flex items-center justify-between font-mono text-[11px]">
                <span className="text-slate-400">
                  Baseline Q: <strong className="text-slate-200">{adj.baselineQ}</strong>
                </span>
                <span className="text-amber-400 font-black">
                  → Q<sub>adj</sub>: {adj.adjustedQ}
                </span>
              </div>
              <div className="text-[9.5px] text-slate-400 truncate font-mono">
                {adj.adjustedQClass}
              </div>
            </div>

            {/* Bieniawski RMR89 Call & Adjustment */}
            <div className="bg-slate-950 border border-emerald-500/30 rounded-lg p-2 space-y-1">
              <div className="flex items-center justify-between text-[10.5px]">
                <span className="font-black text-emerald-400">Bieniawski RMR89</span>
                <label className="inline-flex items-center gap-1 text-[9.5px] text-slate-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={support.junctionAdjustRmr !== false}
                    onChange={(e) => onUpdateSupport({ junctionAdjustRmr: e.target.checked })}
                    className="w-3 h-3 accent-emerald-500 cursor-pointer"
                  />
                  <span>Adjust RMR</span>
                </label>
              </div>
              <div className="flex items-center justify-between font-mono text-[11px]">
                <span className="text-slate-400">
                  Baseline RMR: <strong className="text-slate-200">{adj.baselineRmr}</strong>
                </span>
                <span className="text-emerald-400 font-black">
                  → RMR<sub>adj</sub>: {adj.adjustedRmr} (Δ-{adj.deltaRmr})
                </span>
              </div>
              <div className="text-[9.5px] text-slate-400 truncate font-mono">
                {adj.adjustedRmrClass}
              </div>
            </div>

            {/* Junction Advance Pull Optimization */}
            <div className="bg-slate-950 border border-sky-500/30 rounded-lg p-2 space-y-1">
              <div className="flex items-center justify-between text-[10.5px]">
                <span className="font-black text-sky-400">Junction Advance Pull</span>
                <span className="text-[9.5px] font-bold text-rose-300">
                  -{adj.advanceReductionPct}% Pull
                </span>
              </div>
              <div className="flex items-center justify-between font-mono text-[11px]">
                <span className="text-slate-400">
                  Nominal: <strong className="text-slate-200">{adj.baselinePullM}m</strong>
                </span>
                <span className="text-sky-400 font-black">
                  → Rec: {adj.recommendedAdvancePullM}m
                </span>
              </div>
              <button
                type="button"
                onClick={handleApplyAdvancePullToRound}
                className="w-full mt-0.5 py-0.5 px-1.5 rounded bg-sky-950 hover:bg-sky-900 border border-sky-700/60 text-sky-200 text-[10px] font-bold cursor-pointer transition-colors"
              >
                Apply {adj.recommendedAdvancePullM}m Pull to Round
              </button>
            </div>
          </div>

          {/* 4. Action Bar: Auto-Adjust Support + Reset + Deep Analysis Modal */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleAutoAdjustSupport}
                className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow cursor-pointer transition-all"
              >
                <span>⚡ Auto-Adjust Support from Junction Factor</span>
              </button>

              <button
                type="button"
                onClick={handleResetToBaseline}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs flex items-center gap-1 cursor-pointer transition-all"
                title={`Revert spacing and thickness back to nominal ${support.supportClass} standards`}
              >
                <span>↺ Revert to Baseline</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="px-2.5 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white font-bold text-xs flex items-center gap-1 cursor-pointer transition-all"
            >
              <span>Detailed Modal Analysis</span>
            </button>
          </div>

          {/* Toast / Notification feedback */}
          {appliedMsg && (
            <div className="p-2 rounded-lg bg-emerald-950/80 border border-emerald-500/60 text-emerald-300 text-xs font-bold animate-fadeIn">
              ✓ {appliedMsg}
            </div>
          )}
        </div>
      )}

      {/* Deep-Dive Analysis Modal */}
      {modalOpen && (
        <TunnelJunctionFactorModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          defaultMainSpanM={location?.widthM || 8.5}
          defaultBranchSpanM={(location?.widthM || 8.5) * 0.9}
          currentQVal={adj.baselineQ}
          currentRmrVal={adj.baselineRmr}
          onApplyJunctionFactor={(res) => {
            onUpdateSupport({
              junctionFactorEnabled: true,
              junctionType: res.junctionType === 'OBLIQUE_SKEW' ? 'CUSTOM' : res.junctionType,
              junctionTypeLabel: `${res.junctionType.replace(/_/g, ' ')} (${res.intersectionAngleDeg}°)`,
              junctionMultiplier: res.junctionFactorKj,
              junctionAngleDeg: res.intersectionAngleDeg,
              junctionAdvanceFactor: Number((1.0 / res.junctionFactorKj).toFixed(2)),
            });
            setModalOpen(false);
            setAppliedMsg(`Imported junction parameters from deep-dive calculator (Jf=${res.junctionFactorKj}x)`);
            setTimeout(() => setAppliedMsg(null), 4000);
          }}
        />
      )}
    </div>
  );
};

export const FieldProtectionCavitySupportDesigner: React.FC<{
  support: FieldSupportSystemConfig;
  onUpdateSupport: (patch: Partial<FieldSupportSystemConfig>) => void;
  location?: FieldTunnelLocationItem;
  round?: FieldExcavationRound;
  showLiveDrawing?: boolean;
}> = ({ support, onUpdateSupport, location, round, showLiveDrawing = false }) => {
  const isEnabled = Boolean(support.protectionSupportEnabled);
  const mode = support.protectionSupportMode || 'Protection & Cavity Support';

  return (
    <div className="bg-slate-900 border border-rose-500/40 rounded-xl p-3 space-y-3">
      {/* Header Banner: Enable Protection / Cavity Support + Mode Selector */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800">
        <div className="flex flex-wrap items-center gap-2.5">
          <label className="inline-flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isEnabled}
              onChange={(e) =>
                onUpdateSupport({
                  protectionSupportEnabled: e.target.checked,
                  forepolingEnabled:
                    e.target.checked &&
                    !support.forepolingEnabled &&
                    !support.pipeRoofingEnabled &&
                    !support.groutingEnabled
                      ? true
                      : support.forepolingEnabled,
                })
              }
              className="w-4 h-4 accent-rose-500 cursor-pointer"
            />
            <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-rose-400">
              Protection / Cavity Support Design (Forepoling, Pipe Roofing &amp; Grouting)
            </span>
          </label>

          {/* Mode Selector Pills */}
          <div className="inline-flex items-center rounded-lg bg-slate-950 border border-slate-700 p-0.5 gap-0.5">
            {(
              [
                'Protection Support',
                'Cavity Support',
                'Protection & Cavity Support',
              ] as const
            ).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() =>
                  onUpdateSupport({
                    protectionSupportEnabled: true,
                    protectionSupportMode: m,
                  })
                }
                className={`px-2.5 py-1 rounded-md text-[11px] font-black cursor-pointer transition-all ${
                  isEnabled && mode === m
                    ? 'bg-rose-500 text-slate-950 shadow'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        {/* Sub-System Quick Toggles */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() =>
              onUpdateSupport({
                protectionSupportEnabled: true,
                forepolingEnabled: !support.forepolingEnabled,
              })
            }
            className={`px-2.5 py-1 rounded-lg border text-xs font-black cursor-pointer transition-all ${
              isEnabled && support.forepolingEnabled
                ? 'bg-amber-500 text-slate-950 border-amber-300 shadow'
                : 'bg-slate-950 text-slate-400 border-slate-700 hover:text-white'
            }`}
          >
            {isEnabled && support.forepolingEnabled ? '☑' : '☐'} 1. Forepoling
          </button>
          <button
            type="button"
            onClick={() =>
              onUpdateSupport({
                protectionSupportEnabled: true,
                pipeRoofingEnabled: !support.pipeRoofingEnabled,
              })
            }
            className={`px-2.5 py-1 rounded-lg border text-xs font-black cursor-pointer transition-all ${
              isEnabled && support.pipeRoofingEnabled
                ? 'bg-cyan-500 text-slate-950 border-cyan-300 shadow'
                : 'bg-slate-950 text-slate-400 border-slate-700 hover:text-white'
            }`}
          >
            {isEnabled && support.pipeRoofingEnabled ? '☑' : '☐'} 2. Pipe Roofing
          </button>
          <button
            type="button"
            onClick={() =>
              onUpdateSupport({
                protectionSupportEnabled: true,
                groutingEnabled: !support.groutingEnabled,
              })
            }
            className={`px-2.5 py-1 rounded-lg border text-xs font-black cursor-pointer transition-all ${
              isEnabled && support.groutingEnabled
                ? 'bg-emerald-500 text-slate-950 border-emerald-300 shadow'
                : 'bg-slate-950 text-slate-400 border-slate-700 hover:text-white'
            }`}
          >
            {isEnabled && support.groutingEnabled ? '☑' : '☐'} 3. Grouting &amp; Cavity
          </button>
        </div>
      </div>

      {!isEnabled ? (
        <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-3 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-slate-400">
            Tick <strong className="text-rose-300">Protection / Cavity Support</strong> above or click any option (<strong className="text-amber-300">Forepoling</strong>, <strong className="text-cyan-300">Pipe Roofing</strong>, <strong className="text-emerald-300">Grouting</strong>) to design canopy pre-support or cavity stabilization for low Q / RMR zones, shear zones, and crown cavities.
          </span>
          <button
            type="button"
            onClick={() =>
              onUpdateSupport({
                protectionSupportEnabled: true,
                forepolingEnabled: true,
                pipeRoofingEnabled: true,
                groutingEnabled: true,
              })
            }
            className="px-3 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-400 text-slate-950 font-black text-xs cursor-pointer shrink-0"
          >
            Enable Protection / Cavity Support
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {/* 3-Column Interactive Design Grid: Forepoling | Pipe Roofing | Grouting & Cavity */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-2.5">
            {/* ==================== 1. FOREPOLING DESIGN CARD ==================== */}
            <div
              className={`rounded-xl p-3 border space-y-2.5 transition-all ${
                support.forepolingEnabled
                  ? 'bg-slate-950 border-amber-500/60'
                  : 'bg-slate-950/40 border-slate-800 opacity-75'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-amber-400">
                  1. Forepoling (Spiling Canopy)
                </span>
                <input
                  type="checkbox"
                  checked={Boolean(support.forepolingEnabled)}
                  onChange={(e) => onUpdateSupport({ forepolingEnabled: e.target.checked })}
                  className="w-4 h-4 accent-amber-500 cursor-pointer"
                />
              </div>

              {support.forepolingEnabled && (
                <div className="space-y-2 text-xs">
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">
                      Forepole / Spile Type
                    </label>
                    <select
                      value={support.forepolingType ?? 'Grouted Rebar Spiles (25–32mm)'}
                      onChange={(e) => onUpdateSupport({ forepolingType: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white"
                    >
                      <option value="Grouted Rebar Spiles (25–32mm)">
                        Grouted Rebar Spiles (25–32mm)
                      </option>
                      <option value="Self-Drilling Anchor (SDA) Spiles">
                        Self-Drilling Anchor (SDA) Spiles
                      </option>
                      <option value="Perforated Steel Pipe Forepoles">
                        Perforated Steel Pipe Forepoles
                      </option>
                      <option value="Swellex / Split-Set Forepoles">
                        Swellex / Split-Set Forepoles
                      </option>
                    </select>
                  </div>

                  {/* Diameter Quick Selector + Input */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] text-slate-400">Bar / Pipe Dia (mm)</span>
                      <div className="flex items-center gap-1">
                        {[25, 28, 32, 38, 51].map((d) => (
                          <button
                            key={d}
                            type="button"
                            onClick={() => onUpdateSupport({ forepolingDiameterMm: d })}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border cursor-pointer ${
                              (support.forepolingDiameterMm ?? 25) === d
                                ? 'bg-amber-500 text-slate-950 border-amber-300'
                                : 'bg-slate-900 text-slate-300 border-slate-800'
                            }`}
                          >
                            Ø{d}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] text-slate-400">Length L (m)</label>
                      <input
                        type="number"
                        step={0.5}
                        min={1.5}
                        max={12}
                        value={support.forepolingLengthM ?? 4.0}
                        onChange={(e) =>
                          onUpdateSupport({ forepolingLengthM: Number(e.target.value) })
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 font-mono text-amber-300"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400">Overlap (m)</label>
                      <input
                        type="number"
                        step={0.5}
                        min={0.5}
                        max={6}
                        value={support.forepolingOverlapM ?? 1.5}
                        onChange={(e) =>
                          onUpdateSupport({ forepolingOverlapM: Number(e.target.value) })
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 font-mono text-amber-300"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400">Spacing c/c (cm)</label>
                      <input
                        type="number"
                        step={5}
                        min={10}
                        max={100}
                        value={support.forepolingSpacingCm ?? 30}
                        onChange={(e) =>
                          onUpdateSupport({ forepolingSpacingCm: Number(e.target.value) })
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 font-mono text-amber-300"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400">Lookout Angle (°)</label>
                      <input
                        type="number"
                        step={1}
                        min={3}
                        max={35}
                        value={support.forepolingAngleDeg ?? 10}
                        onChange={(e) =>
                          onUpdateSupport({ forepolingAngleDeg: Number(e.target.value) })
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 font-mono text-amber-300"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">
                      Canopy Sector Coverage
                    </label>
                    <select
                      value={support.forepolingSector ?? 'Crown Arch (120°)'}
                      onChange={(e) =>
                        onUpdateSupport({
                          forepolingSector: e.target
                            .value as FieldSupportSystemConfig['forepolingSector'],
                        })
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white"
                    >
                      <option value="Crown Arch (120°)">Crown Arch (120°)</option>
                      <option value="Full Crown (180°)">Full Crown (180°)</option>
                      <option value="Left Shoulder">Left Shoulder</option>
                      <option value="Right Shoulder">Right Shoulder</option>
                      <option value="Cavity Zone">Cavity Zone</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* ==================== 2. PIPE ROOFING DESIGN CARD ==================== */}
            <div
              className={`rounded-xl p-3 border space-y-2.5 transition-all ${
                support.pipeRoofingEnabled
                  ? 'bg-slate-950 border-cyan-500/60'
                  : 'bg-slate-950/40 border-slate-800 opacity-75'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-cyan-400">
                  2. Pipe Roofing (Umbrella Arch)
                </span>
                <input
                  type="checkbox"
                  checked={Boolean(support.pipeRoofingEnabled)}
                  onChange={(e) => onUpdateSupport({ pipeRoofingEnabled: e.target.checked })}
                  className="w-4 h-4 accent-cyan-500 cursor-pointer"
                />
              </div>

              {support.pipeRoofingEnabled && (
                <div className="space-y-2 text-xs">
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">
                      Pipe Roof Specification
                    </label>
                    <select
                      value={support.pipeRoofingSpec ?? 'Perforated Steel Pipe Ø114mm × 6mm'}
                      onChange={(e) => onUpdateSupport({ pipeRoofingSpec: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white"
                    >
                      <option value="Perforated Steel Pipe Ø114mm × 6mm">
                        Perforated Steel Pipe Ø114mm × 6mm
                      </option>
                      <option value="Heavy Steel Pipe Ø89mm × 5mm">
                        Heavy Steel Pipe Ø89mm × 5mm
                      </option>
                      <option value="Symmetrix Umbrella Pipe Ø139mm × 8mm">
                        Symmetrix Umbrella Pipe Ø139mm × 8mm
                      </option>
                      <option value="Micro-Pile Pipe Ø76mm × 5mm">
                        Micro-Pile Pipe Ø76mm × 5mm
                      </option>
                    </select>
                  </div>

                  {/* Pipe Diameter Quick Buttons */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] text-slate-400">Pipe Outer Dia (mm)</span>
                      <div className="flex items-center gap-1">
                        {[76, 89, 114, 139, 168].map((d) => (
                          <button
                            key={d}
                            type="button"
                            onClick={() => onUpdateSupport({ pipeRoofingDiameterMm: d })}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border cursor-pointer ${
                              (support.pipeRoofingDiameterMm ?? 114) === d
                                ? 'bg-cyan-500 text-slate-950 border-cyan-300'
                                : 'bg-slate-900 text-slate-300 border-slate-800'
                            }`}
                          >
                            Ø{d}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] text-slate-400">Pipe Length (m)</label>
                      <input
                        type="number"
                        step={1}
                        min={4}
                        max={24}
                        value={support.pipeRoofingLengthM ?? 12.0}
                        onChange={(e) =>
                          onUpdateSupport({ pipeRoofingLengthM: Number(e.target.value) })
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 font-mono text-cyan-300"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400">Overlap (m)</label>
                      <input
                        type="number"
                        step={0.5}
                        min={1}
                        max={12}
                        value={support.pipeRoofingOverlapM ?? 4.0}
                        onChange={(e) =>
                          onUpdateSupport({ pipeRoofingOverlapM: Number(e.target.value) })
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 font-mono text-cyan-300"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400">Spacing c/c (cm)</label>
                      <input
                        type="number"
                        step={5}
                        min={15}
                        max={100}
                        value={support.pipeRoofingSpacingCm ?? 40}
                        onChange={(e) =>
                          onUpdateSupport({ pipeRoofingSpacingCm: Number(e.target.value) })
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 font-mono text-cyan-300"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400">Insertion Angle (°)</label>
                      <input
                        type="number"
                        step={1}
                        min={2}
                        max={25}
                        value={support.pipeRoofingAngleDeg ?? 7}
                        onChange={(e) =>
                          onUpdateSupport({ pipeRoofingAngleDeg: Number(e.target.value) })
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 font-mono text-cyan-300"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">
                      Umbrella Sector Coverage
                    </label>
                    <select
                      value={support.pipeRoofingSector ?? 'Crown Arch (120°)'}
                      onChange={(e) =>
                        onUpdateSupport({
                          pipeRoofingSector: e.target
                            .value as FieldSupportSystemConfig['pipeRoofingSector'],
                        })
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white"
                    >
                      <option value="Crown Arch (120°)">Crown Arch (120°)</option>
                      <option value="Full Crown (180°)">Full Crown (180°)</option>
                      <option value="Left Shoulder">Left Shoulder</option>
                      <option value="Right Shoulder">Right Shoulder</option>
                      <option value="Cavity Zone">Cavity Zone</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* ==================== 3. GROUTING & CAVITY SUPPORT CARD ==================== */}
            <div
              className={`rounded-xl p-3 border space-y-2.5 transition-all ${
                support.groutingEnabled
                  ? 'bg-slate-950 border-emerald-500/60'
                  : 'bg-slate-950/40 border-slate-800 opacity-75'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-emerald-400">
                  3. Grouting &amp; Cavity Support
                </span>
                <input
                  type="checkbox"
                  checked={Boolean(support.groutingEnabled)}
                  onChange={(e) => onUpdateSupport({ groutingEnabled: e.target.checked })}
                  className="w-4 h-4 accent-emerald-500 cursor-pointer"
                />
              </div>

              {support.groutingEnabled && (
                <div className="space-y-2 text-xs">
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">
                      Grouting / Cavity Method
                    </label>
                    <select
                      value={support.groutingType ?? 'Consolidation & Cavity Backfill Grouting'}
                      onChange={(e) => onUpdateSupport({ groutingType: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white"
                    >
                      <option value="Consolidation & Cavity Backfill Grouting">
                        Consolidation &amp; Cavity Backfill Grouting
                      </option>
                      <option value="Pre-Excavation Face / Canopy Probe Grouting">
                        Pre-Excavation Face / Canopy Probe Grouting
                      </option>
                      <option value="Radial Rock Mass Consolidation Grouting">
                        Radial Rock Mass Consolidation Grouting
                      </option>
                      <option value="Crown Contact / Cavity Void Filling">
                        Crown Contact / Cavity Void Filling
                      </option>
                      <option value="Polyurethane (PU) Chemical Water-Stop Grouting">
                        Polyurethane (PU) Chemical Water-Stop Grouting
                      </option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">
                      Grout Material / Mix
                    </label>
                    <select
                      value={support.groutingMaterial ?? 'OPC Cement Grout (W:C 0.6) / PU Foam'}
                      onChange={(e) => onUpdateSupport({ groutingMaterial: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white"
                    >
                      <option value="OPC Cement Grout (W:C 0.6) / PU Foam">
                        OPC Cement Grout (W:C 0.6) / PU Foam
                      </option>
                      <option value="Microfine Cement + Sodium Silicate">
                        Microfine Cement + Sodium Silicate
                      </option>
                      <option value="Two-Component Polyurethane (PU) Resin">
                        Two-Component Polyurethane (PU) Resin
                      </option>
                      <option value="Foamed Concrete + Cement Grout Backfill">
                        Foamed Concrete + Cement Grout Backfill
                      </option>
                      <option value="Colloidal Silica / Acrylic Gel">
                        Colloidal Silica / Acrylic Gel
                      </option>
                    </select>
                  </div>

                  <div className="grid grid-cols-4 gap-1.5">
                    <div>
                      <label className="block text-[9.5px] text-slate-400">Depth (m)</label>
                      <input
                        type="number"
                        step={0.5}
                        min={1}
                        max={25}
                        value={support.groutingHoleLengthM ?? 6.0}
                        onChange={(e) =>
                          onUpdateSupport({ groutingHoleLengthM: Number(e.target.value) })
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-1 font-mono text-emerald-300"
                      />
                    </div>
                    <div>
                      <label className="block text-[9.5px] text-slate-400">Holes</label>
                      <input
                        type="number"
                        step={1}
                        min={1}
                        max={40}
                        value={support.groutingHoleCount ?? 8}
                        onChange={(e) =>
                          onUpdateSupport({ groutingHoleCount: Number(e.target.value) })
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-1 font-mono text-emerald-300"
                      />
                    </div>
                    <div>
                      <label className="block text-[9.5px] text-slate-400">Spac (m)</label>
                      <input
                        type="number"
                        step={0.25}
                        min={0.5}
                        max={5}
                        value={support.groutingSpacingM ?? 1.5}
                        onChange={(e) =>
                          onUpdateSupport({ groutingSpacingM: Number(e.target.value) })
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-1 font-mono text-emerald-300"
                      />
                    </div>
                    <div>
                      <label className="block text-[9.5px] text-slate-400">Press (bar)</label>
                      <input
                        type="number"
                        step={1}
                        min={1}
                        max={60}
                        value={support.groutingPressureBar ?? 10}
                        onChange={(e) =>
                          onUpdateSupport({ groutingPressureBar: Number(e.target.value) })
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-1 font-mono text-emerald-300"
                      />
                    </div>
                  </div>

                  {/* Cavity Support Geometry & Backfill */}
                  <div className="pt-1.5 border-t border-slate-800 space-y-1.5">
                    <div className="text-[10px] font-black uppercase text-rose-300">
                      Cavity / Overbreak Support Geometry
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[9.5px] text-slate-400">
                          Cavity Width (m)
                        </label>
                        <input
                          type="number"
                          step={0.25}
                          min={0.5}
                          max={12}
                          value={support.cavityWidthM ?? 3.5}
                          onChange={(e) =>
                            onUpdateSupport({ cavityWidthM: Number(e.target.value) })
                          }
                          className="w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-1 font-mono text-rose-300"
                        />
                      </div>
                      <div>
                        <label className="block text-[9.5px] text-slate-400">
                          Cavity Height / Depth (m)
                        </label>
                        <input
                          type="number"
                          step={0.25}
                          min={0.25}
                          max={10}
                          value={support.cavityDepthM ?? 1.2}
                          onChange={(e) =>
                            onUpdateSupport({ cavityDepthM: Number(e.target.value) })
                          }
                          className="w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-1 font-mono text-rose-300"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[9.5px] text-slate-400 mb-0.5">
                        Cavity Stabilization / Backfill Method
                      </label>
                      <select
                        value={
                          support.cavityBackfillMethod ??
                          'SFRS Sealing Arch + Foamed Concrete / Cement Grout Backfill'
                        }
                        onChange={(e) =>
                          onUpdateSupport({ cavityBackfillMethod: e.target.value })
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white"
                      >
                        <option value="SFRS Sealing Arch + Foamed Concrete / Cement Grout Backfill">
                          SFRS Sealing Arch + Foamed Concrete / Cement Grout Backfill
                        </option>
                        <option value="ISMB / Timber Cribbing Chock + Pipe Roof & Grout Fill">
                          ISMB / Timber Cribbing Chock + Pipe Roof &amp; Grout Fill
                        </option>
                        <option value="PU Chemical Foam Cavity Fill + Wire Mesh & SFRS">
                          PU Chemical Foam Cavity Fill + Wire Mesh &amp; SFRS
                        </option>
                        <option value="HSL / Lean Concrete Arch Backfill + Breather & Grout Pipes">
                          HSL / Lean Concrete Arch Backfill + Breather &amp; Grout Pipes
                        </option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Optional Live 2D Cross-Section Preview when designing inside Q / RMR / GSI stage */}
          {showLiveDrawing && location && (
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-black uppercase tracking-wider text-amber-400">
                  Live 2D Protection / Cavity Support Cross-Section Preview (Forepoling • Pipe Roofing • Grouting)
                </span>
                <span className="text-[10.5px] font-mono text-rose-300">
                  {support.protectionSupportMode || 'Protection & Cavity Support'}
                </span>
              </div>
              <FieldSupportSystem2DDrawingSvg
                location={location}
                round={round}
                support={support}
                compact={true}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const FieldRockMassClassificationsStage: React.FC<{
  activeLocation?: FieldTunnelLocationItem;
  activeRound: FieldExcavationRound;
  mappingDomain?: MappingDomainType;
  surfaceParams?: SurfaceGeometryParameters;
  onUpdateRound: (updater: (prev: FieldExcavationRound) => FieldExcavationRound) => void;
  onBackToSets: () => void;
  onContinueToSupport: () => void;
}> = ({
  activeLocation,
  activeRound,
  mappingDomain,
  surfaceParams,
  onUpdateRound,
  onBackToSets,
  onContinueToSupport,
}) => {
  const isSurface = mappingDomain && mappingDomain !== 'TUNNEL';
  const isSlopeOrBench = mappingDomain === 'SLOPE' || mappingDomain === 'BENCH';
  const [activeTab, setActiveTab] = useState<'q' | 'rmr' | 'gsi'>('rmr');
  const [simpleSurfaceTab, setSimpleSurfaceTab] = useState<'simple_rmr' | 'simple_smr'>('simple_rmr');

  const qRes = computeFieldQValue(activeRound.qSystem);
  const rmrRes = computeFieldRmrValue(activeRound.rmrSystem);
  const selClass = activeRound.selectedClassifications || {
    q: true,
    rmr: true,
    gsi: true,
  };

  const updateRmrRatingParam = (patch: Partial<FieldExcavationRound['rmrSystem']>) => {
    onUpdateRound((r) => {
      const nextSys = { ...r.rmrSystem, ...patch };
      const res = computeFieldRmrValue(nextSys);
      return {
        ...r,
        rmrSystem: nextSys,
        rmrTotal: res.totalRmr,
        rmrRockClass: res.rmrClass,
      };
    });
  };

  const simpleSmrAnalysis = useMemo(() => {
    const discSetsList = activeRound.discontinuitySets
      ? Object.values(activeRound.discontinuitySets)
      : [];
    const fallbackSets =
      discSetsList.length > 0
        ? discSetsList.map((s) => ({
            id: s.setId,
            meanDip: Number((s.dipAmountFrom + s.dipAmountTo) / 2) || 45,
            meanDipDirection: Number((s.dipDirectionFrom + s.dipDirectionTo) / 2) || 120,
          }))
        : (activeRound.jointTraces || []).map((t, i) => ({
            id: t.setId || `J${i + 1}`,
            meanDip: t.dipAmount,
            meanDipDirection: t.dipDirection,
          }));
    const effSurf: SurfaceGeometryParameters = surfaceParams || {
      subType: (mappingDomain as any) || 'BENCH',
      faceStrikeDeg: ((activeRound.tunnelDriveDirection || 135) - 90 + 360) % 360,
      faceDipDirectionDeg: activeRound.tunnelDriveDirection || 135,
      faceDipAngleDeg: 65,
      exposureLengthMeters: activeRound.pullLengthMeters || 10,
      frictionAngleDeg: 33,
      excavationMethod: 'SMOOTH_BLASTING',
      benchHeightMeters: 10,
      bermWidthMeters: 5,
      crestElevationRl: 280,
      toeElevationRl: 270,
      benchNumberLabel: 'Bench 1',
      trenchDepthMeters: 2.5,
      trenchWidthMeters: 2.0,
      overburdenThicknessMeters: 0.5,
      groundwaterDepthMeters: 2,
      slopeHeightMeters: 15,
      overallSlopeAngleDeg: 65,
      numberOfBenches: 1,
      slopeCondition: 'DRY',
    };
    return evaluateSurfaceStabilityAndRomanaSmr(effSurf, rmrRes.totalRmr, fallbackSets);
  }, [surfaceParams, mappingDomain, activeRound.discontinuitySets, activeRound.jointTraces, activeRound.tunnelDriveDirection, activeRound.pullLengthMeters, rmrRes.totalRmr]);

  const support = useMemo(
    () => ({
      ...createDefaultSupportSystem(),
      ...(activeRound.supportSystem || {}),
      spotBolts: Array.isArray(activeRound.supportSystem?.spotBolts)
        ? activeRound.supportSystem.spotBolts
        : [],
    }),
    [activeRound.supportSystem]
  );

  const updateSupportFromClassifications = (patch: Partial<FieldSupportSystemConfig>) => {
    onUpdateRound((r) => {
      const curr = r.supportSystem || createDefaultSupportSystem();
      const next = { ...curr, ...patch };
      return {
        ...r,
        supportSystem: next,
        rockSupportRecommendation: buildSupportRecommendationText(next),
      };
    });
  };

  const toggleIncludeInReport = (key: 'q' | 'rmr' | 'gsi') => {
    onUpdateRound((r) => {
      const curr = r.selectedClassifications || { q: true, rmr: true, gsi: true };
      return {
        ...r,
        selectedClassifications: {
          ...curr,
          [key]: !curr[key],
        },
      };
    });
  };

  if (isSurface) {
    return (
      <div className="flex-1 min-h-0 flex flex-col gap-2 p-2 sm:p-3 bg-slate-950 overflow-hidden">
        {/* Simple RMR & SMR Top Navigation Bar */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center rounded-xl border border-slate-700 bg-slate-950 p-0.5">
              <button
                type="button"
                onClick={() => setSimpleSurfaceTab('simple_rmr')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-2 cursor-pointer transition-all ${
                  simpleSurfaceTab === 'simple_rmr'
                    ? 'bg-amber-500 text-slate-950 shadow'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <span>1. Simple Bieniawski RMR</span>
                <span className="font-mono px-2 py-0.5 rounded bg-slate-900/90 text-amber-300 text-[11px] font-bold">
                  RMR = {rmrRes.totalRmr} ({rmrRes.rmrClass})
                </span>
              </button>
              <button
                type="button"
                onClick={() => setSimpleSurfaceTab('simple_smr')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-2 cursor-pointer transition-all ${
                  simpleSurfaceTab === 'simple_smr'
                    ? 'bg-cyan-500 text-slate-950 shadow'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <span>2. Simple Romana SMR</span>
                {simpleSmrAnalysis && (
                  <span className="font-mono px-2 py-0.5 rounded bg-slate-900/90 text-cyan-300 text-[11px] font-bold">
                    SMR = {simpleSmrAnalysis.governingSmrScore} (Class {simpleSmrAnalysis.governingSmrClass})
                  </span>
                )}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onBackToSets}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center gap-1 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Sets
            </button>
            <button
              type="button"
              onClick={onContinueToSupport}
              className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow cursor-pointer"
            >
              <span>{isSlopeOrBench ? 'Next: Surface Stabilization' : 'Next: Clean Report'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-3">
          {simpleSurfaceTab === 'simple_rmr' ? (
            <div className="space-y-3">
              {/* What is Needed for RMR Guidance Banner */}
              <div className="bg-amber-950/30 border border-amber-500/40 rounded-xl p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-black uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                    <Info className="w-4 h-4 text-amber-400" />
                    <span>What is Needed for Bieniawski (1989) RMR: 5 Core Geotechnical Inputs</span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold">
                    RMRbasic: 0–100 Scale
                  </span>
                </div>
                <p className="text-[11.5px] text-slate-300 leading-relaxed font-sans">
                  To compute rock mass rating for strip logging and face mapping, five field parameters are required:
                  <strong> 1. UCS Intact Strength</strong> (laboratory UCS or field Schmidt hammer / point load index, 0–15 pts),
                  <strong> 2. RQD %</strong> (rock quality designation core recovery &gt;10cm or volumetric joint count Jv, 3–20 pts),
                  <strong> 3. Discontinuity Spacing</strong> (mean spacing between fractures along scanline, 5–20 pts),
                  <strong> 4. Discontinuity Condition</strong> (persistence, aperture &lt;1mm to &gt;5mm, surface roughness, gouge infilling, weathering, 0–30 pts), and
                  <strong> 5. Groundwater Inflow</strong> (completely dry, damp, wet, dripping, or flowing, 0–15 pts).
                </p>
              </div>

              {/* RMR Total Banner */}
              <div className="bg-slate-900 border border-amber-500/40 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-black uppercase tracking-wider text-amber-400">
                    Bieniawski (1989) Rock Mass Rating — Calculated Rating
                  </div>
                  <div className="text-xs text-slate-300 mt-0.5 font-mono">
                    RMRbasic = UCS ({activeRound.rmrSystem?.ucsRating ?? '—'}) + RQD ({activeRound.rmrSystem?.rqdRating ?? '—'}) + Spacing ({activeRound.rmrSystem?.spacingRating ?? '—'}) + Condition ({activeRound.rmrSystem?.conditionRating ?? '—'}) + Water ({activeRound.rmrSystem?.waterRating ?? '—'})
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-2xl font-black font-mono text-amber-400">
                      RMR = {rmrRes.totalRmr !== null ? rmrRes.totalRmr : 'Not Assessed'}
                    </div>
                    <div className={`text-xs font-bold ${rmrRes.totalRmr !== null ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {rmrRes.rmrClass}
                    </div>
                  </div>
                </div>
              </div>

              {/* 5 Clean RMR Parameter Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* 1. Intact Strength */}
                <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-300 uppercase">
                      1. Strength of Intact Rock (UCS)
                    </span>
                    {activeRound.rmrSystem?.ucsRating !== null && activeRound.rmrSystem?.ucsRating !== undefined ? (
                      <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono text-xs font-bold">
                        {activeRound.rmrSystem.ucsRating} / 15 pts
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-950/50 border border-amber-500/70 text-amber-300 font-mono text-[10.5px]">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                        Not Selected
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {[
                      { r: 15, label: '> 250 MPa', sub: 'Extremely Strong' },
                      { r: 12, label: '100–250 MPa', sub: 'Very Strong' },
                      { r: 7, label: '50–100 MPa', sub: 'Strong Rock' },
                      { r: 4, label: '25–50 MPa', sub: 'Medium Strong' },
                      { r: 2, label: '5–25 MPa', sub: 'Weak Rock' },
                      { r: 1, label: '< 5 MPa', sub: 'Very Weak' },
                    ].map((opt) => (
                      <button
                        key={opt.r}
                        type="button"
                        onClick={() => updateRmrRatingParam({ ucsRating: opt.r })}
                        className={`p-2 rounded-lg border text-left cursor-pointer transition-all ${
                          activeRound.rmrSystem?.ucsRating === opt.r
                            ? 'bg-amber-500 text-slate-950 border-amber-300 font-bold shadow'
                            : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="text-xs font-mono font-bold">{opt.label}</div>
                        <div className="text-[10px] opacity-80">{opt.sub} ({opt.r} pts)</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. RQD */}
                <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-cyan-300 uppercase">
                      2. Drill Core RQD (%)
                    </span>
                    {activeRound.rmrSystem?.rqdRating !== null && activeRound.rmrSystem?.rqdRating !== undefined ? (
                      <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-mono text-xs font-bold">
                        {activeRound.rmrSystem.rqdRating} / 20 pts
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-950/50 border border-amber-500/70 text-amber-300 font-mono text-[10.5px]">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                        Not Selected
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {[
                      { r: 20, label: '90–100%', sub: 'Excellent' },
                      { r: 17, label: '75–90%', sub: 'Good Quality' },
                      { r: 13, label: '50–75%', sub: 'Fair Quality' },
                      { r: 8, label: '25–50%', sub: 'Poor Quality' },
                      { r: 3, label: '< 25%', sub: 'Very Poor' },
                    ].map((opt) => (
                      <button
                        key={opt.r}
                        type="button"
                        onClick={() => updateRmrRatingParam({ rqdRating: opt.r })}
                        className={`p-2 rounded-lg border text-left cursor-pointer transition-all ${
                          activeRound.rmrSystem?.rqdRating === opt.r
                            ? 'bg-cyan-500 text-slate-950 border-cyan-300 font-bold shadow'
                            : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="text-xs font-mono font-bold">{opt.label}</div>
                        <div className="text-[10px] opacity-80">{opt.sub} ({opt.r} pts)</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3. Discontinuity Spacing */}
                <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-300 uppercase">
                      3. Spacing of Discontinuities
                    </span>
                    {activeRound.rmrSystem?.spacingRating !== null && activeRound.rmrSystem?.spacingRating !== undefined ? (
                      <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono text-xs font-bold">
                        {activeRound.rmrSystem.spacingRating} / 20 pts
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-950/50 border border-amber-500/70 text-amber-300 font-mono text-[10.5px]">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                        Not Selected
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {[
                      { r: 20, label: '> 2.0 m', sub: 'Very Wide' },
                      { r: 15, label: '0.6–2.0 m', sub: 'Wide Spacing' },
                      { r: 10, label: '200–600 mm', sub: 'Moderate' },
                      { r: 8, label: '60–200 mm', sub: 'Close' },
                      { r: 5, label: '< 60 mm', sub: 'Very Close' },
                    ].map((opt) => (
                      <button
                        key={opt.r}
                        type="button"
                        onClick={() => updateRmrRatingParam({ spacingRating: opt.r })}
                        className={`p-2 rounded-lg border text-left cursor-pointer transition-all ${
                          activeRound.rmrSystem?.spacingRating === opt.r
                            ? 'bg-emerald-500 text-slate-950 border-emerald-300 font-bold shadow'
                            : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="text-xs font-mono font-bold">{opt.label}</div>
                        <div className="text-[10px] opacity-80">{opt.sub} ({opt.r} pts)</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 4. Condition of Discontinuities */}
                <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-orange-300 uppercase">
                      4. Condition of Discontinuities
                    </span>
                    {activeRound.rmrSystem?.conditionRating !== null && activeRound.rmrSystem?.conditionRating !== undefined ? (
                      <span className="px-2 py-0.5 rounded bg-orange-500/20 text-orange-300 font-mono text-xs font-bold">
                        {activeRound.rmrSystem.conditionRating} / 30 pts
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-950/50 border border-amber-500/70 text-amber-300 font-mono text-[10.5px]">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                        Not Selected
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {[
                      { r: 30, label: 'Very Rough / Tight', sub: 'Unweathered, tight (<0.1mm)' },
                      { r: 25, label: 'Slightly Rough', sub: 'Slightly weathered, sep <1mm' },
                      { r: 20, label: 'Slightly Rough / Moderately Weathered', sub: 'Sep 1–5mm' },
                      { r: 10, label: 'Slickensided / Gouge <5mm', sub: 'Open 1–5mm' },
                      { r: 0, label: 'Soft Gouge >5mm', sub: 'Continuous open thick gouge' },
                    ].map((opt) => (
                      <button
                        key={opt.r}
                        type="button"
                        onClick={() => updateRmrRatingParam({ conditionRating: opt.r })}
                        className={`p-2 rounded-lg border text-left cursor-pointer transition-all ${
                          activeRound.rmrSystem?.conditionRating === opt.r
                            ? 'bg-orange-500 text-slate-950 border-orange-300 font-bold shadow'
                            : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="text-xs font-bold">{opt.label}</div>
                        <div className="text-[10px] opacity-80">{opt.sub} ({opt.r} pts)</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 5. Groundwater Condition */}
                <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 space-y-2 md:col-span-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-sky-300 uppercase">
                      5. Groundwater Seepage Condition
                    </span>
                    {activeRound.rmrSystem?.waterRating !== null && activeRound.rmrSystem?.waterRating !== undefined ? (
                      <span className="px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 font-mono text-xs font-bold">
                        {activeRound.rmrSystem.waterRating} / 15 pts
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-950/50 border border-amber-500/70 text-amber-300 font-mono text-[10.5px]">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                        Not Selected
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                    {[
                      { r: 15, label: 'Completely Dry', sub: 'No water or dampness' },
                      { r: 10, label: 'Damp', sub: 'Minor surface dampness' },
                      { r: 7, label: 'Wet', sub: 'Water droplets forming' },
                      { r: 4, label: 'Dripping', sub: 'Continuous water drip' },
                      { r: 0, label: 'Flowing', sub: 'Active flowing water' },
                    ].map((opt) => (
                      <button
                        key={opt.r}
                        type="button"
                        onClick={() => updateRmrRatingParam({ waterRating: opt.r })}
                        className={`p-2 rounded-lg border text-left cursor-pointer transition-all ${
                          activeRound.rmrSystem?.waterRating === opt.r
                            ? 'bg-sky-500 text-slate-950 border-sky-300 font-bold shadow'
                            : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="text-xs font-bold">{opt.label}</div>
                        <div className="text-[10px] opacity-80">{opt.sub} ({opt.r} pts)</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Simple SMR Content */
            <div className="space-y-3">
              {/* What is Needed for Romana SMR Guidance Banner */}
              <div className="bg-cyan-950/30 border border-cyan-500/40 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-black uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
                    <Info className="w-4 h-4 text-cyan-400" />
                    <span>What is Needed for Romana (1985) SMR: Rock Slope &amp; Bench Mass Rating</span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-bold">
                    Formula: SMR = RMRbasic + (F1 × F2 × F3) + F4
                  </span>
                </div>
                <p className="text-[11.5px] text-slate-300 leading-relaxed font-sans">
                  SMR adapts Bieniawski’s tunnel RMR specifically for rock slopes and quarry/mine benches by applying 4 adjustment factors:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-[11px] font-mono">
                  <div className="bg-slate-900/80 border border-slate-800 p-2 rounded-lg">
                    <div className="font-bold text-amber-300">1. Basic RMR ({rmrRes.totalRmr})</div>
                    <div className="text-slate-400 text-[10px]">Sum of UCS, RQD, Spacing, Condition, and Water</div>
                  </div>
                  <div className="bg-slate-900/80 border border-slate-800 p-2 rounded-lg">
                    <div className="font-bold text-cyan-300">2. F1 Parallelism Factor</div>
                    <div className="text-slate-400 text-[10px]">(1 - sin|αj - αs|)²: Parallel strike gives F1=1.00 (critical)</div>
                  </div>
                  <div className="bg-slate-900/80 border border-slate-800 p-2 rounded-lg">
                    <div className="font-bold text-emerald-300">3. F2 &amp; F3 Geometry</div>
                    <div className="text-slate-400 text-[10px]">F2: Joint dip (tan βj)². F3: Daylighting on slope face (-60 to 0)</div>
                  </div>
                  <div className="bg-slate-900/80 border border-slate-800 p-2 rounded-lg">
                    <div className="font-bold text-purple-300">4. F4 Excavation Method</div>
                    <div className="text-slate-400 text-[10px]">Natural +15, Presplit +10, Smooth +8, Blasting 0, Poor -8</div>
                  </div>
                </div>

                {/* Interactive Slope Orientation & Blasting Method Calibration */}
                <div className="pt-2 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] font-mono font-bold text-slate-400 mb-0.5">
                      Slope / Bench Face Dip Dir (αs)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={360}
                      value={surfaceParams?.faceDipDirectionDeg ?? activeRound.tunnelDriveDirection ?? 135}
                      onChange={(e) => {
                        const dir = Number(e.target.value) || 0;
                        onUpdateRound((r) => ({ ...r, tunnelDriveDirection: dir }));
                      }}
                      className="w-full bg-slate-950 border border-cyan-500/40 rounded px-2 py-1 text-xs font-mono font-bold text-cyan-300"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono font-bold text-slate-400 mb-0.5">
                      Slope / Bench Face Dip Angle (βs)
                    </label>
                    <input
                      type="number"
                      min={15}
                      max={90}
                      value={surfaceParams?.faceDipAngleDeg ?? 65}
                      onChange={(e) => {
                        const dip = Number(e.target.value) || 65;
                        if (surfaceParams) {
                          surfaceParams.faceDipAngleDeg = dip;
                        }
                      }}
                      className="w-full bg-slate-950 border border-cyan-500/40 rounded px-2 py-1 text-xs font-mono font-bold text-amber-300"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono font-bold text-slate-400 mb-0.5">
                      Excavation / Blasting Method (F4)
                    </label>
                    <select
                      value={surfaceParams?.excavationMethod ?? 'SMOOTH_BLASTING'}
                      onChange={(e) => {
                        const method = e.target.value as SurfaceGeometryParameters['excavationMethod'];
                        if (surfaceParams) {
                          surfaceParams.excavationMethod = method;
                        }
                        onUpdateRound((r) => ({ ...r, modeOfExcavation: method }));
                      }}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs font-mono font-bold text-white"
                    >
                      <option value="NATURAL_SLOPE">Natural Slope (+15)</option>
                      <option value="PRESPLITTING">Presplitting (+10)</option>
                      <option value="SMOOTH_BLASTING">Smooth Blasting (+8)</option>
                      <option value="MECHANICAL">Mechanical / Normal Blasting (0)</option>
                      <option value="NORMAL_BLASTING">Deficient / Heavy Blasting (-8)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* SMR Banner */}
              {simpleSmrAnalysis && (
                <div className="bg-slate-900 border border-cyan-500/40 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-black uppercase tracking-wider text-cyan-400">
                      Romana (1985) Slope Mass Rating (SMR) — Calculated Score
                    </div>
                    <div className="text-xs text-slate-300 mt-0.5 font-mono">
                      SMR = Basic RMR ({rmrRes.totalRmr}) + Adjustment ({simpleSmrAnalysis.setChecks[0] ? (simpleSmrAnalysis.setChecks[0].f1 * simpleSmrAnalysis.setChecks[0].f2 * simpleSmrAnalysis.setChecks[0].f3) : 0}) + F4 ({simpleSmrAnalysis.setChecks[0]?.f4 ?? 0})
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-2xl font-black font-mono text-cyan-400">
                        SMR = {simpleSmrAnalysis.governingSmrScore}
                      </div>
                      <div className="text-xs font-bold text-amber-300">
                        Class {simpleSmrAnalysis.governingSmrClass} — {simpleSmrAnalysis.stabilityDescription}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Joint Set SMR Evaluation Table */}
              {simpleSmrAnalysis && (
                <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 space-y-2">
                  <div className="text-xs font-bold uppercase tracking-wider text-amber-400">
                    Kinematic Joint Sets &amp; Romana Adjustment Factors
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400 font-mono text-[11px]">
                          <th className="py-2 px-2.5">Set ID</th>
                          <th className="py-2 px-2.5">Orientation (Dip/Dir)</th>
                          <th className="py-2 px-2.5">F1 (Parallelism)</th>
                          <th className="py-2 px-2.5">F2 (Dip Angle)</th>
                          <th className="py-2 px-2.5">F3 (Relationship)</th>
                          <th className="py-2 px-2.5">F4 (Excavation)</th>
                          <th className="py-2 px-2.5">Set SMR</th>
                          <th className="py-2 px-2.5">Failure Mode</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-mono">
                        {simpleSmrAnalysis.setChecks.map((sc) => (
                          <tr key={sc.setId} className="hover:bg-slate-800/40">
                            <td className="py-2 px-2.5 font-bold text-amber-300">{sc.setId}</td>
                            <td className="py-2 px-2.5 text-white">{sc.dip}° ∠ {sc.dipDirection}°</td>
                            <td className="py-2 px-2.5 text-slate-300">{sc.f1}</td>
                            <td className="py-2 px-2.5 text-slate-300">{sc.f2}</td>
                            <td className="py-2 px-2.5 text-slate-300">{sc.f3}</td>
                            <td className="py-2 px-2.5 text-slate-300">{sc.f4 > 0 ? `+${sc.f4}` : sc.f4}</td>
                            <td className="py-2 px-2.5 font-bold text-cyan-300">
                              {sc.smrScore} (Class {sc.smrClass})
                            </td>
                            <td className="py-2 px-2.5">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  sc.governingMode === 'PLANAR'
                                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                                    : sc.governingMode === 'TOPPLING'
                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                }`}
                              >
                                {sc.governingMode}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Recommended Support Measures for SMR Class */}
              {simpleSmrAnalysis && (
                <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 space-y-1.5">
                  <div className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                    Prescribed Stabilization Measures (Romana 1985 Guidelines)
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300 leading-relaxed font-mono">
                    {simpleSmrAnalysis.recommendedSupportText}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-2 p-2 sm:p-3 bg-slate-950 overflow-hidden">
      {/* Top Classification Switcher & Navigation Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="flex flex-wrap items-center gap-2">
          {/* Tab 1: Q-System */}
          <div className="inline-flex items-center rounded-xl border border-slate-700 bg-slate-950 p-0.5">
            <button
              type="button"
              onClick={() => setActiveTab('q')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-2 cursor-pointer transition-all ${
                activeTab === 'q'
                  ? 'bg-amber-500 text-slate-950 shadow'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <span>1. Barton Q-System</span>
              <span className="font-mono px-1.5 py-0.5 rounded bg-slate-900/90 text-amber-300 text-[11px]">
                Q = {qRes.qValue !== null ? qRes.qValue : 'Not Assessed'}
              </span>
            </button>
            <button
              type="button"
              onClick={() => toggleIncludeInReport('q')}
              className={`px-2 py-1 text-[10px] font-bold rounded cursor-pointer ${
                selClass.q ? 'text-emerald-400' : 'text-slate-500'
              }`}
              title="Include Q-System in final report"
            >
              {selClass.q ? '☑ In Report' : '☐ Hidden'}
            </button>
          </div>

          {/* Tab 2: RMR89 */}
          <div className="inline-flex items-center rounded-xl border border-slate-700 bg-slate-950 p-0.5">
            <button
              type="button"
              onClick={() => setActiveTab('rmr')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-2 cursor-pointer transition-all ${
                activeTab === 'rmr'
                  ? 'bg-cyan-500 text-slate-950 shadow'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <span>2. Bieniawski RMR89</span>
              <span className="font-mono px-1.5 py-0.5 rounded bg-slate-900/90 text-cyan-300 text-[11px]">
                RMR = {rmrRes.totalRmr !== null ? rmrRes.totalRmr : 'Not Assessed'}
              </span>
            </button>
            <button
              type="button"
              onClick={() => toggleIncludeInReport('rmr')}
              className={`px-2 py-1 text-[10px] font-bold rounded cursor-pointer ${
                selClass.rmr ? 'text-emerald-400' : 'text-slate-500'
              }`}
              title="Include RMR89 in final report"
            >
              {selClass.rmr ? '☑ In Report' : '☐ Hidden'}
            </button>
          </div>

          {/* Tab 3: GSI Sheet */}
          <div className="inline-flex items-center rounded-xl border border-slate-700 bg-slate-950 p-0.5">
            <button
              type="button"
              onClick={() => setActiveTab('gsi')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-2 cursor-pointer transition-all ${
                activeTab === 'gsi'
                  ? 'bg-emerald-500 text-slate-950 shadow'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <span>3. GSI Sheet (Hoek-Brown)</span>
              <span className="font-mono px-1.5 py-0.5 rounded bg-slate-900/90 text-emerald-300 text-[11px]">
                GSI = {activeRound.gsiValue !== null && activeRound.gsiValue !== undefined ? activeRound.gsiValue : 'Not Assessed'}
              </span>
            </button>
            <button
              type="button"
              onClick={() => toggleIncludeInReport('gsi')}
              className={`px-2 py-1 text-[10px] font-bold rounded cursor-pointer ${
                selClass.gsi ? 'text-emerald-400' : 'text-slate-500'
              }`}
              title="Include GSI in final report"
            >
              {selClass.gsi ? '☑ In Report' : '☐ Hidden'}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBackToSets}
            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center gap-1 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Sets
          </button>
          <button
            type="button"
            onClick={onContinueToSupport}
            className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow cursor-pointer"
          >
            <span>Next: Support System</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 min-h-0 overflow-y-auto pr-1">
        {/* ==================== TAB 1: BARTON Q-SYSTEM INTERACTIVE CHOOSER ==================== */}
        {activeTab === 'q' && (
          <div className="space-y-3">
            {/* Live Q Formula Result Banner */}
            <div className="bg-slate-900 border border-amber-500/40 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs font-black uppercase tracking-wider text-amber-400">
                  Barton Q-System Interactive Design Matrix
                </div>
                <div className="text-xs font-mono text-slate-300 mt-0.5">
                  Q = (RQD {activeRound.qSystem?.rqd ?? '—'} / Jn {activeRound.qSystem?.jn ?? '—'}) × (Jr{' '}
                  {activeRound.qSystem?.jr ?? '—'} / Ja {activeRound.qSystem?.ja ?? '—'}) × (Jw{' '}
                  {activeRound.qSystem?.jw ?? '—'} / SRF {activeRound.qSystem?.srf ?? '—'})
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-xl font-black font-mono text-amber-400">
                    Q = {qRes.qValue !== null ? qRes.qValue : 'Not Assessed'}
                  </div>
                  <div className={`text-xs font-bold ${qRes.qValue !== null ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {qRes.rockClass}
                  </div>
                </div>
              </div>
            </div>

            {/* 6 Choosable Parameter Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5">
              {(
                [
                  {
                    key: 'rqd',
                    title: '1. RQD — Rock Quality Designation (%)',
                    step: 1,
                    min: 5,
                    max: 100,
                    options: Q_PARAMETER_GUIDES.rqd,
                  },
                  {
                    key: 'jn',
                    title: '2. Jn — Joint Set Number',
                    step: 0.5,
                    min: 0.5,
                    max: 20,
                    options: Q_PARAMETER_GUIDES.jn,
                  },
                  {
                    key: 'jr',
                    title: '3. Jr — Joint Roughness Number',
                    step: 0.5,
                    min: 0.5,
                    max: 4,
                    options: Q_PARAMETER_GUIDES.jr,
                  },
                  {
                    key: 'ja',
                    title: '4. Ja — Joint Alteration Number',
                    step: 0.25,
                    min: 0.75,
                    max: 20,
                    options: Q_PARAMETER_GUIDES.ja,
                  },
                  {
                    key: 'jw',
                    title: '5. Jw — Joint Water Reduction Factor',
                    step: 0.05,
                    min: 0.05,
                    max: 1.0,
                    options: Q_PARAMETER_GUIDES.jw,
                  },
                  {
                    key: 'srf',
                    title: '6. SRF — Stress Reduction Factor',
                    step: 0.5,
                    min: 0.5,
                    max: 20,
                    options: Q_PARAMETER_GUIDES.srf,
                  },
                ] as const
              ).map((param) => {
                const currentVal = activeRound.qSystem[param.key];
                return (
                  <div
                    key={param.key}
                    className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-col gap-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-amber-300">{param.title}</span>
                        {(currentVal === null || currentVal === undefined) && (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-950/50 border border-amber-500/70 text-amber-300 font-mono text-[10.5px]">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                            Not Selected
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-slate-400">Custom:</span>
                        <input
                          type="number"
                          step={param.step}
                          min={param.min}
                          max={param.max}
                          value={currentVal ?? ''}
                          placeholder="—"
                          onChange={(e) =>
                            onUpdateRound((r) => ({
                              ...r,
                              qSystem: {
                                ...r.qSystem,
                                [param.key]: e.target.value === '' ? null : Number(e.target.value),
                              },
                            }))
                          }
                          className="w-16 bg-slate-950 border border-amber-500/60 rounded px-1.5 py-0.5 text-xs font-mono font-bold text-amber-300 text-center"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      {param.options.map((opt) => {
                        const isSelected =
                          currentVal !== null &&
                          currentVal !== undefined &&
                          Math.abs(Number(currentVal) - opt.val) < 0.01;
                        return (
                          <button
                            key={opt.val}
                            type="button"
                            onClick={() =>
                              onUpdateRound((r) => ({
                                ...r,
                                qSystem: {
                                  ...r.qSystem,
                                  [param.key]: opt.val,
                                },
                              }))
                            }
                            className={`w-full text-left px-2.5 py-1.5 rounded-lg border text-xs flex items-center justify-between gap-2 cursor-pointer transition-all ${
                              isSelected
                                ? 'bg-amber-500 text-slate-950 border-amber-300 font-black shadow'
                                : 'bg-slate-950/80 text-slate-200 border-slate-800 hover:border-slate-600'
                            }`}
                          >
                            <span className="truncate">{opt.desc}</span>
                            <span
                              className={`font-mono px-1.5 py-0.5 rounded text-[11px] shrink-0 ${
                                isSelected
                                  ? 'bg-slate-950 text-amber-300'
                                  : 'bg-slate-900 text-amber-400'
                              }`}
                            >
                              {opt.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Protection / Cavity Support Option inside Q-System */}
            <FieldProtectionCavitySupportDesigner
              support={support}
              onUpdateSupport={updateSupportFromClassifications}
              location={activeLocation}
              round={activeRound}
              showLiveDrawing={Boolean(support.protectionSupportEnabled)}
            />
          </div>
        )}

        {/* ==================== TAB 2: BIENIAWSKI RMR89 INTERACTIVE CHOOSER ==================== */}
        {activeTab === 'rmr' && (
          <div className="space-y-3">
            {/* Live RMR89 Total Banner */}
            <div className="bg-slate-900 border border-cyan-500/40 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs font-black uppercase tracking-wider text-cyan-400">
                  Bieniawski RMR89 Interactive Rating Selector
                </div>
                <div className="text-xs font-mono text-slate-300 mt-0.5">
                  RMR89 = UCS ({activeRound.rmrSystem?.ucsRating ?? '—'}) + RQD (
                  {activeRound.rmrSystem?.rqdRating ?? '—'}) + Spacing (
                  {activeRound.rmrSystem?.spacingRating ?? '—'}) + Condition (
                  {activeRound.rmrSystem?.conditionRating ?? '—'}) + Water (
                  {activeRound.rmrSystem?.waterRating ?? '—'}) + Orientation Adj (
                  {activeRound.rmrSystem?.orientationAdj ?? '—'})
                </div>
              </div>
              <div className="text-right">
                <div className="text-xl font-black font-mono text-cyan-300">
                  RMR89 = {rmrRes.totalRmr !== null ? `${rmrRes.totalRmr} / 100` : 'Not Assessed'}
                </div>
                <div className={`text-xs font-bold ${rmrRes.totalRmr !== null ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {rmrRes.rmrClass}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5">
              {(
                [
                  {
                    key: 'ucsRating',
                    title: '1. Strength of Intact Rock (UCS / Point Load)',
                    min: 0,
                    max: 15,
                    options: RMR_PARAMETER_GUIDES.ucsRating,
                  },
                  {
                    key: 'rqdRating',
                    title: '2. Drill Core Quality RQD Rating',
                    min: 3,
                    max: 20,
                    options: RMR_PARAMETER_GUIDES.rqdRating,
                  },
                  {
                    key: 'spacingRating',
                    title: '3. Spacing of Discontinuities Rating',
                    min: 5,
                    max: 20,
                    options: RMR_PARAMETER_GUIDES.spacingRating,
                  },
                  {
                    key: 'conditionRating',
                    title: '4. Condition of Discontinuities Rating',
                    min: 0,
                    max: 30,
                    options: RMR_PARAMETER_GUIDES.conditionRating,
                  },
                  {
                    key: 'waterRating',
                    title: '5. Groundwater Inflow Condition Rating',
                    min: 0,
                    max: 15,
                    options: RMR_PARAMETER_GUIDES.waterRating,
                  },
                  {
                    key: 'orientationAdj',
                    title: '6. Strike & Dip Orientation Adjustment',
                    min: -12,
                    max: 0,
                    options: RMR_PARAMETER_GUIDES.orientationAdj,
                  },
                ] as const
              ).map((param) => {
                const currentVal = activeRound.rmrSystem?.[param.key];
                return (
                  <div
                    key={param.key}
                    className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-col gap-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-cyan-300">{param.title}</span>
                        {(currentVal === null || currentVal === undefined) && (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-950/50 border border-amber-500/70 text-amber-300 font-mono text-[10.5px]">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                            Not Selected
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-slate-400">Pts:</span>
                        <input
                          type="number"
                          min={param.min}
                          max={param.max}
                          value={currentVal ?? ''}
                          placeholder="—"
                          onChange={(e) =>
                            onUpdateRound((r) => ({
                              ...r,
                              rmrSystem: {
                                ...r.rmrSystem,
                                [param.key]: e.target.value === '' ? null : Number(e.target.value),
                              },
                            }))
                          }
                          className="w-14 bg-slate-950 border border-cyan-500/60 rounded px-1.5 py-0.5 text-xs font-mono font-bold text-cyan-300 text-center"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      {param.options.map((opt) => {
                        const isSelected =
                          currentVal !== null && currentVal !== undefined && Number(currentVal) === opt.val;
                        return (
                          <button
                            key={opt.val}
                            type="button"
                            onClick={() =>
                              onUpdateRound((r) => ({
                                ...r,
                                rmrSystem: {
                                  ...r.rmrSystem,
                                  [param.key]: opt.val,
                                },
                              }))
                            }
                            className={`w-full text-left px-2.5 py-1.5 rounded-lg border text-xs flex items-center justify-between gap-2 cursor-pointer transition-all ${
                              isSelected
                                ? 'bg-cyan-500 text-slate-950 border-cyan-300 font-black shadow'
                                : 'bg-slate-950/80 text-slate-200 border-slate-800 hover:border-slate-600'
                            }`}
                          >
                            <span className="truncate">{opt.desc}</span>
                            <span
                              className={`font-mono px-1.5 py-0.5 rounded text-[11px] shrink-0 ${
                                isSelected
                                  ? 'bg-slate-950 text-cyan-300'
                                  : 'bg-slate-900 text-cyan-400'
                              }`}
                            >
                              {opt.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Protection / Cavity Support Option inside RMR89 */}
            <FieldProtectionCavitySupportDesigner
              support={support}
              onUpdateSupport={updateSupportFromClassifications}
              location={activeLocation}
              round={activeRound}
              showLiveDrawing={Boolean(support.protectionSupportEnabled)}
            />
          </div>
        )}

        {/* ==================== TAB 3: HOEK & MARINOS INTERACTIVE 2D GSI SHEET ==================== */}
        {activeTab === 'gsi' && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-xs sm:text-sm font-black uppercase tracking-wider text-emerald-400">
                  Geological Strength Index (GSI) — Interactive Hoek &amp; Marinos Sheet
                </div>
                <p className="text-[11px] text-slate-400">
                  Click any cell in the 2D Structure × Surface Quality matrix below to select GSI, or fine-tune with the numeric slider.
                </p>
              </div>

              <div className="flex items-center gap-3 bg-slate-950 border border-emerald-500/50 rounded-xl px-3 py-1.5">
                <div>
                  <div className="text-[10px] font-bold uppercase text-slate-400">
                    Selected Structure / Surface
                  </div>
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    {activeRound.rockMassStructuralType && activeRound.surfaceQualityType ? (
                      <span>
                        {activeRound.rockMassStructuralType} • {activeRound.surfaceQualityType}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-950/50 border border-amber-500/70 text-amber-300 font-mono text-[10.5px]">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                        Not Selected
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-emerald-400">GSI =</span>
                  <input
                    type="number"
                    min={5}
                    max={95}
                    value={activeRound.gsiValue ?? ''}
                    placeholder="—"
                    onChange={(e) =>
                      onUpdateRound((r) => ({
                        ...r,
                        gsiValue: e.target.value === '' ? (null as any) : Number(e.target.value),
                      }))
                    }
                    className="w-16 bg-slate-900 border border-emerald-500 rounded px-2 py-1 text-sm font-mono font-black text-emerald-300 text-center"
                  />
                </div>
              </div>
            </div>

            {/* Interactive 2D GSI Chart Table */}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border-2 border-slate-700 text-xs">
                <thead>
                  <tr className="bg-slate-950">
                    <th className="border border-slate-700 p-2 text-left w-[26%] text-amber-300 uppercase font-black">
                      Rock Mass Structure
                      <div className="text-[10px] font-normal text-slate-400 mt-0.5">
                        (Blockiness &amp; Interlocking)
                      </div>
                    </th>
                    {GSI_SURFACE_COLS.map((col) => (
                      <th
                        key={col.id}
                        className="border border-slate-700 p-2 text-center w-[14.8%]"
                      >
                        <div className="font-black text-cyan-300 text-xs">{col.short}</div>
                        <div className="text-[9.5px] font-normal text-slate-400 mt-0.5 leading-tight">
                          {col.desc}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {GSI_STRUCTURES.map((row, rIdx) => (
                    <tr key={row.id} className="bg-slate-900/60">
                      <td className="border border-slate-700 p-2 align-middle bg-slate-950/80">
                        <div className="flex items-center gap-2">
                          {/* Mini SVG Structure Block Icon */}
                          <svg
                            viewBox="0 0 40 40"
                            className="w-9 h-9 shrink-0 bg-white rounded border border-slate-600"
                          >
                            {rIdx === 0 && (
                              <g stroke="#0f172a" strokeWidth="1.4" fill="none">
                                <line x1="8" y1="14" x2="24" y2="12" />
                                <line x1="18" y1="28" x2="34" y2="26" />
                              </g>
                            )}
                            {rIdx === 1 && (
                              <g stroke="#0f172a" strokeWidth="1.4" fill="none">
                                <line x1="0" y1="13" x2="40" y2="13" />
                                <line x1="0" y1="27" x2="40" y2="27" />
                                <line x1="14" y1="0" x2="14" y2="40" />
                                <line x1="28" y1="0" x2="28" y2="40" />
                              </g>
                            )}
                            {rIdx === 2 && (
                              <g stroke="#0f172a" strokeWidth="1.3" fill="none">
                                <line x1="0" y1="10" x2="40" y2="14" />
                                <line x1="0" y1="22" x2="40" y2="26" />
                                <line x1="0" y1="33" x2="40" y2="36" />
                                <line x1="12" y1="0" x2="8" y2="40" />
                                <line x1="25" y1="0" x2="21" y2="40" />
                                <line x1="0" y1="28" x2="36" y2="0" />
                              </g>
                            )}
                            {rIdx === 3 && (
                              <g stroke="#0f172a" strokeWidth="1.3" fill="none">
                                <path d="M0,10 Q12,4 22,12 T40,10" />
                                <path d="M0,22 Q12,16 22,24 T40,22" />
                                <path d="M0,34 Q12,28 22,36 T40,34" />
                                <line x1="14" y1="0" x2="10" y2="40" />
                                <line x1="28" y1="0" x2="24" y2="40" />
                              </g>
                            )}
                            {rIdx === 4 && (
                              <g stroke="#0f172a" strokeWidth="1.2" fill="none">
                                <polygon points="4,6 14,4 16,13 6,15" />
                                <polygon points="18,5 30,8 27,17 17,14" />
                                <circle cx="34" cy="11" r="3.5" />
                                <polygon points="6,19 18,18 20,28 8,29" />
                                <circle cx="26" cy="24" r="4" />
                                <polygon points="12,31 25,31 23,38 10,38" />
                              </g>
                            )}
                            {rIdx === 5 && (
                              <g stroke="#0f172a" strokeWidth="1.2" fill="none">
                                <path d="M0,6 C12,3 26,9 40,5" />
                                <path d="M0,12 C12,9 26,15 40,11" />
                                <path d="M0,18 C12,15 26,21 40,17" />
                                <path d="M0,24 C12,21 26,27 40,23" />
                                <path d="M0,30 C12,27 26,33 40,29" />
                                <path d="M0,36 C12,33 26,39 40,35" />
                              </g>
                            )}
                          </svg>
                          <div>
                            <div className="font-black text-amber-300 text-[11px]">
                              {row.title}
                            </div>
                            <div className="text-[9.5px] text-slate-400 leading-tight mt-0.5">
                              {row.desc}
                            </div>
                          </div>
                        </div>
                      </td>

                      {GSI_SURFACE_COLS.map((col, cIdx) => {
                        const cellGsi = row.baseGsiCols[cIdx];
                        const isBlockedCell =
                          (rIdx === 0 && cIdx >= 3) || (rIdx === 5 && cIdx === 0);
                        const isSelectedCell =
                          activeRound.rockMassStructuralType === row.id &&
                          activeRound.surfaceQualityType === col.id;

                        if (isBlockedCell) {
                          return (
                            <td
                              key={col.id}
                              className="border border-slate-800 bg-slate-950/90 text-center text-[10px] text-slate-600 italic p-2"
                            >
                              N/A
                            </td>
                          );
                        }

                        return (
                          <td
                            key={col.id}
                            onClick={() =>
                              onUpdateRound((r) => ({
                                ...r,
                                gsiValue: cellGsi,
                                rockMassStructuralType: row.id,
                                surfaceQualityType: col.id,
                              }))
                            }
                            className={`border border-slate-700 p-2 text-center cursor-pointer transition-all select-none ${
                              isSelectedCell
                                ? 'bg-emerald-500 text-slate-950 font-black ring-2 ring-amber-300 shadow-lg'
                                : 'hover:bg-slate-800 text-slate-200'
                            }`}
                          >
                            <div className="text-sm font-mono font-black">
                              GSI {cellGsi - 5}–{cellGsi + 5}
                            </div>
                            <div
                              className={`text-[10px] font-mono mt-0.5 ${
                                isSelectedCell ? 'text-slate-950 font-bold' : 'text-emerald-400'
                              }`}
                            >
                               Mid: {cellGsi}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// PROFESSIONAL 2D SUPPORT SYSTEM CROSS-SECTION DRAWING (REUSABLE IN STAGE & REPORT)
// Reflects Rock Bolts, Wire Mesh, Shotcrete (Crown / Wall thickness), Lattice Girder,
// ISMB Steel Rib, and Spot Bolts (with Pull, X, Y & Angle)
// ============================================================================
function resampleScreenPolyline(
  pts: { x: number; y: number }[],
  targetCount: number
): { x: number; y: number }[] {
  if (pts.length === 0) return [];
  if (pts.length === 1 || targetCount <= 1) return [pts[0]];
  const cum: number[] = [0];
  for (let i = 1; i < pts.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  }
  const totalLen = cum[cum.length - 1];
  if (totalLen < 1e-3) return pts;

  const out: { x: number; y: number }[] = [];
  for (let k = 0; k < targetCount; k++) {
    const d = (k / (targetCount - 1)) * totalLen;
    let seg = 0;
    while (seg < cum.length - 2 && cum[seg + 1] < d) seg++;
    const segLen = cum[seg + 1] - cum[seg];
    const t = segLen > 1e-6 ? (d - cum[seg]) / segLen : 0;
    out.push({
      x: pts[seg].x + t * (pts[seg + 1].x - pts[seg].x),
      y: pts[seg].y + t * (pts[seg + 1].y - pts[seg].y),
    });
  }
  return out;
}

function samplePointAlongPolyline(
  pts: { x: number; y: number }[],
  ratio: number
): { x: number; y: number } {
  if (pts.length === 0) return { x: 0, y: 0 };
  if (pts.length === 1) return pts[0];
  const clamped = Math.max(0, Math.min(1, ratio));
  const cum: number[] = [0];
  for (let i = 1; i < pts.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  }
  const total = cum[cum.length - 1];
  if (total < 1e-3) return pts[0];
  const d = clamped * total;
  let seg = 0;
  while (seg < cum.length - 2 && cum[seg + 1] < d) seg++;
  const segLen = cum[seg + 1] - cum[seg];
  const t = segLen > 1e-6 ? (d - cum[seg]) / segLen : 0;
  return {
    x: pts[seg].x + t * (pts[seg + 1].x - pts[seg].x),
    y: pts[seg].y + t * (pts[seg + 1].y - pts[seg].y),
  };
}

function isPointInsidePolygon2D(
  pt: { x: number; y: number },
  poly: { x: number; y: number }[]
): boolean {
  if (poly.length < 3) return false;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x;
    const yi = poly[i].y;
    const xj = poly[j].x;
    const yj = poly[j].y;
    const intersect =
      yi > pt.y !== yj > pt.y &&
      pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi + 1e-9) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export const FieldSupportSystem2DDrawingSvg: React.FC<{
  svgId?: string;
  location: FieldTunnelLocationItem;
  round?: FieldExcavationRound;
  support: FieldSupportSystemConfig;
  pullLengthM?: number;
  compact?: boolean;
  compactForReport?: boolean;
}> = ({ svgId, location, round, support, compact = false, compactForReport = false }) => {
  const isCompact = compact || compactForReport;
  const surf = useMemo(() => getLocationSurfaceConfig(location), [location]);
  const W = Math.max(1.5, surf.tunnelW || location.widthM || 8);
  const H = Math.max(1.5, surf.tunnelH || location.heightM || 7);

  // Build exact 1:1 isotropic design tunnel profile in SVG (viewBox 0 0 560 422)
  const cx = 280;
  const baseInvertY = 324;
  const scale = Math.min(336 / W, 222 / H);
  const boxW = W * scale;
  const boxH = H * scale;
  const boxX = cx - boxW / 2;
  const boxY = baseInvertY - boxH;
  const halfWpx = boxW / 2;

  const faceDetails = useMemo(
    () => computeFaceTunnelOutlineDetails(location, boxX, boxY, boxW, boxH),
    [location, boxX, boxY, boxW, boxH]
  );

  const splY = Number.isFinite(faceDetails.springY)
    ? faceDetails.springY
    : faceDetails.leftSplPt?.y ?? boxY + boxH * 0.45;
  const topCrownY = faceDetails.crownPeakPt ? faceDetails.crownPeakPt.y : boxY;
  const archRpx = Math.max(12, splY - topCrownY);
  const leftSplPt = faceDetails.leftSplPt || { x: boxX, y: splY };
  const rightSplPt = faceDetails.rightSplPt || { x: boxX + boxW, y: splY };
  const leftInvertPt =
    faceDetails.leftWallPoly.length > 0
      ? faceDetails.leftWallPoly[0]
      : { x: cx - halfWpx, y: baseInvertY };
  const rightInvertPt =
    faceDetails.rightWallPoly.length > 0
      ? faceDetails.rightWallPoly[0]
      : { x: cx + halfWpx, y: baseInvertY };

  // Build dense perimeter points with outward unit normals (nx, ny) following the exact tunnel shape
  const profilePts = useMemo(() => {
    const centerRefX = cx;
    const centerRefY = boxY + boxH * 0.56;
    const pts: {
      x: number;
      y: number;
      nx: number;
      ny: number;
      isCrown: boolean;
      zone: 'left_wall' | 'crown' | 'right_wall';
    }[] = [];

    const appendPolyWithNormals = (
      rawPoly: { x: number; y: number }[],
      targetCount: number,
      isCrown: boolean,
      zone: 'left_wall' | 'crown' | 'right_wall',
      skipFirst: boolean
    ) => {
      if (rawPoly.length < 2) return;
      const dense = resampleScreenPolyline(rawPoly, targetCount);
      for (let i = skipFirst ? 1 : 0; i < dense.length; i++) {
        const pPrev = dense[Math.max(0, i - 1)];
        const pNext = dense[Math.min(dense.length - 1, i + 1)];
        const dx = pNext.x - pPrev.x;
        const dy = pNext.y - pPrev.y;
        const len = Math.hypot(dx, dy) || 1;
        // Clockwise tangent (dx, dy) rotated 90° outward is (dy, -dx)
        let nx = dy / len;
        let ny = -dx / len;
        if (nx * (dense[i].x - centerRefX) + ny * (dense[i].y - centerRefY) < 0) {
          nx = -nx;
          ny = -ny;
        }
        pts.push({
          x: dense[i].x,
          y: dense[i].y,
          nx,
          ny,
          isCrown,
          zone,
        });
      }
    };

    if (surf.hasLeftWall && faceDetails.leftWallPoly.length >= 2) {
      appendPolyWithNormals(faceDetails.leftWallPoly, 14, false, 'left_wall', false);
    }
    if (surf.hasCrown && faceDetails.crownPoly.length >= 2) {
      appendPolyWithNormals(
        faceDetails.crownPoly,
        32,
        true,
        'crown',
        pts.length > 0
      );
    }
    if (surf.hasRightWall && faceDetails.rightWallPoly.length >= 2) {
      appendPolyWithNormals(
        faceDetails.rightWallPoly.slice().reverse(),
        14,
        false,
        'right_wall',
        pts.length > 0
      );
    }
    return pts;
  }, [faceDetails, surf.hasLeftWall, surf.hasCrown, surf.hasRightWall, cx, boxY, boxH]);

  const excavationPolyStr = useMemo(() => {
    const loopPts = [
      ...profilePts.map((p) => ({ x: p.x, y: p.y })),
      ...(surf.hasInvert && faceDetails.invertPoly.length >= 2
        ? faceDetails.invertPoly.slice().reverse()
        : []),
    ];
    if (loopPts.length < 3) {
      return `${(cx - halfWpx).toFixed(1)},${baseInvertY.toFixed(1)} ${(cx - halfWpx).toFixed(
        1
      )},${splY.toFixed(1)} ${(cx + halfWpx).toFixed(1)},${splY.toFixed(1)} ${(
        cx + halfWpx
      ).toFixed(1)},${baseInvertY.toFixed(1)}`;
    }
    return loopPts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  }, [profilePts, surf.hasInvert, faceDetails.invertPoly, cx, halfWpx, baseInvertY, splY]);

  // Shotcrete Outer Offset Polygon
  const shotcreteBandPts = useMemo(() => {
    if (!support.shotcreteEnabled) return null;
    const crownOffPx = Math.max(8, Math.min(26, (support.shotcreteCrownThicknessMm || 100) * 0.09));
    const wallOffPx =
      support.shotcreteScope === 'crown_and_wall'
        ? Math.max(6, Math.min(24, (support.shotcreteWallThicknessMm || 100) * 0.09))
        : 0;

    const filtered = profilePts.filter(
      (p) => support.shotcreteScope === 'crown_and_wall' || p.isCrown
    );
    if (filtered.length < 2) return null;
    const outer = filtered.map((p) => {
      const off = p.isCrown ? crownOffPx : wallOffPx;
      return {
        x: p.x + p.nx * off,
        y: p.y + p.ny * off,
      };
    });
    const innerRev = filtered.slice().reverse();
    return [...outer, ...innerRev]
      .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
      .join(' ');
  }, [support, profilePts]);

  // Wire Mesh Offset Path
  const wireMeshPathD = useMemo(() => {
    if (!support.wireMeshEnabled) return '';
    const filtered = profilePts.filter(
      (p) => support.wireMeshScope === 'crown_and_wall' || p.isCrown
    );
    if (filtered.length < 2) return '';
    return filtered
      .map((p, idx) => {
        const mx = p.x - p.nx * 5;
        const my = p.y - p.ny * 5;
        return `${idx === 0 ? 'M' : 'L'} ${mx.toFixed(1)} ${my.toFixed(1)}`;
      })
      .join(' ');
  }, [support.wireMeshEnabled, support.wireMeshScope, profilePts]);

  // Systematic Rock Bolts along perimeter based on spacing
  const systematicBolts = useMemo(() => {
    if (!support.rockBoltsEnabled) return [];
    const boltLenM = Math.max(1.5, support.rockBoltLengthM || 4.0);
    const boltLenPx = Math.min(82, boltLenM * scale * 0.85);
    const spacingM = Math.max(0.6, support.rockBoltInPlaneSpacingM || 1.5);
    const filtered = profilePts.filter(
      (p) => support.rockBoltScope === 'crown_and_wall' || p.isCrown
    );
    if (filtered.length < 2) return [];

    // Compute arc length in meters
    const cumM: number[] = [0];
    for (let i = 1; i < filtered.length; i++) {
      const dPx = Math.hypot(
        filtered[i].x - filtered[i - 1].x,
        filtered[i].y - filtered[i - 1].y
      );
      cumM.push(cumM[i - 1] + dPx / scale);
    }
    const totalM = cumM[cumM.length - 1];
    const count = Math.max(2, Math.min(18, Math.floor(totalM / spacingM)));
    const bolts: {
      x0: number;
      y0: number;
      x1: number;
      y1: number;
      nx: number;
      ny: number;
    }[] = [];

    for (let b = 0; b <= count; b++) {
      const targetM = (b / count) * totalM;
      // Avoid very bottom invert tips
      if (targetM < 0.35 || targetM > totalM - 0.35) continue;
      let seg = 0;
      while (seg < cumM.length - 2 && cumM[seg + 1] < targetM) seg++;
      const p = filtered[seg];
      bolts.push({
        x0: p.x,
        y0: p.y,
        x1: p.x + p.nx * boltLenPx,
        y1: p.y + p.ny * boltLenPx,
        nx: p.nx,
        ny: p.ny,
      });
    }
    return bolts;
  }, [
    support.rockBoltsEnabled,
    support.rockBoltScope,
    support.rockBoltLengthM,
    support.rockBoltInPlaneSpacingM,
    profilePts,
    scale,
  ]);

  const filterCrownSectorPts = (
    sector?: 'Crown Arch (120°)' | 'Full Crown (180°)' | 'Left Shoulder' | 'Right Shoulder' | 'Cavity Zone'
  ) => {
    const crownOnly = profilePts.filter((p) => p.isCrown);
    if (crownOnly.length === 0) return [];
    if (sector === 'Full Crown (180°)') return crownOnly;
    if (sector === 'Left Shoulder') {
      return crownOnly.filter((_, idx) => idx <= Math.ceil(crownOnly.length * 0.55));
    }
    if (sector === 'Right Shoulder') {
      return crownOnly.filter((_, idx) => idx >= Math.floor(crownOnly.length * 0.45));
    }
    if (sector === 'Cavity Zone') {
      return crownOnly.filter(
        (_, idx) => idx >= Math.floor(crownOnly.length * 0.25) && idx <= Math.ceil(crownOnly.length * 0.75)
      );
    }
    return crownOnly.filter(
      (_, idx) => idx >= Math.floor(crownOnly.length * 0.14) && idx <= Math.ceil(crownOnly.length * 0.86)
    );
  };

  const givenSupportsList = useMemo(() => {
    const list: { label: string; text: string; fill: string }[] = [];

    if (support.rockBoltsEnabled) {
      list.push({
        label: 'Rock Bolts',
        text: `${support.rockBoltType || '25mm SN Dowel'}, L=${support.rockBoltLengthM || 4.0}m @ ${support.rockBoltInPlaneSpacingM || 1.5}m × ${support.rockBoltLongitudinalSpacingM || 1.5}m (${
          support.rockBoltScope === 'crown_and_wall' ? 'Crown+Wall' : 'Crown Only'
        })`,
        fill: '#1d4ed8',
      });
    }

    if (support.shotcreteEnabled) {
      list.push({
        label: 'Shotcrete',
        text: `${support.shotcreteType || 'SFRS'} — Crown: ${support.shotcreteCrownThicknessMm || 100}mm${
          support.shotcreteScope === 'crown_and_wall'
            ? `, Wall: ${support.shotcreteWallThicknessMm || 75}mm`
            : ' (Crown Only)'
        }`,
        fill: '#0f172a',
      });
    }

    if (support.wireMeshEnabled) {
      list.push({
        label: 'Wire Mesh',
        text: `${support.wireMeshType || 'Welded Wire Mesh'} (${
          support.wireMeshScope === 'crown_and_wall' ? 'Crown+Wall' : 'Crown Only'
        })`,
        fill: '#0f766e',
      });
    }

    if (support.latticeGirderEnabled) {
      list.push({
        label: 'Lattice Girder',
        text: `${support.latticeGirderSpec || '3-Bar LG'} @ ${support.latticeGirderSpacingM || 1.2}m c/c`,
        fill: '#7c3aed',
      });
    }

    if (support.ismbEnabled) {
      list.push({
        label: 'ISMB Steel Rib',
        text: `${support.ismbSpec || 'ISMB 150'} @ ${support.ismbSpacingM || 1.0}m c/c with invert baseplates`,
        fill: '#b45309',
      });
    }

    if (support.spotBoltsEnabled && (support.spotBolts || []).length > 0) {
      list.push({
        label: 'Spot Bolts',
        text: `${support.spotBolts.length} nos (${support.spotBolts
          .map(
            (s) =>
              `${s.label}: Pull ${s.pullMeter}m, X=${s.xMeters}m, Y=${s.yMeters}m, L=${s.lengthM}m, ∠${s.angleDeg}°`
          )
          .join('; ')})`,
        fill: '#dc2626',
      });
    }

    if (support.protectionSupportEnabled) {
      const protParts: string[] = [];
      if (support.forepolingEnabled) {
        protParts.push(
          `Forepoling Ø${support.forepolingDiameterMm ?? 25}mm L=${support.forepolingLengthM ?? 4}m @ ${support.forepolingSpacingCm ?? 30}cm (∠${support.forepolingAngleDeg ?? 10}°)`
        );
      }
      if (support.pipeRoofingEnabled) {
        protParts.push(
          `Pipe Roof Ø${support.pipeRoofingDiameterMm ?? 114}mm L=${support.pipeRoofingLengthM ?? 12}m @ ${support.pipeRoofingSpacingCm ?? 40}cm`
        );
      }
      if (support.groutingEnabled) {
        protParts.push(
          `Grouting ${support.groutingHoleCount ?? 8}H × L=${support.groutingHoleLengthM ?? 6}m @ ${support.groutingPressureBar ?? 10}bar`
        );
      }
      if ((support.cavityWidthM || 0) > 0 && (support.cavityDepthM || 0) > 0) {
        protParts.push(`Cavity Backfill (${support.cavityWidthM}m W × ${support.cavityDepthM}m D)`);
      }
      if (protParts.length > 0) {
        list.push({
          label: support.protectionSupportMode || 'Protection Pre-Support',
          text: protParts.join(' | '),
          fill: '#be123c',
        });
      }
    }

    if (support.junctionFactorEnabled) {
      const jAdj = computeJunctionGeotechnicalAdjustments(support, round);
      list.push({
        label: `Junction Factor (${support.junctionTypeLabel || 'Intersection'})`,
        text: `Jf=${jAdj.effectiveMultiplier}x, ∠${jAdj.junctionAngleDeg}°, Adv Factor ${jAdj.junctionAdvanceFactor}x (Rec. Pull: ${jAdj.recommendedAdvancePullM}m) | Q: ${jAdj.baselineQ}→${jAdj.adjustedQ}, RMR: ${jAdj.baselineRmr}→${jAdj.adjustedRmr}`,
        fill: '#b45309',
      });
    }

    return list;
  }, [support, round]);

  const shapeLabel = (location.shape || 'd_shaped').replace(/_/g, ' ').toUpperCase();

  return (
    <svg
      id={svgId}
      viewBox="0 0 560 422"
      className={`w-full ${
        isCompact ? 'max-h-[305px]' : 'max-h-[395px]'
      } bg-white rounded border border-slate-900 block`}
    >
      {/* Title Banner Inside Drawing */}
      <rect
        x="8"
        y="8"
        width="544"
        height="26"
        fill="#f8fafc"
        stroke="#0f172a"
        strokeWidth="1.2"
      />
      <text
        x="280"
        y="24"
        textAnchor="middle"
        fontSize="10.2"
        fontWeight="900"
        fontFamily="IBM Plex Mono, monospace"
        fill="#0f172a"
      >
        2D SUPPORT CROSS-SECTION — {shapeLabel} ({W}m W × {H}m H | {support.supportClass.toUpperCase()})
      </text>

      {/* Junction Factor Indicator Banner */}
      {support.junctionFactorEnabled && (() => {
        const jAdj = computeJunctionGeotechnicalAdjustments(support, round);
        return (
          <g transform="translate(8, 36)">
            <rect
              x="0"
              y="0"
              width="544"
              height="18"
              fill="#78350f"
              stroke="#b45309"
              strokeWidth="1"
            />
            <text
              x="272"
              y="12.5"
              textAnchor="middle"
              fontSize="7.8"
              fontWeight="900"
              fontFamily="IBM Plex Mono, monospace"
              fill="#fef3c7"
            >
              JUNCTION ZONE ({support.junctionTypeLabel || 'INTERSECTION'} ∠{jAdj.junctionAngleDeg}°) • Jf={jAdj.effectiveMultiplier}x • ADV FACTOR={jAdj.junctionAdvanceFactor}x (REC PULL: {jAdj.recommendedAdvancePullM}m) • EFF Q={jAdj.adjustedQ} • EFF RMR={jAdj.adjustedRmr}
            </text>
          </g>
        );
      })()}

      {/* 0. PROTECTION / CAVITY SUPPORT: Cavity Pocket, Grouting Fan, Forepoling & Pipe Roofing */}
      {support.protectionSupportEnabled && (
        <g>
          {/* 0A. Crown Cavity Pocket & Backfill Zone */}
          {(support.protectionSupportMode === 'Cavity Support' ||
            support.protectionSupportMode === 'Protection & Cavity Support') &&
            (() => {
              const cavWpx = Math.min(halfWpx * 1.4, Math.max(36, (support.cavityWidthM || 3.5) * scale * 0.7));
              const cavDpx = Math.min(44, Math.max(16, (support.cavityDepthM || 1.2) * scale * 0.6));
              const cavPath = `M ${(cx - cavWpx / 2).toFixed(1)} ${(topCrownY + 8).toFixed(1)} Q ${(cx - cavWpx * 0.35).toFixed(1)} ${(topCrownY - cavDpx).toFixed(1)} ${cx.toFixed(1)} ${(topCrownY - cavDpx - 6).toFixed(1)} Q ${(cx + cavWpx * 0.35).toFixed(1)} ${(topCrownY - cavDpx).toFixed(1)} ${(cx + cavWpx / 2).toFixed(1)} ${(topCrownY + 8).toFixed(1)} Z`;
              return (
                <g>
                  <path
                    d={cavPath}
                    fill="#ffe4e6"
                    fillOpacity="0.65"
                    stroke="#e11d48"
                    strokeWidth="1.5"
                    strokeDasharray="4 2"
                  />
                  <text
                    x={cx}
                    y={Math.max(46, topCrownY - cavDpx - 8)}
                    textAnchor="middle"
                    fontSize="8.2"
                    fontWeight="900"
                    fontFamily="IBM Plex Mono, monospace"
                    fill="#be123c"
                  >
                    CAVITY SUPPORT ({support.cavityWidthM ?? 3.5}m W × {support.cavityDepthM ?? 1.2}m D — Backfill &amp; Seal)
                  </text>
                </g>
              );
            })()}

          {/* 0B. Radial Consolidation / Cavity Grouting Boreholes & Injection Bulbs */}
          {support.groutingEnabled &&
            (() => {
              const holeCount = Math.max(3, Math.min(15, support.groutingHoleCount || 8));
              const groutPts = filterCrownSectorPts('Crown Arch (120°)');
              const groutLenPx = Math.min(64, Math.max(26, (support.groutingHoleLengthM || 6) * scale * 0.42));
              const selectedGroutNodes = Array.from({ length: holeCount }, (_, i) => {
                const idx = Math.min(
                  groutPts.length - 1,
                  Math.floor((i / Math.max(1, holeCount - 1)) * (groutPts.length - 1))
                );
                return groutPts[idx];
              }).filter(Boolean);

              return (
                <g>
                  {selectedGroutNodes.map((gp, idx) => {
                    const gx1 = gp.x + gp.nx * groutLenPx;
                    const gy1 = gp.y + gp.ny * groutLenPx;
                    const gMidX = gp.x + gp.nx * (groutLenPx * 0.58);
                    const gMidY = gp.y + gp.ny * (groutLenPx * 0.58);
                    return (
                      <g key={`grout-hole-${idx}`}>
                        <line
                          x1={gp.x}
                          y1={gp.y}
                          x2={gx1}
                          y2={gy1}
                          stroke="#059669"
                          strokeWidth="1.8"
                          strokeDasharray="3 2"
                        />
                        <circle
                          cx={gMidX}
                          cy={gMidY}
                          r="4.5"
                          fill="#10b981"
                          fillOpacity="0.28"
                          stroke="#059669"
                          strokeWidth="1"
                        />
                        <circle
                          cx={gx1}
                          cy={gy1}
                          r="5.5"
                          fill="#10b981"
                          fillOpacity="0.32"
                          stroke="#059669"
                          strokeWidth="1.2"
                        />
                      </g>
                    );
                  })}
                  <text
                    x="16"
                    y="48"
                    fontSize="8.2"
                    fontWeight="900"
                    fontFamily="IBM Plex Mono, monospace"
                    fill="#047857"
                  >
                    • Grouting: {support.groutingHoleCount ?? 8}H × L={support.groutingHoleLengthM ?? 6}m @{' '}
                    {support.groutingPressureBar ?? 10}bar
                  </text>
                </g>
              );
            })()}

          {/* 0C. Forepoling Spile Canopy Arch */}
          {support.forepolingEnabled &&
            (() => {
              const fpPts = filterCrownSectorPts(support.forepolingSector);
              return (
                <g>
                  {fpPts.map((p, idx) => {
                    const sx = p.x + p.nx * 14;
                    const sy = p.y + p.ny * 14;
                    const tx = p.x + p.nx * 24;
                    const ty = p.y + p.ny * 24;
                    return (
                      <g key={`fp-spile-${idx}`}>
                        <line
                          x1={sx}
                          y1={sy}
                          x2={tx}
                          y2={ty}
                          stroke="#d97706"
                          strokeWidth="1.8"
                        />
                        <circle
                          cx={sx}
                          cy={sy}
                          r="2.6"
                          fill="#f59e0b"
                          stroke="#78350f"
                          strokeWidth="1"
                        />
                      </g>
                    );
                  })}
                  <text
                    x="544"
                    y="48"
                    textAnchor="end"
                    fontSize="8.2"
                    fontWeight="900"
                    fontFamily="IBM Plex Mono, monospace"
                    fill="#b45309"
                  >
                    • Forepoling: Ø{support.forepolingDiameterMm ?? 25}mm, L={support.forepolingLengthM ?? 4}m @{' '}
                    {support.forepolingSpacingCm ?? 30}cm (∠{support.forepolingAngleDeg ?? 10}°)
                  </text>
                </g>
              );
            })()}

          {/* 0D. Pipe Roofing Umbrella Arch */}
          {support.pipeRoofingEnabled &&
            (() => {
              const prPts = filterCrownSectorPts(support.pipeRoofingSector).filter(
                (_, idx) => idx % 2 === 0
              );
              return (
                <g>
                  {prPts.length >= 2 && (
                    <path
                      d={prPts
                        .map((p, idx) => {
                          const px = p.x + p.nx * 24;
                          const py = p.y + p.ny * 24;
                          return `${idx === 0 ? 'M' : 'L'} ${px.toFixed(1)} ${py.toFixed(1)}`;
                        })
                        .join(' ')}
                      fill="none"
                      stroke="#0284c7"
                      strokeWidth="1.5"
                      strokeDasharray="4 2"
                    />
                  )}
                  {prPts.map((p, idx) => {
                    const px = p.x + p.nx * 24;
                    const py = p.y + p.ny * 24;
                    return (
                      <g key={`pipe-roof-${idx}`}>
                        <circle
                          cx={px}
                          cy={py}
                          r="4.5"
                          fill="#bae6fd"
                          stroke="#0369a1"
                          strokeWidth="1.5"
                        />
                        <circle cx={px} cy={py} r="1.7" fill="#ffffff" />
                      </g>
                    );
                  })}
                  <text
                    x="544"
                    y="60"
                    textAnchor="end"
                    fontSize="8.2"
                    fontWeight="900"
                    fontFamily="IBM Plex Mono, monospace"
                    fill="#0369a1"
                  >
                    • Pipe Roof: Ø{support.pipeRoofingDiameterMm ?? 114}mm, L={support.pipeRoofingLengthM ?? 12}m (Ovlp{' '}
                    {support.pipeRoofingOverlapM ?? 4}m) @ {support.pipeRoofingSpacingCm ?? 40}cm
                  </text>
                </g>
              );
            })()}
        </g>
      )}

      {/* 1. Shotcrete Layer (Crown Only or Crown + Wall) */}
      {shotcreteBandPts && (
        <g>
          <polygon
            points={shotcreteBandPts}
            fill="#cbd5e1"
            stroke="#334155"
            strokeWidth="1.2"
            strokeDasharray="3 1"
          />
          <text
            x={cx}
            y={Math.max(46, topCrownY - (support.protectionSupportEnabled ? 28 : 20))}
            textAnchor="middle"
            fontSize="9.2"
            fontWeight="800"
            fontFamily="IBM Plex Mono, monospace"
            fill="#0f172a"
          >
            {support.shotcreteType} Shotcrete: Crown {support.shotcreteCrownThicknessMm}mm
            {support.shotcreteScope === 'crown_and_wall'
              ? ` / Wall ${support.shotcreteWallThicknessMm}mm`
              : ' (Crown Only)'}
          </text>
        </g>
      )}

      {/* 2. Main Tunnel Excavation Outline (Exact Tunnel Shape & Size) */}
      <polygon
        points={excavationPolyStr}
        fill="#ffffff"
        stroke={surf.isClosed ? '#0f172a' : 'none'}
        strokeWidth={surf.isClosed ? '2.4' : '0'}
      />
      {!surf.isClosed && faceDetails.wallStrokePathD && (
        <path
          d={faceDetails.wallStrokePathD}
          fill="none"
          stroke="#0f172a"
          strokeWidth="2.4"
        />
      )}

      {/* Centerline & SPL Reference Dashed Lines */}
      <line
        x1={cx}
        y1={topCrownY - 10}
        x2={cx}
        y2={baseInvertY + 10}
        stroke="#64748b"
        strokeWidth="1"
        strokeDasharray="5 3"
      />
      {location.shape !== 'rectangular' && (
        <g>
          <line
            x1={leftSplPt.x - 12}
            y1={leftSplPt.y}
            x2={rightSplPt.x + 12}
            y2={rightSplPt.y}
            stroke="#0284c7"
            strokeWidth="1.1"
            strokeDasharray="4 3"
          />
          <text
            x={leftSplPt.x - 15}
            y={leftSplPt.y + 3}
            textAnchor="end"
            fontSize="8.2"
            fontWeight="800"
            fontFamily="IBM Plex Mono, monospace"
            fill="#0284c7"
          >
            L-SPL ({surf.splHeightM}m)
          </text>
          <text
            x={rightSplPt.x + 15}
            y={rightSplPt.y + 3}
            textAnchor="start"
            fontSize="8.2"
            fontWeight="800"
            fontFamily="IBM Plex Mono, monospace"
            fill="#0284c7"
          >
            R-SPL ({surf.splHeightM}m)
          </text>
        </g>
      )}

      {/* Exact Tunnel Span (W) & Height (H) Dimension Callouts */}
      <text
        x={cx}
        y={baseInvertY + 13}
        textAnchor="middle"
        fontSize="8.4"
        fontWeight="900"
        fontFamily="IBM Plex Mono, monospace"
        fill="#334155"
      >
        Span W = {W}m | Total Height H = {H}m | Crown Arc = {surf.crownLengthM}m
      </text>

      {/* 3. Wire Mesh Layer (Dashed Green/Slate Inner Arc with Mesh Nodes) */}
      {support.wireMeshEnabled && wireMeshPathD && (
        <g>
          <path
            d={wireMeshPathD}
            fill="none"
            stroke="#0f766e"
            strokeWidth="2.2"
            strokeDasharray="5 2.5"
          />
          {profilePts
            .filter(
              (p, idx) =>
                idx % 3 === 0 && (support.wireMeshScope === 'crown_and_wall' || p.isCrown)
            )
            .map((p, idx) => (
              <rect
                key={`wm-node-${idx}`}
                x={p.x - p.nx * 5 - 2}
                y={p.y - p.ny * 5 - 2}
                width="4"
                height="4"
                fill="#0f766e"
              />
            ))}
        </g>
      )}

      {/* 4. Lattice Girder (Truss Arch Symbol Inside Profile) */}
      {support.latticeGirderEnabled && (
        <g>
          <path
            d={profilePts
              .map((p, idx) => {
                const gx = p.x - p.nx * 10;
                const gy = p.y - p.ny * 10;
                return `${idx === 0 ? 'M' : 'L'} ${gx.toFixed(1)} ${gy.toFixed(1)}`;
              })
              .join(' ')}
            fill="none"
            stroke="#7c3aed"
            strokeWidth="2"
          />
          {profilePts
            .filter((_, idx) => idx % 2 === 0)
            .map((p, idx) => (
              <circle
                key={`lg-truss-${idx}`}
                cx={p.x - p.nx * 10}
                cy={p.y - p.ny * 10}
                r="2.3"
                fill="#ffffff"
                stroke="#7c3aed"
                strokeWidth="1.5"
              />
            ))}
        </g>
      )}

      {/* 5. ISMB Steel Rib Support (Double Flange Steel Rib + Invert Baseplates) */}
      {support.ismbEnabled && (
        <g>
          <path
            d={profilePts
              .map((p, idx) => {
                const ix = p.x - p.nx * 15;
                const iy = p.y - p.ny * 15;
                return `${idx === 0 ? 'M' : 'L'} ${ix.toFixed(1)} ${iy.toFixed(1)}`;
              })
              .join(' ')}
            fill="none"
            stroke="#b45309"
            strokeWidth="3.2"
          />
          {/* Left & Right Invert Baseplates */}
          <rect
            x={leftInvertPt.x - 4}
            y={leftInvertPt.y - 4}
            width="18"
            height="6"
            fill="#b45309"
          />
          <rect
            x={rightInvertPt.x - 14}
            y={rightInvertPt.y - 4}
            width="18"
            height="6"
            fill="#b45309"
          />
        </g>
      )}

      {/* 6. Systematic Rock Bolts */}
      {systematicBolts.map((b, idx) => (
        <g key={`sys-bolt-${idx}`}>
          <line
            x1={b.x0}
            y1={b.y0}
            x2={b.x1}
            y2={b.y1}
            stroke="#1d4ed8"
            strokeWidth="2.1"
          />
          {/* Bearing Plate at Collar */}
          <circle
            cx={b.x0}
            cy={b.y0}
            r="3.2"
            fill="#1d4ed8"
            stroke="#ffffff"
            strokeWidth="1"
          />
          {/* Anchor Head */}
          <circle cx={b.x1} cy={b.y1} r="2" fill="#1d4ed8" />
        </g>
      ))}

      {/* 7. Spot Bolts (with exact X, Y, Pull & Angle Callout on Exact Tunnel Profile) */}
      {support.spotBoltsEnabled &&
        (support.spotBolts || []).map((sb, idx) => {
          const clampedXM = Math.max(-W / 2, Math.min(W / 2, sb.xMeters));
          const clampedYM = Math.max(0, Math.min(H, sb.yMeters));
          let bx0 = cx + clampedXM * scale;
          let by0 = baseInvertY - clampedYM * scale;
          let nx = clampedXM >= 0 ? 0.65 : -0.65;
          let ny = -0.75;

          if (sb.panel !== 'face' && profilePts.length > 0) {
            // Snap collar to nearest point on the corresponding zone (left_wall, crown, right_wall)
            const zoneCandidates = profilePts.filter((p) => p.zone === sb.panel);
            const searchList = zoneCandidates.length > 0 ? zoneCandidates : profilePts;
            let bestPt = searchList[0];
            let bestDist = Infinity;
            for (const cand of searchList) {
              const d = Math.hypot(cand.x - bx0, cand.y - by0);
              if (d < bestDist) {
                bestDist = d;
                bestPt = cand;
              }
            }
            if (bestPt) {
              bx0 = bestPt.x;
              by0 = bestPt.y;
              nx = bestPt.nx;
              ny = bestPt.ny;
            }
          }

          const boltLenPx = Math.min(86, (sb.lengthM || 4) * scale * 0.88);
          const rad = ((sb.angleDeg || 60) * Math.PI) / 180;
          const dirSignX =
            sb.panel === 'left_wall'
              ? -1
              : sb.panel === 'right_wall'
              ? 1
              : nx >= 0
              ? 1
              : -1;
          const bx1 =
            sb.panel === 'face'
              ? bx0 + dirSignX * Math.cos(rad * 0.5) * boltLenPx
              : bx0 + (nx * Math.sin(rad) + dirSignX * Math.cos(rad) * 0.35) * boltLenPx;
          const by1 =
            sb.panel === 'face'
              ? by0 - Math.sin(rad) * boltLenPx
              : by0 + (ny * Math.sin(rad) - Math.cos(rad) * 0.35) * boltLenPx;

          return (
            <g key={sb.id || idx}>
              <line
                x1={bx0}
                y1={by0}
                x2={bx1}
                y2={by1}
                stroke="#dc2626"
                strokeWidth="3"
                strokeDasharray="5 2"
              />
              <circle
                cx={bx0}
                cy={by0}
                r="4.5"
                fill="#dc2626"
                stroke="#ffffff"
                strokeWidth="1.5"
              />
              <text
                x={bx1 + (dirSignX >= 0 ? 5 : -5)}
                y={by1 - 2}
                textAnchor={dirSignX >= 0 ? 'start' : 'end'}
                fontSize="8.5"
                fontWeight="900"
                fontFamily="IBM Plex Mono, monospace"
                fill="#dc2626"
                stroke="#ffffff"
                strokeWidth="2.2"
                paintOrder="stroke"
              >
                {sb.label} (Pull {sb.pullMeter}m | X:{sb.xMeters}m, Y:{sb.yMeters}m | ∠{sb.angleDeg}°)
              </text>
            </g>
          );
        })}

      {/* Bottom Legend & Support Summary Schedule inside 2D Drawing — ONLY GIVEN SUPPORTS */}
      <rect
        x="8"
        y="340"
        width="544"
        height="74"
        fill="#f8fafc"
        stroke="#0f172a"
        strokeWidth="1.2"
      />
      {givenSupportsList.length === 0 ? (
        <text
          x="280"
          y="380"
          textAnchor="middle"
          fontSize="9.5"
          fontWeight="900"
          fontFamily="IBM Plex Mono, monospace"
          fill="#64748b"
        >
          • GIVEN SUPPORTS: NONE (Unsupported / Self-supporting rock mass)
        </text>
      ) : (
        givenSupportsList.slice(0, 5).map((item, idx) => (
          <text
            key={item.label}
            x="16"
            y={355 + idx * 14}
            fontSize={givenSupportsList.length > 4 ? '7.9' : '8.6'}
            fontWeight="900"
            fontFamily="IBM Plex Mono, monospace"
            fill={item.fill}
          >
            • {item.label}: {item.text}
          </text>
        ))
      )}
    </svg>
  );
};

export const FieldSupport2DCrossSectionSvg = FieldSupportSystem2DDrawingSvg;

// ============================================================================
// STAGE 5C: DEDICATED SUPPORT SYSTEM WINDOW
// Class I–V, Wire Mesh, Rock Bolts, Shotcrete (Crown / Wall), Lattice Girder, ISMB,
// 3D Interactive Spot Bolt Locator (Pull, X, Y, Length, Angle), and Live 2D Drawing
// ============================================================================
export const FieldSupportSystemStage: React.FC<{
  activeLocation: FieldTunnelLocationItem;
  activeRound: FieldExcavationRound;
  mappingDomain?: MappingDomainType;
  surfaceParams?: SurfaceGeometryParameters;
  onUpdateRound: (updater: (prev: FieldExcavationRound) => FieldExcavationRound) => void;
  onBackToClassifications: () => void;
  onContinueToSurvey: () => void;
}> = ({
  activeLocation,
  activeRound,
  mappingDomain = 'TUNNEL',
  surfaceParams,
  onUpdateRound,
  onBackToClassifications,
  onContinueToSurvey,
}) => {
  const support = useMemo(
    () => ({
      ...createDefaultSupportSystem(),
      ...(activeRound.supportSystem || {}),
      spotBolts: Array.isArray(activeRound.supportSystem?.spotBolts)
        ? activeRound.supportSystem.spotBolts
        : [],
    }),
    [activeRound.supportSystem]
  );
  const spot3DSvgRef = useRef<SVGSVGElement | null>(null);

  // Default parameters for new Spot Bolt placed in 3D
  const [newSpotLengthM, setNewSpotLengthM] = useState<number>(4.0);
  const [newSpotAngleDeg, setNewSpotAngleDeg] = useState<number>(65);
  const [newSpotAzimuthDeg, setNewSpotAzimuthDeg] = useState<number>(
    activeRound.tunnelDriveDirection || 45
  );
  const [spot3DViewMode, setSpot3DViewMode] = useState<'3D_WEBGL' | '2D_SVG'>('3D_WEBGL');

  const updateSupport = (patch: Partial<FieldSupportSystemConfig>) => {
    onUpdateRound((r) => {
      const curr = r.supportSystem || createDefaultSupportSystem();
      const next = { ...curr, ...patch };
      return {
        ...r,
        supportSystem: next,
        rockSupportRecommendation: buildSupportRecommendationText(next, r),
      };
    });
  };

  const applySupportClassPreset = (
    cls: 'Class I' | 'Class II' | 'Class III' | 'Class IV' | 'Class V' | 'Custom'
  ) => {
    if (cls === 'Class I') {
      updateSupport({
        supportClass: 'Class I',
        rockBoltsEnabled: false,
        spotBoltsEnabled: true,
        shotcreteEnabled: true,
        shotcreteScope: 'crown_only',
        shotcreteCrownThicknessMm: 50,
        wireMeshEnabled: false,
        latticeGirderEnabled: false,
        ismbEnabled: false,
      });
    } else if (cls === 'Class II') {
      updateSupport({
        supportClass: 'Class II',
        rockBoltsEnabled: true,
        rockBoltScope: 'crown_only',
        rockBoltLengthM: 4.0,
        rockBoltInPlaneSpacingM: 2.0,
        rockBoltLongitudinalSpacingM: 2.0,
        shotcreteEnabled: true,
        shotcreteScope: 'crown_only',
        shotcreteCrownThicknessMm: 75,
        wireMeshEnabled: true,
        wireMeshScope: 'crown_only',
        latticeGirderEnabled: false,
        ismbEnabled: false,
      });
    } else if (cls === 'Class III') {
      updateSupport({
        supportClass: 'Class III',
        rockBoltsEnabled: true,
        rockBoltScope: 'crown_and_wall',
        rockBoltLengthM: 4.0,
        rockBoltInPlaneSpacingM: 1.5,
        rockBoltLongitudinalSpacingM: 1.5,
        shotcreteEnabled: true,
        shotcreteScope: 'crown_and_wall',
        shotcreteCrownThicknessMm: 100,
        shotcreteWallThicknessMm: 75,
        wireMeshEnabled: true,
        wireMeshScope: 'crown_and_wall',
        latticeGirderEnabled: false,
        ismbEnabled: false,
      });
    } else if (cls === 'Class IV') {
      updateSupport({
        supportClass: 'Class IV',
        rockBoltsEnabled: true,
        rockBoltScope: 'crown_and_wall',
        rockBoltLengthM: 4.5,
        rockBoltInPlaneSpacingM: 1.2,
        rockBoltLongitudinalSpacingM: 1.2,
        shotcreteEnabled: true,
        shotcreteScope: 'crown_and_wall',
        shotcreteCrownThicknessMm: 150,
        shotcreteWallThicknessMm: 120,
        wireMeshEnabled: true,
        wireMeshScope: 'crown_and_wall',
        latticeGirderEnabled: true,
        latticeGirderSpacingM: 1.2,
        ismbEnabled: false,
      });
    } else if (cls === 'Class V') {
      updateSupport({
        supportClass: 'Class V',
        rockBoltsEnabled: true,
        rockBoltScope: 'crown_and_wall',
        rockBoltLengthM: 5.0,
        rockBoltInPlaneSpacingM: 1.0,
        rockBoltLongitudinalSpacingM: 1.0,
        shotcreteEnabled: true,
        shotcreteScope: 'crown_and_wall',
        shotcreteCrownThicknessMm: 200,
        shotcreteWallThicknessMm: 150,
        wireMeshEnabled: true,
        wireMeshScope: 'crown_and_wall',
        latticeGirderEnabled: true,
        latticeGirderSpacingM: 1.0,
        ismbEnabled: true,
        ismbSpacingM: 1.0,
      });
    } else {
      updateSupport({ supportClass: 'Custom' });
    }
  };

  // Interactive 3D Tunnel Spot Bolt Placement Geometry & Handler (Exact Tunnel Shape & Size)
  const surf3D = useMemo(() => getLocationSurfaceConfig(activeLocation), [activeLocation]);
  const pullM = Math.max(0.5, activeRound.pullLengthMeters || 3.0);
  const W = Math.max(1.5, surf3D.tunnelW || activeLocation.widthM || 8);
  const H = Math.max(1.5, surf3D.tunnelH || activeLocation.heightM || 7);

  // Compute exact 1:1 proportional Outer Portal (0m Pull) and Inner Excavation Face (pullM) inside viewBox 0 0 420 270
  const tunnel3DGeom = useMemo(() => {
    const cx3D = 210;
    const outerScale = Math.min(332 / W, 198 / H);
    const outerW = W * outerScale;
    const outerH = H * outerScale;
    const outerX = cx3D - outerW / 2;
    const outerY = 144 - outerH / 2;

    // Perspective depth shrink ratio based on Pull length relative to tunnel span/height
    const depthRatio = Math.max(
      0.44,
      Math.min(0.68, 1 / (1 + (pullM / Math.max(3.5, Math.max(W, H))) * 1.25))
    );
    const innerW = outerW * depthRatio;
    const innerH = outerH * depthRatio;
    const innerX = cx3D - innerW / 2;
    const innerY = outerY + (outerH - innerH) * 0.58;

    const outerOutline = computeFaceTunnelOutlineDetails(
      activeLocation,
      outerX,
      outerY,
      outerW,
      outerH
    );
    const innerOutline = computeFaceTunnelOutlineDetails(
      activeLocation,
      innerX,
      innerY,
      innerW,
      innerH
    );

    // Intermediate 3D depth rings (at 33% and 67% of Pull) for realistic 3D tunnel shape ribs
    const makeRingOutline = (t: number) => {
      const rX = outerX + (innerX - outerX) * t;
      const rY = outerY + (innerY - outerY) * t;
      const rW = outerW + (innerW - outerW) * t;
      const rH = outerH + (innerH - outerH) * t;
      return computeFaceTunnelOutlineDetails(activeLocation, rX, rY, rW, rH);
    };
    const ring33 = makeRingOutline(0.33);
    const ring67 = makeRingOutline(0.67);

    const outerSplY = Number.isFinite(outerOutline.springY)
      ? outerOutline.springY
      : outerOutline.leftSplPt?.y ?? outerY + outerH * 0.45;
    const innerSplY = Number.isFinite(innerOutline.springY)
      ? innerOutline.springY
      : innerOutline.leftSplPt?.y ?? innerY + innerH * 0.45;

    const outerLeft =
      outerOutline.leftWallPoly.length >= 2
        ? outerOutline.leftWallPoly
        : [
            { x: outerX, y: outerY + outerH },
            { x: outerX, y: outerSplY },
          ];
    const innerLeft =
      innerOutline.leftWallPoly.length >= 2
        ? innerOutline.leftWallPoly
        : [
            { x: innerX, y: innerY + innerH },
            { x: innerX, y: innerSplY },
          ];

    const outerCrown =
      outerOutline.crownPoly.length >= 2
        ? outerOutline.crownPoly
        : [
            { x: outerX, y: outerSplY },
            { x: cx3D, y: outerY },
            { x: outerX + outerW, y: outerSplY },
          ];
    const innerCrown =
      innerOutline.crownPoly.length >= 2
        ? innerOutline.crownPoly
        : [
            { x: innerX, y: innerSplY },
            { x: cx3D, y: innerY },
            { x: innerX + innerW, y: innerSplY },
          ];

    const outerRight =
      outerOutline.rightWallPoly.length >= 2
        ? outerOutline.rightWallPoly
        : [
            { x: outerX + outerW, y: outerY + outerH },
            { x: outerX + outerW, y: outerSplY },
          ];
    const innerRight =
      innerOutline.rightWallPoly.length >= 2
        ? innerOutline.rightWallPoly
        : [
            { x: innerX + innerW, y: innerY + innerH },
            { x: innerX + innerW, y: innerSplY },
          ];

    const leftWallPoly3D = [...outerLeft, ...innerLeft.slice().reverse()];
    const crownPoly3D = [...outerCrown, ...innerCrown.slice().reverse()];
    const rightWallPoly3D = [...innerRight, ...outerRight.slice().reverse()];
    const facePoly3D = [
      ...innerLeft,
      ...innerCrown,
      ...innerRight.slice().reverse(),
      ...(innerOutline.invertPoly.length >= 2
        ? innerOutline.invertPoly.slice().reverse()
        : []),
    ];

    const toPointsAttr = (pts: { x: number; y: number }[]) =>
      pts
        .filter((p) => p && Number.isFinite(p.x) && Number.isFinite(p.y))
        .map((p) => `${Number(p.x).toFixed(1)},${Number(p.y).toFixed(1)}`)
        .join(' ');

    return {
      cx3D,
      outerX,
      outerY,
      outerW,
      outerH,
      innerX,
      innerY,
      innerW,
      innerH,
      outerOutline,
      innerOutline,
      ring33,
      ring67,
      outerLeft,
      innerLeft,
      outerCrown,
      innerCrown,
      outerRight,
      innerRight,
      leftWallPoly3D,
      crownPoly3D,
      rightWallPoly3D,
      facePoly3D,
      leftWallPointsStr: toPointsAttr(leftWallPoly3D),
      crownPointsStr: toPointsAttr(crownPoly3D),
      rightWallPointsStr: toPointsAttr(rightWallPoly3D),
      facePointsStr: toPointsAttr(facePoly3D),
    };
  }, [activeLocation, W, H, pullM]);

  const handle3DSpotBoltCanvasClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = spot3DSvgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const sx = ((e.clientX - rect.left) / Math.max(1, rect.width)) * 420;
    const sy = ((e.clientY - rect.top) / Math.max(1, rect.height)) * 270;
    const clickPt = { x: sx, y: sy };

    let panel: FieldPanelId = 'crown';
    let pullMeter = Number((pullM * 0.5).toFixed(2));
    let xMeters = 0;
    let yMeters = Number((H * 0.85).toFixed(2));
    let u = 0.5;
    let v = 0.5;

    const {
      innerX,
      innerY,
      innerW,
      innerH,
      outerLeft,
      innerLeft,
      outerCrown,
      innerCrown,
      outerRight,
      innerRight,
      leftWallPoly3D,
      crownPoly3D,
      rightWallPoly3D,
      facePoly3D,
    } = tunnel3DGeom;

    if (isPointInsidePolygon2D(clickPt, facePoly3D)) {
      panel = 'face';
      u = Math.max(0.05, Math.min(0.95, (sx - innerX) / Math.max(1, innerW)));
      v = Math.max(0.05, Math.min(0.95, (sy - innerY) / Math.max(1, innerH)));
      pullMeter = Number(pullM.toFixed(2));
      xMeters = Number(((u - 0.5) * W).toFixed(2));
      yMeters = Number(((1 - v) * H).toFixed(2));
    } else if (
      isPointInsidePolygon2D(clickPt, crownPoly3D) ||
      (sy <= innerY + innerH * 0.35 && sx >= tunnel3DGeom.outerX && sx <= tunnel3DGeom.outerX + tunnel3DGeom.outerW)
    ) {
      panel = 'crown';
      // Search best (vArc, tDepth) on 3D Crown surface
      let bestV = 0.5;
      let bestT = 0.5;
      let bestD = Infinity;
      for (let iv = 0; iv <= 24; iv++) {
        const candV = iv / 24;
        const pOut = samplePointAlongPolyline(outerCrown, candV);
        const pIn = samplePointAlongPolyline(innerCrown, candV);
        for (let it = 0; it <= 16; it++) {
          const candT = it / 16;
          const px = pOut.x + (pIn.x - pOut.x) * candT;
          const py = pOut.y + (pIn.y - pOut.y) * candT;
          const d = Math.hypot(px - sx, py - sy);
          if (d < bestD) {
            bestD = d;
            bestV = candV;
            bestT = candT;
          }
        }
      }
      u = Math.max(0.05, Math.min(0.95, bestT));
      v = Math.max(0.05, Math.min(0.95, bestV));
      pullMeter = Number((u * pullM).toFixed(2));
      const pIn = samplePointAlongPolyline(innerCrown, v);
      xMeters = Number((((pIn.x - (innerX + innerW / 2)) / Math.max(1, innerW)) * W).toFixed(2));
      yMeters = Number((((innerY + innerH - pIn.y) / Math.max(1, innerH)) * H).toFixed(2));
    } else if (isPointInsidePolygon2D(clickPt, leftWallPoly3D) || sx < tunnel3DGeom.cx3D) {
      panel = 'left_wall';
      let bestWallRatio = 0.5;
      let bestT = 0.5;
      let bestD = Infinity;
      for (let iw = 0; iw <= 20; iw++) {
        const wRatio = iw / 20; // 0 = invert, 1 = Left SPL
        const pOut = samplePointAlongPolyline(outerLeft, wRatio);
        const pIn = samplePointAlongPolyline(innerLeft, wRatio);
        for (let it = 0; it <= 16; it++) {
          const candT = it / 16;
          const px = pOut.x + (pIn.x - pOut.x) * candT;
          const py = pOut.y + (pIn.y - pOut.y) * candT;
          const d = Math.hypot(px - sx, py - sy);
          if (d < bestD) {
            bestD = d;
            bestWallRatio = wRatio;
            bestT = candT;
          }
        }
      }
      u = Math.max(0.05, Math.min(0.95, bestT));
      v = Math.max(0.05, Math.min(0.95, 1 - bestWallRatio));
      pullMeter = Number((u * pullM).toFixed(2));
      const pIn = samplePointAlongPolyline(innerLeft, bestWallRatio);
      xMeters = Number((((pIn.x - (innerX + innerW / 2)) / Math.max(1, innerW)) * W).toFixed(2));
      yMeters = Number((((innerY + innerH - pIn.y) / Math.max(1, innerH)) * H).toFixed(2));
    } else {
      panel = 'right_wall';
      let bestWallRatio = 0.5;
      let bestT = 0.5;
      let bestD = Infinity;
      for (let iw = 0; iw <= 20; iw++) {
        const wRatio = iw / 20; // 0 = invert, 1 = Right SPL
        const pOut = samplePointAlongPolyline(outerRight, wRatio);
        const pIn = samplePointAlongPolyline(innerRight, wRatio);
        for (let it = 0; it <= 16; it++) {
          const candT = it / 16;
          const px = pOut.x + (pIn.x - pOut.x) * candT;
          const py = pOut.y + (pIn.y - pOut.y) * candT;
          const d = Math.hypot(px - sx, py - sy);
          if (d < bestD) {
            bestD = d;
            bestWallRatio = wRatio;
            bestT = candT;
          }
        }
      }
      u = Math.max(0.05, Math.min(0.95, 1 - bestT));
      v = Math.max(0.05, Math.min(0.95, 1 - bestWallRatio));
      pullMeter = Number((bestT * pullM).toFixed(2));
      const pIn = samplePointAlongPolyline(innerRight, bestWallRatio);
      xMeters = Number((((pIn.x - (innerX + innerW / 2)) / Math.max(1, innerW)) * W).toFixed(2));
      yMeters = Number((((innerY + innerH - pIn.y) / Math.max(1, innerH)) * H).toFixed(2));
    }

    const nextIdx = (support.spotBolts?.length || 0) + 1;
    const newBolt: FieldSpotBoltItem = {
      id: `sb-${Date.now()}`,
      label: `SB-${nextIdx}`,
      panel,
      u: Number(u.toFixed(3)),
      v: Number(v.toFixed(3)),
      pullMeter,
      xMeters,
      yMeters,
      lengthM: newSpotLengthM,
      angleDeg: newSpotAngleDeg,
      azimuthDeg: newSpotAzimuthDeg,
    };

    updateSupport({
      spotBoltsEnabled: true,
      spotBolts: [...(support.spotBolts || []), newBolt],
    });
  };

  const isSurface =
    mappingDomain === 'SLOPE' ||
    mappingDomain === 'BENCH' ||
    mappingDomain === 'TRENCH' ||
    mappingDomain === 'ROCK_SURFACE';

  if (isSurface) {
    const slopeBetaDeg = surfaceParams?.faceDipAngleDeg || 65;
    const slopeHeightVal = surfaceParams?.slopeHeightMeters || (surfaceParams?.benchHeightMeters ? surfaceParams.benchHeightMeters : 12);
    const smrScore = activeRound.rmrTotal ? Math.max(15, activeRound.rmrTotal - 10) : 55;
    const smrClass = smrScore >= 81 ? 'Class I (Completely Stable)' : smrScore >= 61 ? 'Class II (Stable)' : smrScore >= 41 ? 'Class III (Partially Stable)' : smrScore >= 21 ? 'Class IV (Unstable)' : 'Class V (Completely Unstable)';

    const applySurfacePreset = (preset: 'Class I' | 'Class II' | 'Class III' | 'Class IV' | 'Class V') => {
      if (preset === 'Class I') {
        updateSupport({
          supportClass: 'Class I',
          rockBoltsEnabled: false,
          soilNailEnabled: false,
          shotcreteEnabled: false,
          wireMeshEnabled: false,
          weepHolesEnabled: false,
          subHorizontalDrainsEnabled: false,
          crestDrainDitchEnabled: true,
          slopeStabilizationSummary: 'Class I (SMR 81–100): Completely stable slope. No surface stabilization required. Periodic crest ditch cleaning.',
        });
      } else if (preset === 'Class II') {
        updateSupport({
          supportClass: 'Class II',
          rockBoltsEnabled: true,
          soilNailEnabled: true,
          soilNailType: 'Ø25mm High-Yield SN Rebar Dowels',
          soilNailLengthM: 3.0,
          soilNailSpacingM: 2.5,
          shotcreteEnabled: false,
          wireMeshEnabled: true,
          wireMeshType: 'Localized Double-Twisted Hexagonal Mesh Drapery',
          weepHolesEnabled: true,
          weepHolesSpacingM: 2.5,
          subHorizontalDrainsEnabled: false,
          crestDrainDitchEnabled: true,
          slopeStabilizationSummary: 'Class II (SMR 61–80): Stable slope with local joint blocks. Spot rebar dowels (Ø25mm, L=3.0m) and wire mesh drapery on localized joints.',
        });
      } else if (preset === 'Class III') {
        updateSupport({
          supportClass: 'Class III',
          rockBoltsEnabled: true,
          soilNailEnabled: true,
          soilNailType: 'Ø25mm SN Rebar Dowels with Cement Grouting',
          soilNailLengthM: 4.5,
          soilNailSpacingM: 1.5,
          soilNailAngleDeg: 15,
          soilNailGroutPressureBar: 5,
          shotcreteEnabled: true,
          shotcreteType: 'SFRS',
          shotcreteThicknessMm: 75,
          wireMeshEnabled: true,
          wireMeshType: 'TECCO® G65 High-Tensile Steel Wire Mesh',
          spikePlateType: 'P33 Diamond Spike Plates',
          weepHolesEnabled: true,
          weepHolesSpacingM: 2.0,
          subHorizontalDrainsEnabled: true,
          subHorizontalDrainsLengthM: 6.0,
          crestDrainDitchEnabled: true,
          slopeStabilizationSummary: 'Class III (SMR 41–60): Partially stable slope. Systematic pattern soil nails (Ø25mm, L=4.5m @ 1.5×1.5m) + TECCO® G65 High-Tensile Mesh + 75mm SFRS Shotcrete with Ø50mm PVC weep holes @ 2.0m c/c + sub-horizontal drainage holes.',
        });
      } else if (preset === 'Class IV') {
        updateSupport({
          supportClass: 'Class IV',
          rockBoltsEnabled: true,
          soilNailEnabled: true,
          soilNailType: 'Hollow-Core Self-Drilling Anchors R32 (Fully Grouted)',
          soilNailLengthM: 6.0,
          soilNailSpacingM: 1.2,
          soilNailAngleDeg: 20,
          soilNailGroutPressureBar: 8,
          shotcreteEnabled: true,
          shotcreteType: 'SFRS',
          shotcreteThicknessMm: 100,
          wireMeshEnabled: true,
          wireMeshType: 'Heavy Welded Wire Mesh (100×100×6mm) + TECCO G65',
          spikePlateType: 'P66 Heavy Anchor Plates',
          weepHolesEnabled: true,
          weepHolesSpacingM: 1.5,
          subHorizontalDrainsEnabled: true,
          subHorizontalDrainsLengthM: 9.0,
          crestDrainDitchEnabled: true,
          slopeStabilizationSummary: 'Class IV (SMR 21–40): Unstable slope. Heavy pattern ground anchors (R32, L=6.0m @ 1.2×1.2m) + 100mm SFRS Shotcrete with Ø50mm weep holes @ 1.5m c/c + deep sub-horizontal perforated drains + lined crest drain ditch.',
        });
      } else if (preset === 'Class V') {
        updateSupport({
          supportClass: 'Class V',
          rockBoltsEnabled: true,
          soilNailEnabled: true,
          soilNailType: 'Prestressed Multi-Strand Ground Anchors / Hollow-Core R38',
          soilNailLengthM: 12.0,
          soilNailSpacingM: 1.0,
          soilNailAngleDeg: 20,
          soilNailGroutPressureBar: 10,
          shotcreteEnabled: true,
          shotcreteType: 'SFRS',
          shotcreteThicknessMm: 150,
          wireMeshEnabled: true,
          wireMeshType: 'High-Tensile Wire Mesh + Reinforcing Rebar Grid',
          spikePlateType: 'P66 Heavy Clamping Plates',
          weepHolesEnabled: true,
          weepHolesSpacingM: 1.0,
          subHorizontalDrainsEnabled: true,
          subHorizontalDrainsLengthM: 12.0,
          crestDrainDitchEnabled: true,
          slopeStabilizationSummary: 'Class V (SMR 0–20): Completely unstable slope. Requires deep prestressed ground anchors (L=12m), multi-level sub-horizontal drainage array, 150mm SFRS shotcrete, toe counterweight berm, or bench re-grading.',
        });
      }
    };

    const soilNailActive = support.soilNailEnabled ?? support.rockBoltsEnabled ?? true;
    const shotcreteActive = support.shotcreteEnabled ?? true;
    const meshActive = support.wireMeshEnabled ?? true;
    const weepHolesActive = support.weepHolesEnabled ?? true;
    const subDrainsActive = support.subHorizontalDrainsEnabled ?? true;

    return (
      <div className="flex-1 min-h-0 flex flex-col gap-2 p-2 sm:p-3 bg-slate-950 overflow-hidden font-sans">
        {/* Simple Top Bar for Slope & Bench Stabilization */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-emerald-400" />
              <span>{mappingDomain === 'BENCH' ? 'Bench Face Stabilization' : 'Slope Surface Stabilization'}</span>
            </span>

            {/* Presets by SMR Stability Class */}
            <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-lg p-0.5">
              {(['Class I', 'Class II', 'Class III', 'Class IV', 'Class V'] as const).map((cls) => (
                <button
                  key={cls}
                  type="button"
                  onClick={() => applySurfacePreset(cls)}
                  className={`px-2 py-0.5 rounded text-[10.5px] font-black cursor-pointer transition-all ${
                    support.supportClass === cls
                      ? 'bg-emerald-500 text-slate-950 shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title={`Apply Romana SMR ${cls} Prescribed Stabilization`}
                >
                  {cls}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onBackToClassifications}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center gap-1 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              SMR &amp; RMR
            </button>
            <button
              type="button"
              onClick={onContinueToSurvey}
              className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow cursor-pointer"
            >
              <span>Next: Clean Report</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Workspace: Left 7 Cols Controls + Right 5 Cols Clean 2D Elevation Sketch */}
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-3 overflow-hidden">
          {/* Left Column: Simple Stabilization Controls */}
          <div className="lg:col-span-7 min-h-0 overflow-y-auto space-y-3 pr-1">
            {/* Romana SMR Recommendation Banner */}
            <div className="bg-gradient-to-r from-emerald-950/70 via-slate-900 to-slate-900 border border-emerald-500/40 rounded-xl p-3 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-emerald-400 uppercase tracking-wider">
                  Romana (1985) Slope Stabilization Recommendation
                </span>
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono font-bold text-[11px]">
                  {smrClass}
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed font-mono">
                {support.slopeStabilizationSummary ||
                  'Systematic pattern soil nails (L=4.5m @ 1.5×1.5m) + TECCO® G65 High-Tensile Wire Mesh + 75mm SFRS Shotcrete with Ø50mm PVC weep holes @ 2.0m c/c + Sub-horizontal drainage relief holes.'}
              </p>
            </div>

            {/* 1. Soil Nails & Rock Anchors Card */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={soilNailActive}
                    onChange={(e) =>
                      updateSupport({
                        soilNailEnabled: e.target.checked,
                        rockBoltsEnabled: e.target.checked,
                      })
                    }
                    className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                  />
                  <span className="text-xs font-black uppercase text-amber-300">
                    1. Soil Nails &amp; Rock Anchors (Grouting)
                  </span>
                </label>
                <span className="text-[10px] font-mono text-amber-400 font-bold">
                  {soilNailActive ? 'Active' : 'Disabled'}
                </span>
              </div>

              {soilNailActive && (
                <div className="space-y-2 pt-1 border-t border-slate-800 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase">
                        Nail / Anchor Type
                      </label>
                      <select
                        value={support.soilNailType || support.rockBoltType || 'Ø25mm SN Rebar Dowels'}
                        onChange={(e) =>
                          updateSupport({
                            soilNailType: e.target.value,
                            rockBoltType: e.target.value,
                          })
                        }
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-1.5 text-xs text-slate-200 font-mono"
                      >
                        <option value="Ø25mm SN Rebar Dowels with Cement Grout">Ø25mm High-Yield SN Rebar (Grouted)</option>
                        <option value="Ø32mm High-Yield Threaded SN Bar">Ø32mm Heavy Threaded Bar</option>
                        <option value="Hollow-Core Self-Drilling Anchor R32">Hollow-Core Self-Drilling R32</option>
                        <option value="Hollow-Core Self-Drilling Anchor R38">Hollow-Core Self-Drilling R38</option>
                        <option value="Prestressed Multi-Strand Ground Anchors">Prestressed Multi-Strand Anchors</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase">
                        Nail Length (m)
                      </label>
                      <div className="grid grid-cols-5 gap-1">
                        {[3.0, 4.5, 6.0, 9.0, 12.0].map((len) => (
                          <button
                            key={len}
                            type="button"
                            onClick={() =>
                              updateSupport({
                                soilNailLengthM: len,
                                rockBoltLengthM: len,
                              })
                            }
                            className={`py-1 rounded text-[10px] font-mono font-bold border cursor-pointer ${
                              (support.soilNailLengthM || support.rockBoltLengthM || 4.5) === len
                                ? 'bg-amber-500 text-slate-950 border-amber-300'
                                : 'bg-slate-950 text-slate-300 border-slate-800'
                            }`}
                          >
                            {len}m
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase">
                        Pattern Spacing
                      </label>
                      <div className="grid grid-cols-3 gap-1">
                        {[1.2, 1.5, 2.0].map((sp) => (
                          <button
                            key={sp}
                            type="button"
                            onClick={() =>
                              updateSupport({
                                soilNailSpacingM: sp,
                                rockBoltInPlaneSpacingM: sp,
                                rockBoltLongitudinalSpacingM: sp,
                              })
                            }
                            className={`py-1 rounded text-[10px] font-mono font-bold border cursor-pointer ${
                              (support.soilNailSpacingM || support.rockBoltInPlaneSpacingM || 1.5) === sp
                                ? 'bg-amber-500 text-slate-950 border-amber-300'
                                : 'bg-slate-950 text-slate-300 border-slate-800'
                            }`}
                          >
                            {sp}×{sp}m
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase">
                        Downward Inclination
                      </label>
                      <div className="grid grid-cols-2 gap-1">
                        {[15, 20].map((ang) => (
                          <button
                            key={ang}
                            type="button"
                            onClick={() => updateSupport({ soilNailAngleDeg: ang })}
                            className={`py-1 rounded text-[10px] font-mono font-bold border cursor-pointer ${
                              (support.soilNailAngleDeg || 15) === ang
                                ? 'bg-amber-500 text-slate-950 border-amber-300'
                                : 'bg-slate-950 text-slate-300 border-slate-800'
                            }`}
                          >
                            ∠{ang}° Down
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase">
                        Grout Pressure
                      </label>
                      <div className="grid grid-cols-2 gap-1">
                        {[5, 8].map((bar) => (
                          <button
                            key={bar}
                            type="button"
                            onClick={() => updateSupport({ soilNailGroutPressureBar: bar })}
                            className={`py-1 rounded text-[10px] font-mono font-bold border cursor-pointer ${
                              (support.soilNailGroutPressureBar || 5) === bar
                                ? 'bg-amber-500 text-slate-950 border-amber-300'
                                : 'bg-slate-950 text-slate-300 border-slate-800'
                            }`}
                          >
                            {bar} Bar
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 2. Shotcrete & Weep Holes Card */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={shotcreteActive}
                    onChange={(e) => updateSupport({ shotcreteEnabled: e.target.checked })}
                    className="w-4 h-4 accent-cyan-500 rounded cursor-pointer"
                  />
                  <span className="text-xs font-black uppercase text-cyan-300">
                    2. Shotcrete Surface Seal &amp; Weep Holes
                  </span>
                </label>
                <span className="text-[10px] font-mono text-cyan-400 font-bold">
                  {shotcreteActive ? 'Active' : 'Disabled'}
                </span>
              </div>

              {shotcreteActive && (
                <div className="space-y-2 pt-1 border-t border-slate-800 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase">
                        Shotcrete Spec
                      </label>
                      <div className="grid grid-cols-3 gap-1">
                        {[
                          { id: 'Plain', label: 'Plain' },
                          { id: 'SFRS', label: 'SFRS (Steel)' },
                          { id: 'PP Fibre Shotcrete', label: 'PP Fibre' },
                        ].map((sc) => (
                          <button
                            key={sc.id}
                            type="button"
                            onClick={() => updateSupport({ shotcreteType: sc.id as any })}
                            className={`py-1 rounded text-[10px] font-mono font-bold border cursor-pointer ${
                              (support.shotcreteType || 'SFRS') === sc.id
                                ? 'bg-cyan-500 text-slate-950 border-cyan-300'
                                : 'bg-slate-950 text-slate-300 border-slate-800'
                            }`}
                          >
                            {sc.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase">
                        Thickness (mm)
                      </label>
                      <div className="grid grid-cols-4 gap-1">
                        {[50, 75, 100, 150].map((th) => (
                          <button
                            key={th}
                            type="button"
                            onClick={() =>
                              updateSupport({
                                shotcreteCrownThicknessMm: th,
                                shotcreteWallThicknessMm: th,
                                shotcreteThicknessMm: th,
                              })
                            }
                            className={`py-1 rounded text-[10px] font-mono font-bold border cursor-pointer ${
                              (support.shotcreteCrownThicknessMm || 75) === th
                                ? 'bg-cyan-500 text-slate-950 border-cyan-300'
                                : 'bg-slate-950 text-slate-300 border-slate-800'
                            }`}
                          >
                            {th}mm
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950 border border-slate-800">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={weepHolesActive}
                        onChange={(e) => updateSupport({ weepHolesEnabled: e.target.checked })}
                        className="w-3.5 h-3.5 accent-cyan-400 rounded cursor-pointer"
                      />
                      <span className="text-[11px] font-bold text-slate-300">
                        Include Ø50mm PVC Sub-surface Weep Holes (Relieves Hydrostatic Pressure)
                      </span>
                    </label>
                    <span className="font-mono text-cyan-300 text-[10px] font-bold">
                      @ {support.weepHolesSpacingM || 2.0}m c/c
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* 3. Wire Mesh Drape Card */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={meshActive}
                    onChange={(e) => updateSupport({ wireMeshEnabled: e.target.checked })}
                    className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                  />
                  <span className="text-xs font-black uppercase text-emerald-300">
                    3. High-Tensile Wire Mesh Drape
                  </span>
                </label>
                <span className="text-[10px] font-mono text-emerald-400 font-bold">
                  {meshActive ? 'Active' : 'Disabled'}
                </span>
              </div>

              {meshActive && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-slate-800 text-xs">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase">
                      Mesh Specification
                    </label>
                    <select
                      value={support.wireMeshType || 'TECCO® G65 High-Tensile Wire Mesh'}
                      onChange={(e) => updateSupport({ wireMeshType: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-1.5 text-xs text-slate-200 font-mono"
                    >
                      <option value="TECCO® G65 High-Tensile Steel Wire Mesh">TECCO® G65 High-Tensile Mesh (3mm/4mm)</option>
                      <option value="DELTAX Double-Twisted Wire Mesh">DELTAX® Double-Twisted Mesh</option>
                      <option value="Welded Wire Mesh (100×100×6mm)">Welded Wire Mesh (100×100×6mm)</option>
                      <option value="Double-Twisted Hexagonal Wire Mesh">Hexagonal Wire Netting</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase">
                      Spike Bearing Plate
                    </label>
                    <div className="grid grid-cols-2 gap-1">
                      {['P33 Diamond Spike Plate', 'P66 Heavy Anchor Plate'].map((spk) => (
                        <button
                          key={spk}
                          type="button"
                          onClick={() => updateSupport({ spikePlateType: spk })}
                          className={`py-1 rounded text-[10px] font-mono font-bold border cursor-pointer truncate px-1 ${
                            (support.spikePlateType || 'P33 Diamond Spike Plate') === spk
                              ? 'bg-emerald-500 text-slate-950 border-emerald-300'
                              : 'bg-slate-950 text-slate-300 border-slate-800'
                          }`}
                        >
                          {spk.split(' ')[0]} Plate
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 4. Drainage & Catchment Card */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 space-y-2">
              <span className="text-xs font-black uppercase text-sky-300">
                4. Drainage Relief &amp; Catchment Berm
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-950 border border-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={subDrainsActive}
                    onChange={(e) => updateSupport({ subHorizontalDrainsEnabled: e.target.checked })}
                    className="w-4 h-4 accent-sky-400 rounded cursor-pointer"
                  />
                  <div>
                    <div className="font-bold text-slate-200 text-xs">Sub-horizontal Drains</div>
                    <div className="text-[10px] text-slate-400 font-mono">Ø50mm PVC, L={support.subHorizontalDrainsLengthM || 6}m (∠5° Upward)</div>
                  </div>
                </label>

                <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-950 border border-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(support.crestDrainDitchEnabled ?? true)}
                    onChange={(e) => updateSupport({ crestDrainDitchEnabled: e.target.checked })}
                    className="w-4 h-4 accent-sky-400 rounded cursor-pointer"
                  />
                  <div>
                    <div className="font-bold text-slate-200 text-xs">Crest Interceptor Ditch</div>
                    <div className="text-[10px] text-slate-400 font-mono">Lined trapezoidal drain at slope crest</div>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* Right Column: Clean 2D Face & Slope Elevation Section SVG (Zero 3D) */}
          <div className="lg:col-span-5 min-h-[420px] bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-col justify-between gap-2 overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-bold text-white uppercase font-mono flex items-center gap-1.5">
                <Crosshair className="w-4 h-4 text-emerald-400" />
                <span>2D Slope Face &amp; Elevation Profile</span>
              </span>
              <span className="font-mono text-[10.5px] font-bold text-emerald-300">
                Height {slopeHeightVal}m • Face ∠{slopeBetaDeg}°
              </span>
            </div>

            {/* Clean 2D Section SVG */}
            <div className="flex-1 min-h-[300px] flex items-center justify-center bg-white rounded-lg border border-slate-800 p-2 overflow-hidden">
              <svg viewBox="0 0 540 380" className="w-full h-full max-h-[360px]">
                {/* Background Sky / Ground */}
                <rect x="0" y="0" width="540" height="380" fill="#f8fafc" />

                {/* Ground Cross-Section Polygon */}
                {/* Crest at (140, 50), Toe at (340, 310), Invert to bottom */}
                <polygon
                  points="0,50 140,50 340,310 540,310 540,380 0,380"
                  fill="#e2e8f0"
                  stroke="#334155"
                  strokeWidth="2.5"
                />

                {/* Bedrock hatch / lines inside ground */}
                <g stroke="#cbd5e1" strokeWidth="1" strokeDasharray="4 4">
                  <line x1="20" y1="90" x2="160" y2="90" />
                  <line x1="40" y1="140" x2="200" y2="140" />
                  <line x1="60" y1="190" x2="240" y2="190" />
                  <line x1="80" y1="240" x2="280" y2="240" />
                  <line x1="100" y1="290" x2="320" y2="290" />
                </g>

                {/* Crest Interceptor Ditch */}
                {Boolean(support.crestDrainDitchEnabled ?? true) && (
                  <g>
                    <polygon points="120,50 128,62 136,50" fill="#0284c7" stroke="#0369a1" strokeWidth="1.5" />
                    <text x="128" y="42" textAnchor="middle" fontSize="8" fontWeight="bold" fontFamily="monospace" fill="#0369a1">
                      Crest Ditch
                    </text>
                  </g>
                )}

                {/* Toe Ritchie Catchment Berm */}
                <g>
                  <polygon points="340,310 380,310 395,318 420,310" fill="#cbd5e1" stroke="#475569" strokeWidth="1.5" />
                  <text x="380" y="332" textAnchor="middle" fontSize="8" fontWeight="bold" fontFamily="monospace" fill="#475569">
                    Ritchie Toe Catchment
                  </text>
                </g>

                {/* Shotcrete Layer on Slope Face (140, 50) to (340, 310) */}
                {shotcreteActive && (
                  <g>
                    <line
                      x1="138"
                      y1="48"
                      x2="338"
                      y2="308"
                      stroke="#94a3b8"
                      strokeWidth={Math.max(4, (support.shotcreteCrownThicknessMm || 75) / 15)}
                    />
                    <text x="260" y="160" textAnchor="start" fontSize="8.5" fontWeight="bold" fontFamily="monospace" fill="#0f172a">
                      {support.shotcreteType || 'SFRS'} Shotcrete ({support.shotcreteCrownThicknessMm || 75}mm)
                    </text>
                  </g>
                )}

                {/* Wire Mesh Drape on Slope Face */}
                {meshActive && (
                  <g>
                    <line
                      x1="134"
                      y1="46"
                      x2="344"
                      y2="314"
                      stroke="#059669"
                      strokeWidth="2"
                      strokeDasharray="6 3"
                    />
                    {/* Top and Bottom Boundary Anchor Pins */}
                    <circle cx="134" cy="46" r="3.5" fill="#059669" stroke="#ffffff" strokeWidth="1" />
                    <circle cx="344" cy="314" r="3.5" fill="#059669" stroke="#ffffff" strokeWidth="1" />
                    <text x="210" y="115" textAnchor="end" fontSize="8" fontWeight="bold" fontFamily="monospace" fill="#059669">
                      {support.spikePlateType?.split(' ')[0] || 'P33'} Mesh Drape
                    </text>
                  </g>
                )}

                {/* Soil Nails / Rock Anchors Pattern into Rock Mass */}
                {soilNailActive &&
                  [
                    { x: 175, y: 95 },
                    { x: 215, y: 147 },
                    { x: 255, y: 200 },
                    { x: 295, y: 252 },
                  ].map((pt, idx) => {
                    const nailLenPx = Math.min(110, (support.soilNailLengthM || 4.5) * 16);
                    const angRad = ((support.soilNailAngleDeg || 15) * Math.PI) / 180;
                    const endX = pt.x - Math.cos(angRad) * nailLenPx;
                    const endY = pt.y + Math.sin(angRad) * nailLenPx;
                    return (
                      <g key={idx}>
                        {/* Grout Bulb Hole */}
                        <line
                          x1={pt.x}
                          y1={pt.y}
                          x2={endX}
                          y2={endY}
                          stroke="#cbd5e1"
                          strokeWidth="6"
                          strokeLinecap="round"
                        />
                        {/* High-Tensile Steel Rebar */}
                        <line
                          x1={pt.x}
                          y1={pt.y}
                          x2={endX}
                          y2={endY}
                          stroke="#d97706"
                          strokeWidth="2"
                        />
                        {/* Diamond Spike Bearing Plate at Collar */}
                        <circle cx={pt.x} cy={pt.y} r="4.5" fill="#d97706" stroke="#ffffff" strokeWidth="1.2" />
                        {/* Nail Collar Callout */}
                        {idx === 1 && (
                          <text x={endX - 8} y={endY} textAnchor="end" fontSize="8" fontWeight="bold" fontFamily="monospace" fill="#d97706">
                            Nail L={support.soilNailLengthM || 4.5}m (∠{support.soilNailAngleDeg || 15}°)
                          </text>
                        )}
                      </g>
                    );
                  })}

                {/* Weep Holes on Face */}
                {shotcreteActive && weepHolesActive && (
                  <g>
                    {[
                      { x: 195, y: 121 },
                      { x: 235, y: 174 },
                      { x: 275, y: 226 },
                    ].map((wPt, idx) => (
                      <g key={idx}>
                        <line x1={wPt.x} y1={wPt.y} x2={wPt.x - 22} y2={wPt.y - 2} stroke="#0284c7" strokeWidth="2.5" />
                        <circle cx={wPt.x} cy={wPt.y} r="2.5" fill="#0284c7" />
                        {idx === 0 && (
                          <text x={wPt.x + 10} y={wPt.y + 3} textAnchor="start" fontSize="7.5" fontWeight="bold" fontFamily="monospace" fill="#0284c7">
                            Ø50mm Weep Hole
                          </text>
                        )}
                      </g>
                    ))}
                  </g>
                )}

                {/* Sub-Horizontal Relief Drains near Toe */}
                {subDrainsActive && (
                  <g>
                    <line x1="330" y1="298" x2="200" y2="286" stroke="#0369a1" strokeWidth="3" strokeDasharray="5 3" />
                    <circle cx="330" cy="298" r="4" fill="#0369a1" />
                    <text x="210" y="278" textAnchor="end" fontSize="8" fontWeight="bold" fontFamily="monospace" fill="#0369a1">
                      Sub-Horizontal Drain (L={support.subHorizontalDrainsLengthM || 6}m, ∠5° Up)
                    </text>
                  </g>
                )}

                {/* Slope Geometry Labels */}
                <text x="190" y="28" textAnchor="middle" fontSize="9" fontWeight="black" fontFamily="monospace" fill="#0f172a">
                  Crest RL 280.0m
                </text>
                <text x="360" y="360" textAnchor="middle" fontSize="9" fontWeight="black" fontFamily="monospace" fill="#0f172a">
                  Toe RL 268.0m (H = {slopeHeightVal}m)
                </text>
              </svg>
            </div>

            {/* Quick Summary Pill Bar */}
            <div className="bg-slate-950 border border-slate-800 rounded-lg p-2 flex flex-wrap items-center justify-between gap-1 text-[10.5px] font-mono">
              <span className="text-slate-400">Prescription:</span>
              <span className="font-bold text-amber-300">
                {soilNailActive ? `Soil Nails ${support.soilNailLengthM || 4.5}m @ ${support.soilNailSpacingM || 1.5}m` : 'No Nails'}
              </span>
              <span className="text-slate-600">•</span>
              <span className="font-bold text-cyan-300">
                {shotcreteActive ? `${support.shotcreteType || 'SFRS'} ${support.shotcreteCrownThicknessMm || 75}mm` : 'No Shotcrete'}
              </span>
              <span className="text-slate-600">•</span>
              <span className="font-bold text-emerald-300">
                {meshActive ? 'TECCO Mesh' : 'No Mesh'}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-2 p-2 sm:p-3 bg-slate-950 overflow-hidden">
      {/* Top Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 flex items-center justify-between gap-1.5 shrink-0 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-1.5 shrink-0 overflow-x-auto no-scrollbar">
          <Shield className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="text-xs font-black uppercase tracking-wider text-amber-400 whitespace-nowrap">
            Support System
          </span>
          {/* Support Class Selector */}
          <div className="flex items-center gap-0.5 bg-slate-950 border border-slate-700 rounded-lg p-0.5 shrink-0">
            {(['Class I', 'Class II', 'Class III', 'Class IV', 'Class V', 'Custom'] as const).map(
              (cls) => (
                <button
                  key={cls}
                  type="button"
                  onClick={() => applySupportClassPreset(cls)}
                  className={`px-2 py-0.5 rounded text-[11px] font-black cursor-pointer whitespace-nowrap transition-all ${
                    support.supportClass === cls
                      ? 'bg-amber-500 text-slate-950 shadow'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {cls}
                </button>
              )
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onBackToClassifications}
            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center gap-1 cursor-pointer whitespace-nowrap"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Q / RMR / GSI
          </button>
          <button
            type="button"
            onClick={onContinueToSurvey}
            className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow cursor-pointer whitespace-nowrap"
          >
            <span>Next: Survey Overbreak</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main 12-Column Workspace */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-2.5 overflow-hidden">
        {/* Left 6 Columns: Support System Configuration + 3D Spot Bolt Placement */}
        <div className="lg:col-span-6 min-h-0 overflow-y-auto space-y-2.5 pr-1">
          {/* 0. Dedicated Geotechnical Junction Factor & Advance Optimization Card */}
          <FieldJunctionFactorSystemCard
            support={support}
            round={activeRound}
            location={activeLocation}
            onUpdateSupport={updateSupport}
            onUpdateRound={onUpdateRound}
            onApplyClassPreset={applySupportClassPreset}
          />

          {/* 1. Wire Mesh & Shotcrete Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* Shotcrete Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase text-amber-300">
                  1. Shotcrete (Crown / Wall)
                </span>
                <input
                  type="checkbox"
                  checked={Boolean(support.shotcreteEnabled)}
                  onChange={(e) => updateSupport({ shotcreteEnabled: e.target.checked })}
                  className="w-4 h-4 accent-amber-500 cursor-pointer"
                />
              </div>
              {support.shotcreteEnabled && (
                <div className="space-y-2 text-xs">
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => updateSupport({ shotcreteScope: 'crown_only' })}
                      className={`py-1 px-2 rounded border font-bold text-[11px] cursor-pointer ${
                        support.shotcreteScope === 'crown_only'
                          ? 'bg-amber-500 text-slate-950 border-amber-300'
                          : 'bg-slate-950 text-slate-300 border-slate-800'
                      }`}
                    >
                      Crown Only
                    </button>
                    <button
                      type="button"
                      onClick={() => updateSupport({ shotcreteScope: 'crown_and_wall' })}
                      className={`py-1 px-2 rounded border font-bold text-[11px] cursor-pointer ${
                        support.shotcreteScope === 'crown_and_wall'
                          ? 'bg-amber-500 text-slate-950 border-amber-300'
                          : 'bg-slate-950 text-slate-300 border-slate-800'
                      }`}
                    >
                      Crown + Wall
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    <div>
                      <label className="block text-[10px] text-slate-400">Type</label>
                      <select
                        value={support.shotcreteType ?? 'SFRS'}
                        onChange={(e) =>
                          updateSupport({
                            shotcreteType: e.target.value as 'SFRS' | 'Plain',
                          })
                        }
                        className="w-full bg-slate-950 border border-slate-700 rounded px-1.5 py-1 text-white"
                      >
                        <option value="SFRS">SFRS</option>
                        <option value="Plain">Plain</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400">Crown (mm)</label>
                      <input
                        type="number"
                        step={25}
                        min={25}
                        max={400}
                        value={support.shotcreteCrownThicknessMm ?? 100}
                        onChange={(e) =>
                          updateSupport({
                            shotcreteCrownThicknessMm: Number(e.target.value),
                          })
                        }
                        className="w-full bg-slate-950 border border-slate-700 rounded px-1.5 py-1 font-mono text-amber-300"
                      />
                    </div>
                    {support.shotcreteScope === 'crown_and_wall' && (
                      <div>
                        <label className="block text-[10px] text-slate-400">Wall (mm)</label>
                        <input
                          type="number"
                          step={25}
                          min={25}
                          max={400}
                          value={support.shotcreteWallThicknessMm ?? 75}
                          onChange={(e) =>
                            updateSupport({
                              shotcreteWallThicknessMm: Number(e.target.value),
                            })
                          }
                          className="w-full bg-slate-950 border border-slate-700 rounded px-1.5 py-1 font-mono text-amber-300"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Wire Mesh Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase text-emerald-300">
                  2. Wire Mesh
                </span>
                <input
                  type="checkbox"
                  checked={Boolean(support.wireMeshEnabled)}
                  onChange={(e) => updateSupport({ wireMeshEnabled: e.target.checked })}
                  className="w-4 h-4 accent-emerald-500 cursor-pointer"
                />
              </div>
              {support.wireMeshEnabled && (
                <div className="space-y-2 text-xs">
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => updateSupport({ wireMeshScope: 'crown_only' })}
                      className={`py-1 px-2 rounded border font-bold text-[11px] cursor-pointer ${
                        support.wireMeshScope === 'crown_only'
                          ? 'bg-emerald-500 text-slate-950 border-emerald-300'
                          : 'bg-slate-950 text-slate-300 border-slate-800'
                      }`}
                    >
                      Crown Only
                    </button>
                    <button
                      type="button"
                      onClick={() => updateSupport({ wireMeshScope: 'crown_and_wall' })}
                      className={`py-1 px-2 rounded border font-bold text-[11px] cursor-pointer ${
                        support.wireMeshScope === 'crown_and_wall'
                          ? 'bg-emerald-500 text-slate-950 border-emerald-300'
                          : 'bg-slate-950 text-slate-300 border-slate-800'
                      }`}
                    >
                      Crown + Wall
                    </button>
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400">Mesh Specification</label>
                    <input
                      type="text"
                      value={support.wireMeshType ?? ''}
                      onChange={(e) => updateSupport({ wireMeshType: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 3. Systematic Rock Bolts & Spacing */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase text-sky-300">
                3. Systematic Rock Bolts &amp; Spacing
              </span>
              <input
                type="checkbox"
                checked={Boolean(support.rockBoltsEnabled)}
                onChange={(e) => updateSupport({ rockBoltsEnabled: e.target.checked })}
                className="w-4 h-4 accent-sky-500 cursor-pointer"
              />
            </div>
            {support.rockBoltsEnabled && (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                <div>
                  <label className="block text-[10px] text-slate-400">Zone</label>
                  <select
                    value={support.rockBoltScope ?? 'crown_and_wall'}
                    onChange={(e) =>
                      updateSupport({
                        rockBoltScope: e.target.value as 'crown_only' | 'crown_and_wall',
                      })
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded px-1.5 py-1 text-white"
                  >
                    <option value="crown_only">Crown Only</option>
                    <option value="crown_and_wall">Crown + Wall</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400">Bolt Type</label>
                  <input
                    type="text"
                    value={support.rockBoltType ?? ''}
                    onChange={(e) => updateSupport({ rockBoltType: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-1.5 py-1 text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400">Length (m)</label>
                  <input
                    type="number"
                    step={0.5}
                    min={1.5}
                    max={12}
                    value={support.rockBoltLengthM ?? 4.0}
                    onChange={(e) =>
                      updateSupport({ rockBoltLengthM: Number(e.target.value) })
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded px-1.5 py-1 font-mono text-sky-300"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400">In-Plane Sp. (m)</label>
                  <input
                    type="number"
                    step={0.1}
                    min={0.5}
                    max={4}
                    value={support.rockBoltInPlaneSpacingM ?? 1.5}
                    onChange={(e) =>
                      updateSupport({ rockBoltInPlaneSpacingM: Number(e.target.value) })
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded px-1.5 py-1 font-mono text-sky-300"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400">Long. Sp. (m)</label>
                  <input
                    type="number"
                    step={0.1}
                    min={0.5}
                    max={4}
                    value={support.rockBoltLongitudinalSpacingM ?? 1.5}
                    onChange={(e) =>
                      updateSupport({
                        rockBoltLongitudinalSpacingM: Number(e.target.value),
                      })
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded px-1.5 py-1 font-mono text-sky-300"
                  />
                </div>
              </div>
            )}
          </div>

          {/* 4. Lattice Girder (LG) & ISMB Steel Rib */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* Lattice Girder */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase text-violet-300">
                  4. Lattice Girder (LG)
                </span>
                <input
                  type="checkbox"
                  checked={Boolean(support.latticeGirderEnabled)}
                  onChange={(e) =>
                    updateSupport({ latticeGirderEnabled: e.target.checked })
                  }
                  className="w-4 h-4 accent-violet-500 cursor-pointer"
                />
              </div>
              {support.latticeGirderEnabled && (
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="block text-[10px] text-slate-400">LG Spec</label>
                    <input
                      type="text"
                      value={support.latticeGirderSpec ?? ''}
                      onChange={(e) =>
                        updateSupport({ latticeGirderSpec: e.target.value })
                      }
                      className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400">Spacing (m)</label>
                    <input
                      type="number"
                      step={0.25}
                      min={0.5}
                      max={3}
                      value={support.latticeGirderSpacingM ?? 1.2}
                      onChange={(e) =>
                        updateSupport({
                          latticeGirderSpacingM: Number(e.target.value),
                        })
                      }
                      className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 font-mono text-violet-300"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* ISMB Steel Rib */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase text-orange-300">
                  5. ISMB Steel Rib
                </span>
                <input
                  type="checkbox"
                  checked={Boolean(support.ismbEnabled)}
                  onChange={(e) => updateSupport({ ismbEnabled: e.target.checked })}
                  className="w-4 h-4 accent-orange-500 cursor-pointer"
                />
              </div>
              {support.ismbEnabled && (
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="block text-[10px] text-slate-400">ISMB Section</label>
                    <select
                      value={support.ismbSpec ?? 'ISMB 150'}
                      onChange={(e) => updateSupport({ ismbSpec: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white"
                    >
                      <option value="ISMB 150">ISMB 150</option>
                      <option value="ISMB 200">ISMB 200</option>
                      <option value="ISMB 250">ISMB 250</option>
                      <option value="ISHB 150">ISHB 150</option>
                      <option value="ISHB 200">ISHB 200</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400">Spacing (m)</label>
                    <input
                      type="number"
                      step={0.25}
                      min={0.4}
                      max={3}
                      value={support.ismbSpacingM ?? 1.0}
                      onChange={(e) =>
                        updateSupport({ ismbSpacingM: Number(e.target.value) })
                      }
                      className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 font-mono text-orange-300"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 5B. Protection / Cavity Support (Forepoling, Pipe Roofing & Grouting) */}
          <FieldProtectionCavitySupportDesigner
            support={support}
            onUpdateSupport={updateSupport}
            location={activeLocation}
            round={activeRound}
            showLiveDrawing={false}
          />

          {/* 6. Interactive 3D Spot Bolt Locator & Angle Chooser (Also Pipe Roofing Umbrella & Forepoling) */}
          <div className="bg-slate-900 border border-rose-500/40 rounded-xl p-3 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
              <div>
                <div className="text-xs font-black uppercase text-rose-400 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-rose-400" />
                  <span>6. 3D Tunnel Support, Spot Bolt Angle Chooser &amp; Pipe Roofing Umbrella</span>
                </div>
                <p className="text-[10.5px] text-slate-400">
                  Select and visually choose spot bolt installation angle in true 3D, configure Pipe Roofing umbrella canopy look-out angle, Forepoling, and Pattern Rockbolts.
                </p>
              </div>

              {/* View Mode Switcher: 3D WebGL (Default) vs 2.5D SVG */}
              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
                <button
                  type="button"
                  onClick={() => setSpot3DViewMode('3D_WEBGL')}
                  className={`px-2.5 py-1 rounded font-bold transition-all cursor-pointer ${
                    spot3DViewMode === '3D_WEBGL'
                      ? 'bg-rose-600 text-white shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Interactive 3D WebGL
                </button>
                <button
                  type="button"
                  onClick={() => setSpot3DViewMode('2D_SVG')}
                  className={`px-2.5 py-1 rounded font-bold transition-all cursor-pointer ${
                    spot3DViewMode === '2D_SVG'
                      ? 'bg-slate-700 text-white shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  2.5D Profile SVG
                </button>
              </div>
            </div>

            {/* RENDER MODE 1: Interactive 3D WebGL Viewport & Angle Chooser */}
            {spot3DViewMode === '3D_WEBGL' ? (
              <FieldSupport3DInteractiveCanvas
                activeLocation={activeLocation}
                activeRound={activeRound}
                support={support}
                onUpdateSupport={updateSupport}
                newSpotLengthM={newSpotLengthM}
                setNewSpotLengthM={setNewSpotLengthM}
                newSpotAngleDeg={newSpotAngleDeg}
                setNewSpotAngleDeg={setNewSpotAngleDeg}
                newSpotAzimuthDeg={newSpotAzimuthDeg}
                setNewSpotAzimuthDeg={setNewSpotAzimuthDeg}
              />
            ) : (
              /* RENDER MODE 2: 2.5D SVG Profile */
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[11px] text-slate-400">Click anywhere to place Spot Bolt</span>
                  <div className="flex items-center gap-2">
                    <div>
                      <span className="text-[10px] text-slate-400 mr-1">Len (m):</span>
                      <input
                        type="number"
                        step={0.5}
                        min={1.5}
                        max={8}
                        value={newSpotLengthM}
                        onChange={(e) => setNewSpotLengthM(Number(e.target.value))}
                        className="w-12 bg-slate-950 border border-slate-700 rounded px-1 py-0.5 font-mono text-rose-300 text-center"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 mr-1">Angle (°):</span>
                      <input
                        type="number"
                        step={5}
                        min={10}
                        max={90}
                        value={newSpotAngleDeg}
                        onChange={(e) => setNewSpotAngleDeg(Number(e.target.value))}
                        className="w-12 bg-slate-950 border border-slate-700 rounded px-1 py-0.5 font-mono text-rose-300 text-center"
                      />
                    </div>
                  </div>
                </div>

                <svg
                  ref={spot3DSvgRef}
                  viewBox="0 0 420 270"
                  onClick={handle3DSpotBoltCanvasClick}
                  className="w-full max-h-[210px] bg-slate-950 rounded-lg border border-slate-700 cursor-crosshair block"
                >
                  {/* Left Wall 3D Polygon */}
                  <polygon
                    points={tunnel3DGeom.leftWallPointsStr}
                    fill="#0f172a"
                    stroke="#0f766e"
                    strokeWidth="1.6"
                  />
                  {/* Crown 3D Polygon */}
                  <polygon
                    points={tunnel3DGeom.crownPointsStr}
                    fill="#1e293b"
                    stroke="#0284c7"
                    strokeWidth="1.6"
                  />
                  {/* Right Wall 3D Polygon */}
                  <polygon
                    points={tunnel3DGeom.rightWallPointsStr}
                    fill="#0f172a"
                    stroke="#4338ca"
                    strokeWidth="1.6"
                  />
                  {/* Inner Excavation Face */}
                  <polygon
                    points={tunnel3DGeom.facePointsStr}
                    fill="#020617"
                    stroke="#f59e0b"
                    strokeWidth="2"
                  />

                  {/* Intermediate 3D Tunnel Shape Ribs */}
                  {[tunnel3DGeom.ring33, tunnel3DGeom.ring67].map((ring, rIdx) => (
                    <path
                      key={`ring-3d-${rIdx}`}
                      d={ring.wallStrokePathD}
                      fill="none"
                      stroke="#38bdf8"
                      strokeOpacity="0.28"
                      strokeWidth="1"
                      strokeDasharray="3 2"
                    />
                  ))}
                  {activeLocation.shape !== 'rectangular' && (
                    <g stroke="#38bdf8" strokeOpacity="0.55" strokeWidth="1.1" strokeDasharray="3 2">
                      <line
                        x1={tunnel3DGeom.outerOutline.leftSplPt.x}
                        y1={tunnel3DGeom.outerOutline.leftSplPt.y}
                        x2={tunnel3DGeom.innerOutline.leftSplPt.x}
                        y2={tunnel3DGeom.innerOutline.leftSplPt.y}
                      />
                      <line
                        x1={tunnel3DGeom.outerOutline.rightSplPt.x}
                        y1={tunnel3DGeom.outerOutline.rightSplPt.y}
                        x2={tunnel3DGeom.innerOutline.rightSplPt.x}
                        y2={tunnel3DGeom.innerOutline.rightSplPt.y}
                      />
                    </g>
                  )}
                  <line
                    x1={tunnel3DGeom.outerOutline.crownPeakPt.x}
                    y1={tunnel3DGeom.outerOutline.crownPeakPt.y}
                    x2={tunnel3DGeom.innerOutline.crownPeakPt.x}
                    y2={tunnel3DGeom.innerOutline.crownPeakPt.y}
                    stroke="#38bdf8"
                    strokeOpacity="0.4"
                    strokeWidth="1"
                    strokeDasharray="3 3"
                  />

                  {/* 0m -> Pull Labels */}
                  <text
                    x={Math.max(12, tunnel3DGeom.outerX - 4)}
                    y={Math.min(262, tunnel3DGeom.outerY + tunnel3DGeom.outerH + 12)}
                    fontSize="8.2"
                    fontWeight="800"
                    fill="#2dd4bf"
                  >
                    0m L.Wall ({surf3D.leftWallLengthM}m)
                  </text>
                  <text
                    x="210"
                    y="16"
                    textAnchor="middle"
                    fontSize="8.6"
                    fontWeight="900"
                    fill="#38bdf8"
                  >
                    3D {(activeLocation.shape || 'd_shaped').replace(/_/g, ' ').toUpperCase()} ({W}m W × {H}m H × {pullM}m Pull)
                  </text>
                  <text
                    x={Math.min(408, tunnel3DGeom.outerX + tunnel3DGeom.outerW + 4)}
                    y={Math.min(262, tunnel3DGeom.outerY + tunnel3DGeom.outerH + 12)}
                    textAnchor="end"
                    fontSize="8.2"
                    fontWeight="800"
                    fill="#818cf8"
                  >
                    0m R.Wall ({surf3D.rightWallLengthM}m)
                  </text>
                  <text
                    x="210"
                    y={tunnel3DGeom.innerY + tunnel3DGeom.innerH * 0.56}
                    textAnchor="middle"
                    fontSize="8.5"
                    fontWeight="800"
                    fill="#fbbf24"
                  >
                    FACE ({pullM}m | {W}m×{H}m)
                  </text>

                  {/* Render Placed Spot Bolts in 3D on Tunnel Profile (ONLY IF ENABLED) */}
                  {Boolean(support.spotBoltsEnabled) &&
                    (support.spotBolts || []).map((sb) => {
                      const tDepth = Math.max(0, Math.min(1, sb.pullMeter / Math.max(0.5, pullM)));
                      let px = tunnel3DGeom.cx3D;
                      let py = tunnel3DGeom.innerY + tunnel3DGeom.innerH * 0.5;
                      if (sb.panel === 'face') {
                        px = tunnel3DGeom.innerX + sb.u * tunnel3DGeom.innerW;
                        py = tunnel3DGeom.innerY + sb.v * tunnel3DGeom.innerH;
                      } else if (sb.panel === 'crown') {
                        const pOut = samplePointAlongPolyline(tunnel3DGeom.outerCrown, sb.v);
                        const pIn = samplePointAlongPolyline(tunnel3DGeom.innerCrown, sb.v);
                        px = pOut.x + (pIn.x - pOut.x) * tDepth;
                        py = pOut.y + (pIn.y - pOut.y) * tDepth;
                      } else if (sb.panel === 'left_wall') {
                        const wallRatio = Math.max(0, Math.min(1, 1 - sb.v));
                        const pOut = samplePointAlongPolyline(tunnel3DGeom.outerLeft, wallRatio);
                        const pIn = samplePointAlongPolyline(tunnel3DGeom.innerLeft, wallRatio);
                        px = pOut.x + (pIn.x - pOut.x) * tDepth;
                        py = pOut.y + (pIn.y - pOut.y) * tDepth;
                      } else {
                        const wallRatio = Math.max(0, Math.min(1, 1 - sb.v));
                        const pOut = samplePointAlongPolyline(tunnel3DGeom.outerRight, wallRatio);
                        const pIn = samplePointAlongPolyline(tunnel3DGeom.innerRight, wallRatio);
                        px = pOut.x + (pIn.x - pOut.x) * tDepth;
                        py = pOut.y + (pIn.y - pOut.y) * tDepth;
                      }
                      const rad = ((sb.angleDeg || 60) * Math.PI) / 180;
                      const dirSign = sb.panel === 'left_wall' ? -1 : 1;
                      const ex = px + dirSign * Math.cos(rad) * 20;
                      const ey = py - Math.sin(rad) * 20;
                      return (
                        <g key={sb.id}>
                          <line
                            x1={px}
                            y1={py}
                            x2={ex}
                            y2={ey}
                            stroke="#f43f5e"
                            strokeWidth="2.8"
                          />
                          <circle
                            cx={px}
                            cy={py}
                            r="4.5"
                            fill="#f43f5e"
                            stroke="#ffffff"
                            strokeWidth="1.4"
                          />
                          <text
                            x={ex + (dirSign >= 0 ? 4 : -4)}
                            y={ey}
                            textAnchor={dirSign >= 0 ? 'start' : 'end'}
                            fontSize="8.5"
                            fontWeight="900"
                            fill="#fda4af"
                          >
                            {sb.label} ({sb.pullMeter}m, ∠{sb.angleDeg}°)
                          </text>
                        </g>
                      );
                    })}
                </svg>
              </div>
            )}

            {/* Spot Bolts Schedule Table (ONLY IF ENABLED AND HAS BOLTS) */}
            {Boolean(support.spotBoltsEnabled) && (support.spotBolts || []).length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-slate-800 text-[11px]">
                  <thead>
                    <tr className="bg-slate-950 text-slate-300">
                      <th className="border border-slate-800 px-1.5 py-1">Bolt</th>
                      <th className="border border-slate-800 px-1.5 py-1">Area</th>
                      <th className="border border-slate-800 px-1.5 py-1">Pull (m)</th>
                      <th className="border border-slate-800 px-1.5 py-1">X (m)</th>
                      <th className="border border-slate-800 px-1.5 py-1">Y (m)</th>
                      <th className="border border-slate-800 px-1.5 py-1">Len (m)</th>
                      <th className="border border-slate-800 px-1.5 py-1">Angle (°)</th>
                      <th className="border border-slate-800 px-1.5 py-1"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {support.spotBolts.map((sb) => (
                      <tr key={sb.id} className="bg-slate-950/60">
                        <td className="border border-slate-800 px-1.5 py-1 font-mono font-bold text-rose-300">
                          {sb.label}
                        </td>
                        <td className="border border-slate-800 px-1.5 py-1 uppercase text-[10px]">
                          {sb.panel.replace('_', ' ')}
                        </td>
                        <td className="border border-slate-800 px-1 py-1">
                          <input
                            type="number"
                            step={0.1}
                            value={sb.pullMeter}
                            onChange={(e) =>
                              updateSupport({
                                spotBolts: support.spotBolts.map((item) =>
                                  item.id === sb.id
                                    ? { ...item, pullMeter: Number(e.target.value) }
                                    : item
                                ),
                              })
                            }
                            className="w-12 bg-slate-900 border border-slate-700 rounded px-1 text-center font-mono text-white"
                          />
                        </td>
                        <td className="border border-slate-800 px-1 py-1">
                          <input
                            type="number"
                            step={0.1}
                            value={sb.xMeters}
                            onChange={(e) =>
                              updateSupport({
                                spotBolts: support.spotBolts.map((item) =>
                                  item.id === sb.id
                                    ? { ...item, xMeters: Number(e.target.value) }
                                    : item
                                ),
                              })
                            }
                            className="w-12 bg-slate-900 border border-slate-700 rounded px-1 text-center font-mono text-white"
                          />
                        </td>
                        <td className="border border-slate-800 px-1 py-1">
                          <input
                            type="number"
                            step={0.1}
                            value={sb.yMeters}
                            onChange={(e) =>
                              updateSupport({
                                spotBolts: support.spotBolts.map((item) =>
                                  item.id === sb.id
                                    ? { ...item, yMeters: Number(e.target.value) }
                                    : item
                                ),
                              })
                            }
                            className="w-12 bg-slate-900 border border-slate-700 rounded px-1 text-center font-mono text-white"
                          />
                        </td>
                        <td className="border border-slate-800 px-1 py-1">
                          <input
                            type="number"
                            step={0.5}
                            value={sb.lengthM}
                            onChange={(e) =>
                              updateSupport({
                                spotBolts: support.spotBolts.map((item) =>
                                  item.id === sb.id
                                    ? { ...item, lengthM: Number(e.target.value) }
                                    : item
                                ),
                              })
                            }
                            className="w-12 bg-slate-900 border border-slate-700 rounded px-1 text-center font-mono text-white"
                          />
                        </td>
                        <td className="border border-slate-800 px-1 py-1">
                          <input
                            type="number"
                            step={5}
                            value={sb.angleDeg}
                            onChange={(e) =>
                              updateSupport({
                                spotBolts: support.spotBolts.map((item) =>
                                  item.id === sb.id
                                    ? { ...item, angleDeg: Number(e.target.value) }
                                    : item
                                ),
                              })
                            }
                            className="w-12 bg-slate-900 border border-slate-700 rounded px-1 text-center font-mono text-amber-300"
                          />
                        </td>
                        <td className="border border-slate-800 px-1.5 py-1 text-center">
                          <button
                            type="button"
                            onClick={() =>
                              updateSupport({
                                spotBolts: support.spotBolts.filter(
                                  (item) => item.id !== sb.id
                                ),
                              })
                            }
                            className="text-rose-400 hover:text-rose-300 cursor-pointer"
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
        </div>

        {/* Right 6 Columns: Live Professional 2D Support System Cross-Section Outline Drawing */}
        <div className="lg:col-span-6 min-h-0 bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-col gap-2 overflow-y-auto">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-amber-400">
              Live 2D Support System Drawing (Auto-Included in Report)
            </span>
            <span className="text-[11px] font-mono text-slate-400">
              {support.supportClass}
            </span>
          </div>

          <div className="flex-1 flex items-center justify-center">
            <FieldSupportSystem2DDrawingSvg
              location={activeLocation}
              round={activeRound}
              support={support}
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
              Support Recommendation &amp; Field Notes (Synced with Report)
            </label>
            <textarea
              rows={2}
              value={activeRound.rockSupportRecommendation ?? ''}
              onChange={(e) =>
                onUpdateRound((r) => ({
                  ...r,
                  rockSupportRecommendation: e.target.value,
                }))
              }
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// STAGE 5D: DEDICATED SURVEY OVERBREAK WINDOW
// Locate Points on Tunnel Face, Connect Trace, Calculate Overbreak Area (m²) &
// Overbreak Amount (m³), Choose Mechanical or Geological Cause & Reason,
// or Skip / Feed Later (which omits Survey Overbreak Outline from Report!)
// ============================================================================
export const FieldSurveyOverbreakStage: React.FC<{
  activeProject?: FieldProjectItem;
  activeLocation: FieldTunnelLocationItem;
  activeRound: FieldExcavationRound;
  onUpdateProject?: (updater: (prev: FieldProjectItem) => FieldProjectItem) => void;
  onUpdateRound: (updater: (prev: FieldExcavationRound) => FieldExcavationRound) => void;
  onBackToSupport: () => void;
  onContinueToReport: () => void;
}> = ({
  activeProject,
  activeLocation,
  activeRound,
  onUpdateProject,
  onUpdateRound,
  onBackToSupport,
  onContinueToReport,
}) => {
  const faceSvgRef = useRef<SVGSVGElement | null>(null);
  const [showTemplateEditor, setShowTemplateEditor] = useState<boolean>(false);
  const [draggingPointIdx, setDraggingPointIdx] = useState<number | null>(null);
  const [hoverCoord, setHoverCoord] = useState<{ x: number; y: number } | null>(null);
  const [selectedPointIdx, setSelectedPointIdx] = useState<number | null>(null);
  const [customDevMmInput, setCustomDevMmInput] = useState<string>('');
  const survey = useMemo(
    () => ({
      ...createDefaultSurveyOverbreak(activeLocation),
      ...(activeRound.surveyOverbreak || {}),
      surveyPoints: Array.isArray(activeRound.surveyOverbreak?.surveyPoints)
        ? activeRound.surveyOverbreak.surveyPoints
        : [],
    }),
    [activeRound.surveyOverbreak, activeLocation]
  );

  const W = Math.max(2, activeLocation.widthM || 8);
  const H = Math.max(2, activeLocation.heightM || 7);
  const pullM = Math.max(0.5, activeRound.pullLengthMeters || 3.0);

  // Design tunnel face outline inside 600x460 SVG with proportional aspect ratio matching W x H
  const maxBoxW = 430;
  const maxBoxH = 350;
  const scalePxPerM = Math.min(maxBoxW / W, maxBoxH / H);
  const boxW = Math.round(W * scalePxPerM);
  const boxH = Math.round(H * scalePxPerM);
  const boxX = Math.round(300 - boxW / 2);
  const boxY = Math.round(230 - boxH / 2);

  const faceDetails = useMemo(
    () => computeFaceTunnelOutlineDetails(activeLocation, boxX, boxY, boxW, boxH),
    [activeLocation, boxX, boxY, boxW, boxH]
  );

  const designPolyPts = useMemo(() => {
    const raw = [
      ...(faceDetails.leftWallPoly || []),
      ...(faceDetails.crownPoly || []),
      ...(faceDetails.rightWallPoly || []).slice().reverse(),
      ...(faceDetails.invertPoly || []).slice().reverse(),
    ];
    return raw.length >= 3
      ? raw
      : [
          { x: boxX, y: boxY + boxH },
          { x: boxX, y: boxY + boxH * 0.45 },
          { x: boxX + boxW / 2, y: boxY },
          { x: boxX + boxW, y: boxY + boxH * 0.45 },
          { x: boxX + boxW, y: boxY + boxH },
        ];
  }, [faceDetails, boxX, boxY, boxW, boxH]);

  // Shoelace polygon area in square meters
  const computePolygonAreaM2 = (pts: { x: number; y: number }[]) => {
    if (pts.length < 3) return 0;
    let sum = 0;
    for (let i = 0; i < pts.length; i++) {
      const p0 = pts[i];
      const p1 = pts[(i + 1) % pts.length];
      // Convert SVG (x,y) to meters
      const x0m = ((p0.x - boxX) / boxW) * W;
      const y0m = ((p0.y - boxY) / boxH) * H;
      const x1m = ((p1.x - boxX) / boxW) * W;
      const y1m = ((p1.y - boxY) / boxH) * H;
      sum += x0m * y1m - x1m * y0m;
    }
    return Math.abs(sum) / 2;
  };

  const designAreaM2 = useMemo(
    () => Number(computePolygonAreaM2(designPolyPts).toFixed(2)),
    [designPolyPts, W, H]
  );

  const paylineOffsetMm = survey.paylineOffsetMm ?? 150;
  const paylineEnabled = survey.paylineEnabled !== false;
  const scaleX = boxW / Math.max(0.1, W);
  const scaleY = boxH / Math.max(0.1, H);
  const centroid = useMemo(
    () => ({ x: boxX + boxW / 2, y: boxY + boxH * 0.55 }),
    [boxX, boxW, boxY, boxH]
  );

  const paylinePolyPts = useMemo(() => {
    return computePaylinePolygon(
      designPolyPts,
      paylineOffsetMm / 1000,
      scaleX,
      scaleY,
      centroid
    );
  }, [designPolyPts, paylineOffsetMm, scaleX, scaleY, centroid]);

  const paylineAreaM2 = useMemo(
    () => Number(computePolygonAreaM2(paylinePolyPts).toFixed(2)),
    [paylinePolyPts, boxX, boxW, boxY, boxH, W, H]
  );

  // Automatically sync professional geological & overbreak description when entering stage if default or unpopulated
  useEffect(() => {
    const defaultInitDesc =
      'Moderately jointed, fresh to slightly weathered grey Quartzite with thin foliated Phyllite / Shale bands and minor tight quartz veins. Face is generally stable with damp seepage along J1/J2 intersections.';
    const currDesc = (activeRound.geologicalDescription || '').trim();
    if (!currDesc || currDesc === defaultInitDesc || !currDesc.includes('Overbreak Assessment:')) {
      onUpdateRound((r) => {
        const currSurv = r.surveyOverbreak || createDefaultSurveyOverbreak(activeLocation);
        const autoReason = generateOverbreakSummarySentence(r, activeLocation);
        const nextWithReason: FieldExcavationRound = {
          ...r,
          surveyOverbreak: {
            ...currSurv,
            overbreakReason: autoReason,
          },
        };
        return {
          ...nextWithReason,
          geologicalDescription: generateProfessionalGeologicalDescription(
            nextWithReason,
            activeLocation
          ),
          overbreakNotes: autoReason,
        };
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRound.id]);

  // Recalculate Overbreak Area (m²), Overbreak Amount (m³), Overbreak %, and Max Depth (m) whenever survey points change
  const recomputeOverbreakMetrics = (
    pts: FieldPoint2D[],
    statusOverride?: FieldSurveyOverbreakData['status'],
    patch?: Partial<FieldSurveyOverbreakData>
  ) => {
    onUpdateRound((r) => {
      const curr = r.surveyOverbreak || createDefaultSurveyOverbreak(activeLocation);
      const status = statusOverride ?? curr.status;

      const effectivePaylineOffsetMm =
        patch?.paylineOffsetMm ?? curr.paylineOffsetMm ?? 150;
      const effectivePaylineEnabled =
        patch?.paylineEnabled ?? (curr.paylineEnabled !== false);

      const dynamicPaylinePoly =
        effectivePaylineOffsetMm === paylineOffsetMm
          ? paylinePolyPts
          : computePaylinePolygon(
              designPolyPts,
              effectivePaylineOffsetMm / 1000,
              scaleX,
              scaleY,
              centroid
            );
      const effectivePaylineAreaM2 =
        patch?.paylineAreaM2 ??
        Number(computePolygonAreaM2(dynamicPaylinePoly).toFixed(2));
      const allowableOverbreakArea = Math.max(0, effectivePaylineAreaM2 - designAreaM2);

      let nextSurvey: FieldSurveyOverbreakData;

      if (pts.length < 3) {
        nextSurvey = {
          ...curr,
          ...patch,
          status,
          surveyPoints: pts,
          designAreaM2,
          excavatedAreaM2: designAreaM2,
          overbreakAreaM2: 0,
          underbreakAreaM2: 0,
          overbreakPercent: 0,
          overbreakVolumeM3: 0,
          maxOverbreakDepthM: 0,
          paylineEnabled: effectivePaylineEnabled,
          paylineOffsetMm: effectivePaylineOffsetMm,
          paylineAreaM2: effectivePaylineAreaM2,
          permissibleOverbreakAreaM2: 0,
          permissibleOverbreakVolumeM3: 0,
          realOverbreakAreaM2: 0,
          realOverbreakPercent: 0,
          realOverbreakVolumeM3: 0,
          isRealOverbreak: false,
          overbreakContractStatus: 'exact_design',
        };
      } else {
        const closedPts = [...pts, { x: boxX + boxW, y: boxY + boxH }, { x: boxX, y: boxY + boxH }];
        const excavArea = computePolygonAreaM2(closedPts);
        const diffArea = excavArea - designAreaM2;
        const obArea = Number(Math.max(0, diffArea).toFixed(2));
        const ubArea = Number(Math.max(0, -diffArea).toFixed(2));
        const obPct = Number(((obArea / Math.max(1, designAreaM2)) * 100).toFixed(1));
        const obVolM3 = Number((obArea * pullM).toFixed(2));

        let permissibleOverbreakAreaM2 = 0;
        let permissibleOverbreakVolumeM3 = 0;
        let realOverbreakAreaM2 = 0;
        let realOverbreakPercent = 0;
        let realOverbreakVolumeM3 = 0;
        let isRealOverbreak = false;
        let overbreakContractStatus: 'within_payline' | 'real_overbreak' | 'exact_design' = 'exact_design';

        if (obArea > 0) {
          if (effectivePaylineEnabled) {
            permissibleOverbreakAreaM2 = Number(
              Math.min(obArea, allowableOverbreakArea).toFixed(2)
            );
            permissibleOverbreakVolumeM3 = Number(
              (permissibleOverbreakAreaM2 * pullM).toFixed(2)
            );
            realOverbreakAreaM2 = Number(
              Math.max(0, excavArea - effectivePaylineAreaM2).toFixed(2)
            );
            realOverbreakPercent = Number(
              ((realOverbreakAreaM2 / Math.max(1, designAreaM2)) * 100).toFixed(1)
            );
            realOverbreakVolumeM3 = Number(
              (realOverbreakAreaM2 * pullM).toFixed(2)
            );
            isRealOverbreak = realOverbreakAreaM2 > 0.01;
            overbreakContractStatus = isRealOverbreak
              ? 'real_overbreak'
              : 'within_payline';
          } else {
            realOverbreakAreaM2 = obArea;
            realOverbreakPercent = obPct;
            realOverbreakVolumeM3 = obVolM3;
            isRealOverbreak = obArea > 0.01;
            overbreakContractStatus = isRealOverbreak
              ? 'real_overbreak'
              : 'exact_design';
          }
        }

        // Compute max outward distance from design perimeter in meters
        let maxDepthM = 0;
        const centerSvgX = boxX + boxW / 2;
        const centerSvgY = boxY + boxH * 0.6;
        for (const sp of pts) {
          let nearestDistM = Infinity;
          for (const dp of designPolyPts) {
            const dxM = ((sp.x - dp.x) / boxW) * W;
            const dyM = ((sp.y - dp.y) / boxH) * H;
            const dM = Math.hypot(dxM, dyM);
            if (dM < nearestDistM) nearestDistM = dM;
          }
          const rSp = Math.hypot(sp.x - centerSvgX, sp.y - centerSvgY);
          // Check if outside design polygon
          let nearestDp = designPolyPts[0];
          let minD = Infinity;
          for (const dp of designPolyPts) {
            const d = Math.hypot(sp.x - dp.x, sp.y - dp.y);
            if (d < minD) {
              minD = d;
              nearestDp = dp;
            }
          }
          const rDp = Math.hypot(nearestDp.x - centerSvgX, nearestDp.y - centerSvgY);
          if (rSp > rDp && nearestDistM > maxDepthM) {
            maxDepthM = nearestDistM;
          }
        }

        const effectiveCause =
          patch?.overbreakCause ??
          (obArea > 0 && curr.overbreakCause === 'no_overbreak'
            ? 'geological'
            : curr.overbreakCause);

        nextSurvey = {
          ...curr,
          ...patch,
          overbreakCause: effectiveCause,
          status,
          surveyPoints: pts,
          designAreaM2,
          excavatedAreaM2: Number(excavArea.toFixed(2)),
          overbreakAreaM2: obArea,
          underbreakAreaM2: ubArea,
          overbreakPercent: obPct,
          overbreakVolumeM3: obVolM3,
          maxOverbreakDepthM: Number(maxDepthM.toFixed(2)),
          paylineEnabled: effectivePaylineEnabled,
          paylineOffsetMm: effectivePaylineOffsetMm,
          paylineAreaM2: effectivePaylineAreaM2,
          permissibleOverbreakAreaM2,
          permissibleOverbreakVolumeM3,
          realOverbreakAreaM2,
          realOverbreakPercent,
          realOverbreakVolumeM3,
          isRealOverbreak,
          overbreakContractStatus,
        };
      }

      const tempRound: FieldExcavationRound = {
        ...r,
        surveyOverbreak: nextSurvey,
      };
      const autoObReason = generateOverbreakSummarySentence(tempRound, activeLocation);
      nextSurvey.overbreakReason = autoObReason;
      const autoFullDesc = generateProfessionalGeologicalDescription(
        { ...tempRound, surveyOverbreak: nextSurvey },
        activeLocation
      );

      return {
        ...r,
        surveyOverbreak: nextSurvey,
        geologicalDescription: autoFullDesc,
        overbreakNotes: autoObReason,
      };
    });
  };

  // Helper to find nearest point on design polygon and the outward normal vector
  const getDesignNormalAtPoint = (pt: { x: number; y: number }) => {
    const centerSvgX = boxX + boxW / 2;
    const centerSvgY = boxY + boxH * 0.6;
    let nearestDp = designPolyPts[0] || { x: centerSvgX, y: centerSvgY };
    let minD = Infinity;
    for (const dp of designPolyPts) {
      const d = Math.hypot(pt.x - dp.x, pt.y - dp.y);
      if (d < minD) {
        minD = d;
        nearestDp = dp;
      }
    }
    const vX = nearestDp.x - centerSvgX;
    const vY = nearestDp.y - centerSvgY;
    const len = Math.hypot(vX, vY) || 1;
    const nx = vX / len;
    const ny = vY / len;
    return { nearestDp, nx, ny };
  };

  const computePointDeviationMm = (pt: { x: number; y: number }): number => {
    const centerSvgX = boxX + boxW / 2;
    const centerSvgY = boxY + boxH * 0.6;
    const { nearestDp } = getDesignNormalAtPoint(pt);
    const rPt = Math.hypot(pt.x - centerSvgX, pt.y - centerSvgY);
    const rDp = Math.hypot(nearestDp.x - centerSvgX, nearestDp.y - centerSvgY);
    const isOutward = rPt >= rDp;
    const distPx = Math.hypot(pt.x - nearestDp.x, pt.y - nearestDp.y);
    const avgPxPerM = (scaleX + scaleY) / 2;
    const distM = distPx / Math.max(0.1, avgPxPerM);
    const mm = Math.round(distM * 1000);
    return isOutward ? mm : -mm;
  };

  const handleSetPointDeviationMm = (pIdx: number, devMm: number) => {
    if (!survey.surveyPoints || pIdx < 0 || pIdx >= survey.surveyPoints.length) return;
    const pt = survey.surveyPoints[pIdx];
    const { nearestDp, nx, ny } = getDesignNormalAtPoint(pt);
    const avgPxPerM = (scaleX + scaleY) / 2;
    const offsetPx = (devMm / 1000) * avgPxPerM;
    const newX = Number((nearestDp.x + nx * offsetPx).toFixed(1));
    const newY = Number((nearestDp.y + ny * offsetPx).toFixed(1));
    const xM = Number((((newX - (boxX + boxW / 2)) / boxW) * W).toFixed(2));
    const yM = Number((((boxY + boxH - newY) / boxH) * H).toFixed(2));
    const nextPts = [...survey.surveyPoints];
    nextPts[pIdx] = {
      ...pt,
      x: newX,
      y: newY,
      xM,
      yM,
      deviationMm: devMm,
    };
    recomputeOverbreakMetrics(nextPts, 'completed');
  };

  // Accurate SVG coordinate calculation using getScreenCTM().inverse()
  const getSvgCoordinatesFromPointer = (clientX: number, clientY: number): { x: number; y: number } | null => {
    const svg = faceSvgRef.current;
    if (!svg) return null;
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const svgP = pt.matrixTransform(ctm.inverse());
    return {
      x: Number(Math.max(10, Math.min(590, svgP.x)).toFixed(1)),
      y: Number(Math.max(10, Math.min(450, svgP.y)).toFixed(1)),
    };
  };

  const handleFaceCanvasPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    // If user tapped directly on a survey point, point dragging is handled by that handle
    if ((e.target as Element)?.closest('[data-survey-point]')) {
      return;
    }
    const coords = getSvgCoordinatesFromPointer(e.clientX, e.clientY);
    if (!coords) return;
    const xM = Number((((coords.x - (boxX + boxW / 2)) / boxW) * W).toFixed(2));
    const yM = Number((((boxY + boxH - coords.y) / boxH) * H).toFixed(2));
    const devMm = computePointDeviationMm(coords);
    const nextPts = [...(survey.surveyPoints || []), { ...coords, xM, yM, deviationMm: devMm }];
    recomputeOverbreakMetrics(nextPts, 'completed');
    setSelectedPointIdx(nextPts.length - 1);
  };

  const handleFaceCanvasPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const coords = getSvgCoordinatesFromPointer(e.clientX, e.clientY);
    if (!coords) return;
    setHoverCoord(coords);

    if (draggingPointIdx !== null && survey.surveyPoints && draggingPointIdx < survey.surveyPoints.length) {
      const nextPts = [...survey.surveyPoints];
      const xM = Number((((coords.x - (boxX + boxW / 2)) / boxW) * W).toFixed(2));
      const yM = Number((((boxY + boxH - coords.y) / boxH) * H).toFixed(2));
      const devMm = computePointDeviationMm(coords);
      nextPts[draggingPointIdx] = { ...coords, xM, yM, deviationMm: devMm };
      recomputeOverbreakMetrics(nextPts, 'completed');
    }
  };

  const handleFaceCanvasPointerUp = () => {
    setDraggingPointIdx(null);
  };

  const handleAutoSampleOverbreakTrace = () => {
    const samplePts = designPolyPts.map((p, idx) => {
      const cx = boxX + boxW / 2;
      const cy = boxY + boxH * 0.65;
      const dx = p.x - cx;
      const dy = p.y - cy;
      const len = Math.hypot(dx, dy) || 1;
      // Add realistic crown/shoulder overbreak (12–26px outward)
      const extraPx = idx > 3 && idx < designPolyPts.length - 3 ? 18 + (idx % 3) * 5 : 4;
      const xVal = Number((p.x + (dx / len) * extraPx).toFixed(1));
      const yVal = Number((p.y + (dy / len) * extraPx).toFixed(1));
      const xM = Number((((xVal - (boxX + boxW / 2)) / boxW) * W).toFixed(2));
      const yM = Number((((boxY + boxH - yVal) / boxH) * H).toFixed(2));
      const devMm = computePointDeviationMm({ x: xVal, y: yVal });
      return {
        x: xVal,
        y: yVal,
        xM,
        yM,
        deviationMm: devMm,
      };
    });
    recomputeOverbreakMetrics(samplePts, 'completed', {
      overbreakCause:
        survey.overbreakCause === 'no_overbreak' ? 'geological' : survey.overbreakCause,
    });
  };

  const handleRegenerateProfessionalDescription = () => {
    onUpdateRound((r) => {
      const currSurv = r.surveyOverbreak || createDefaultSurveyOverbreak(activeLocation);
      const autoReason = generateOverbreakSummarySentence(r, activeLocation);
      const nextSurv = {
        ...currSurv,
        overbreakReason: autoReason,
      };
      const fullDesc = generateProfessionalGeologicalDescription(
        { ...r, surveyOverbreak: nextSurv },
        activeLocation
      );
      return {
        ...r,
        surveyOverbreak: nextSurv,
        geologicalDescription: fullDesc,
        overbreakNotes: autoReason,
      };
    });
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-2 p-2 sm:p-3 bg-slate-950 overflow-hidden">
      {/* Top Bar: Survey Status (Record Survey | Skip Survey | Feed Later) + Navigation */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 flex items-center justify-between gap-1.5 shrink-0 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-1.5 shrink-0 overflow-x-auto no-scrollbar">
          <Crosshair className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="text-xs font-black uppercase tracking-wider text-amber-400 whitespace-nowrap">
            Survey &amp; Overbreak
          </span>

          {/* Status Selector: Completed vs Skip vs Feed Later */}
          <div className="flex items-center gap-0.5 bg-slate-950 border border-slate-700 rounded-lg p-0.5 shrink-0">
            <button
              type="button"
              onClick={() =>
                recomputeOverbreakMetrics(survey.surveyPoints || [], 'completed')
              }
              className={`px-2 py-0.5 rounded text-[11px] font-black cursor-pointer whitespace-nowrap ${
                survey.status === 'completed'
                  ? 'bg-emerald-500 text-slate-950 shadow'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              1. Feed Now
            </button>
            <button
              type="button"
              onClick={() =>
                recomputeOverbreakMetrics(survey.surveyPoints || [], 'feed_later')
              }
              className={`px-2 py-0.5 rounded text-[11px] font-black cursor-pointer whitespace-nowrap ${
                survey.status === 'feed_later'
                  ? 'bg-amber-500 text-slate-950 shadow'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              2. Feed Later
            </button>
            <button
              type="button"
              onClick={() =>
                recomputeOverbreakMetrics(survey.surveyPoints || [], 'skipped')
              }
              className={`px-2 py-0.5 rounded text-[11px] font-black cursor-pointer whitespace-nowrap ${
                survey.status === 'skipped'
                  ? 'bg-rose-500 text-white shadow'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              3. Skip
            </button>
          </div>

          {activeProject && onUpdateProject && (
            <button
              type="button"
              onClick={() => setShowTemplateEditor((prev) => !prev)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 border cursor-pointer transition-all ${
                showTemplateEditor
                  ? 'bg-amber-500 text-slate-950 border-amber-300 shadow'
                  : 'bg-slate-800 hover:bg-slate-700 text-amber-300 border-amber-500/40'
              }`}
              title="Open or close Template Edit Options (Header Logos, Missing Tick-Boxes & Custom Word Template)"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>{showTemplateEditor ? 'Close Template Edit' : 'Template Edit'}</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBackToSupport}
            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center gap-1 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Support System
          </button>
          <button
            type="button"
            onClick={onContinueToReport}
            className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow cursor-pointer"
          >
            <span>Next: Final Report</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {showTemplateEditor && activeProject && onUpdateProject && (
        <FieldReportTemplateEditorPanel
          activeProject={activeProject}
          activeLocation={activeLocation}
          activeRound={activeRound}
          onUpdateProject={onUpdateProject}
          onUpdateRound={onUpdateRound}
          onClose={() => setShowTemplateEditor(false)}
          className="max-h-[420px] shrink-0"
        />
      )}

      {/* Main 12-Col Survey Workspace: Main Importance for Survey Canvas */}
      <div className="flex-1 min-h-0 grid grid-cols-1 landscape:grid-cols-12 lg:grid-cols-12 gap-2 overflow-hidden">
        {/* Left Columns (8 of 12 in landscape/desktop): Interactive Tunnel Face Point Locator & Overbreak Trace Connector (Canvas — Main Importance) */}
        <div className="landscape:col-span-8 lg:col-span-8 xl:col-span-8 min-h-0 h-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 flex flex-col gap-2 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 shrink-0">
            <div>
              <div className="text-xs font-black uppercase text-cyan-400">
                Tunnel Face Survey Point Locator (Click to Locate Points &amp; Connect Overbreak Trace)
              </div>
              <div className="text-[11px] text-slate-400">
                Click around the tunnel face perimeter to locate surveyed excavation points. They automatically connect to compute Overbreak Area &amp; Amount.
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleAutoSampleOverbreakTrace}
                className="px-2.5 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/50 text-cyan-300 text-xs font-bold cursor-pointer"
              >
                + Sample Survey Profile
              </button>
              <button
                type="button"
                onClick={() =>
                  recomputeOverbreakMetrics(
                    (survey.surveyPoints || []).slice(0, -1),
                    survey.status
                  )
                }
                disabled={!survey.surveyPoints?.length}
                className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 text-xs font-bold cursor-pointer"
              >
                Undo Pt
              </button>
              <button
                type="button"
                onClick={() => recomputeOverbreakMetrics([], survey.status)}
                className="px-2 py-1 rounded-lg bg-rose-950/80 hover:bg-rose-900 text-rose-200 text-xs font-bold cursor-pointer"
              >
                Clear
              </button>
            </div>
          </div>

          <div className="flex-1 min-h-0 h-full w-full flex items-center justify-center bg-slate-950 rounded-xl border border-slate-800 p-2 overflow-hidden">
            <svg
              ref={faceSvgRef}
              viewBox="0 0 600 460"
              onPointerDown={handleFaceCanvasPointerDown}
              onPointerMove={handleFaceCanvasPointerMove}
              onPointerUp={handleFaceCanvasPointerUp}
              onPointerLeave={() => {
                setHoverCoord(null);
                setDraggingPointIdx(null);
              }}
              className="w-full h-full max-h-full bg-white rounded-lg border border-slate-700 cursor-crosshair block select-none touch-none object-contain"
            >
              {/* 1m × 1m Coordinate Grid */}
              {Array.from({ length: Math.floor(W) + 1 }).map((_, idx) => {
                const xm = idx - Math.floor(W / 2);
                const xPx = boxX + boxW / 2 + (xm / W) * boxW;
                return (
                  <g key={`sv-gx-${idx}`}>
                    <line
                      x1={xPx}
                      y1={boxY - 25}
                      x2={xPx}
                      y2={boxY + boxH + 15}
                      stroke={xm === 0 ? '#0284c7' : '#e2e8f0'}
                      strokeWidth={xm === 0 ? '1.4' : '1'}
                      strokeDasharray={xm === 0 ? '4 2' : undefined}
                    />
                    <text
                      x={xPx}
                      y={boxY + boxH + 28}
                      textAnchor="middle"
                      fontSize="9.5"
                      fontWeight="800"
                      fontFamily="IBM Plex Mono, monospace"
                      fill="#475569"
                    >
                      {xm > 0 ? `+${xm}m` : `${xm}m`}
                    </text>
                  </g>
                );
              })}
              {Array.from({ length: Math.floor(H) + 1 }).map((_, idx) => {
                const ym = idx;
                const yPx = boxY + boxH - (ym / H) * boxH;
                return (
                  <g key={`sv-gy-${idx}`}>
                    <line
                      x1={boxX - 25}
                      y1={yPx}
                      x2={boxX + boxW + 25}
                      y2={yPx}
                      stroke="#e2e8f0"
                      strokeWidth="1"
                    />
                    <text
                      x={boxX - 30}
                      y={yPx + 3}
                      textAnchor="end"
                      fontSize="9.5"
                      fontWeight="800"
                      fontFamily="IBM Plex Mono, monospace"
                      fill="#475569"
                    >
                      {ym}m
                    </text>
                  </g>
                );
              })}

              {/* Contractual Payline Boundary Outline (+150mm standard / user-fed) */}
              {survey.paylineEnabled !== false && paylinePolyPts.length >= 3 && (
                <g pointerEvents="none">
                  <polygon
                    points={paylinePolyPts
                      .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
                      .join(' ')}
                    fill="rgba(16, 185, 129, 0.08)"
                    stroke="#059669"
                    strokeWidth="2.0"
                    strokeDasharray="7 3"
                  />
                  {paylinePolyPts[Math.floor(paylinePolyPts.length * 0.28)] && (
                    <text
                      x={paylinePolyPts[Math.floor(paylinePolyPts.length * 0.28)].x}
                      y={paylinePolyPts[Math.floor(paylinePolyPts.length * 0.28)].y - 6}
                      fontSize="9.5"
                      fontWeight="900"
                      fontFamily="IBM Plex Mono, monospace"
                      fill="#059669"
                      stroke="#ffffff"
                      strokeWidth="2.5"
                      paintOrder="stroke"
                    >
                      PAYLINE (+{survey.paylineOffsetMm ?? 150}mm)
                    </text>
                  )}
                </g>
              )}

              {/* Shaded Overbreak Area Polygon (Behind Design Profile) */}
              {(survey.surveyPoints || []).length >= 3 && (
                <polygon
                  points={[
                    ...(survey.surveyPoints || []),
                    { x: boxX + boxW, y: boxY + boxH },
                    { x: boxX, y: boxY + boxH },
                  ]
                    .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
                    .join(' ')}
                  fill={
                    survey.isRealOverbreak
                      ? 'rgba(239, 68, 68, 0.25)'
                      : 'rgba(16, 185, 129, 0.22)'
                  }
                  stroke={survey.isRealOverbreak ? '#dc2626' : '#059669'}
                  strokeWidth="2.4"
                  strokeDasharray="6 3"
                />
              )}

              {/* Design Tunnel Face Outline */}
              <polygon
                points={designPolyPts
                  .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
                  .join(' ')}
                fill="rgba(255, 255, 255, 0.88)"
                stroke="#0f172a"
                strokeWidth="2.6"
              />

              {/* Connected Survey Trace & Located Survey Points */}
              {(survey.surveyPoints || []).length >= 2 && (
                <polyline
                  points={(survey.surveyPoints || [])
                    .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
                    .join(' ')}
                  fill="none"
                  stroke={survey.isRealOverbreak ? '#dc2626' : '#059669'}
                  strokeWidth="2.8"
                />
              )}

              {/* Real-time Crosshair Reticle for Finger / Mouse Touch */}
              {hoverCoord && (
                <g pointerEvents="none">
                  <line
                    x1={hoverCoord.x}
                    y1={boxY - 25}
                    x2={hoverCoord.x}
                    y2={boxY + boxH + 20}
                    stroke="#0284c7"
                    strokeWidth="1.2"
                    strokeDasharray="3 3"
                    opacity="0.8"
                  />
                  <line
                    x1={boxX - 25}
                    y1={hoverCoord.y}
                    x2={boxX + boxW + 25}
                    y2={hoverCoord.y}
                    stroke="#0284c7"
                    strokeWidth="1.2"
                    strokeDasharray="3 3"
                    opacity="0.8"
                  />
                  <circle
                    cx={hoverCoord.x}
                    cy={hoverCoord.y}
                    r="6"
                    fill="none"
                    stroke="#0284c7"
                    strokeWidth="2"
                  />
                  <text
                    x={hoverCoord.x + 8}
                    y={hoverCoord.y - 8}
                    fontSize="9.5"
                    fontWeight="900"
                    fontFamily="IBM Plex Mono, monospace"
                    fill="#0284c7"
                    stroke="#ffffff"
                    strokeWidth="2.5"
                    paintOrder="stroke"
                  >
                    {(((hoverCoord.x - (boxX + boxW / 2)) / boxW) * W).toFixed(2)}m,{' '}
                    {(((boxY + boxH - hoverCoord.y) / boxH) * H).toFixed(2)}m
                  </text>
                </g>
              )}

              {/* Plotted Survey Points with Touch Targets, Selection & Small Deviation Badge */}
              {(survey.surveyPoints || []).map((pt, idx) => {
                const xM = (((pt.x - (boxX + boxW / 2)) / boxW) * W).toFixed(2);
                const yM = (((boxY + boxH - pt.y) / boxH) * H).toFixed(2);
                const isDraggingThis = draggingPointIdx === idx;
                const isSelectedThis = selectedPointIdx === idx;
                const devMm =
                  pt.deviationMm !== undefined
                    ? pt.deviationMm
                    : computePointDeviationMm(pt);
                const isOverbreak = devMm > 0;
                const isUndercut = devMm < 0;
                const devSign = isOverbreak ? '+' : '';
                const devBadgeText = `${devSign}${devMm}mm`;
                const devBadgeColor = isOverbreak
                  ? '#f59e0b'
                  : isUndercut
                  ? '#38bdf8'
                  : '#94a3b8';

                return (
                  <g key={`sv-pt-${idx}`} data-survey-point="true">
                    {/* Generous touch target circle (18px radius) for fingers on mobile & selection */}
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r="18"
                      fill="transparent"
                      className="cursor-move touch-none"
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        setDraggingPointIdx(idx);
                        setSelectedPointIdx(idx);
                        try {
                          (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
                        } catch {
                          // Ignore
                        }
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedPointIdx(idx);
                      }}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        const nextPts = (survey.surveyPoints || []).filter((_, i) => i !== idx);
                        if (selectedPointIdx === idx) setSelectedPointIdx(null);
                        recomputeOverbreakMetrics(nextPts, survey.status);
                      }}
                    />
                    {/* Subtle selection ring if point is selected */}
                    {isSelectedThis && (
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r="10"
                        fill="none"
                        stroke="#f59e0b"
                        strokeWidth="2"
                        strokeDasharray="3 2"
                        className="pointer-events-none animate-pulse"
                      />
                    )}
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={isDraggingThis ? '7' : '5'}
                      fill={isDraggingThis ? '#0284c7' : isSelectedThis ? '#f59e0b' : '#dc2626'}
                      stroke="#ffffff"
                      strokeWidth={isDraggingThis ? '2.4' : '1.6'}
                      className="pointer-events-none"
                    />
                    {/* Primary Point Identifier */}
                    <text
                      x={pt.x + 7}
                      y={pt.y - 6}
                      fontSize="9"
                      fontWeight="900"
                      fontFamily="IBM Plex Mono, monospace"
                      fill={isDraggingThis ? '#0369a1' : '#b91c1c'}
                      stroke="#ffffff"
                      strokeWidth="2"
                      paintOrder="stroke"
                      className="pointer-events-none"
                    >
                      P{idx + 1}
                    </text>
                    {/* Small subtle mm Overbreak / Undercut badge near the point without disturbing anything */}
                    <g className="pointer-events-none select-none">
                      <rect
                        x={pt.x + 7}
                        y={pt.y + 1}
                        width={devBadgeText.length * 5.8 + 6}
                        height="12"
                        rx="3"
                        fill="#020617"
                        stroke={devBadgeColor}
                        strokeWidth="0.9"
                      />
                      <text
                        x={pt.x + 10}
                        y={pt.y + 10}
                        fontSize="7.5"
                        fontWeight="900"
                        fontFamily="IBM Plex Mono, monospace"
                        fill={devBadgeColor}
                      >
                        {devBadgeText}
                      </text>
                    </g>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Compact Engineering Legend Strip for Canvas */}
          <div className="shrink-0 flex flex-wrap items-center justify-between gap-2 px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-[10.5px]">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="inline-block w-4 h-0.5 bg-slate-300"></span>
                <span className="font-bold text-slate-300">Design Profile</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="inline-block w-4 h-0.5 border-t-2 border-dashed border-emerald-500"></span>
                <span className="font-bold text-emerald-400">
                  Payline (+{survey.paylineOffsetMm ?? 150}mm)
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="inline-block w-4 h-0.5 bg-rose-500"></span>
                <span className="font-bold text-rose-400">Survey Profile</span>
              </div>
            </div>
            <div className="flex items-center gap-2 font-mono font-bold text-[10px]">
              <span className="px-1.5 py-0.5 rounded bg-emerald-950/70 border border-emerald-500/50 text-emerald-300">
                Permissible: {survey.permissibleOverbreakAreaM2 ?? 0} m²
              </span>
              <span
                className={`px-1.5 py-0.5 rounded border ${
                  survey.isRealOverbreak && (survey.realOverbreakAreaM2 || 0) > 0.01
                    ? 'bg-rose-950/80 border-rose-500 text-rose-300 font-black'
                    : 'bg-slate-900 border-slate-700 text-slate-400'
                }`}
              >
                Real OB: {survey.realOverbreakAreaM2 ?? 0} m² (
                {survey.realOverbreakPercent ?? 0}%)
              </span>
            </div>
          </div>
        </div>

        {/* Right Columns (4 of 12 in landscape/desktop): Calculated Overbreak Metrics + Mechanical / Geological Cause & Overall Geological Description */}
        <div className="landscape:col-span-4 lg:col-span-4 xl:col-span-4 min-h-0 h-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 flex flex-col gap-2.5 overflow-y-auto no-scrollbar mouse-scrollable">
          {survey.status !== 'completed' ? (
            <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-500/50 text-xs text-amber-200 space-y-1">
              <div className="font-black uppercase">
                Survey Status: {survey.status === 'skipped' ? 'SKIPPED' : 'FEED LATER (PENDING)'}
              </div>
              <p className="text-[11px] text-amber-300/90">
                Because survey data is marked as{' '}
                <strong>{survey.status === 'skipped' ? 'Skipped' : 'Feed Later'}</strong>, no survey overbreak outline or overbreak table will be shown on the Report face drawing. You can return anytime to feed the survey points.
              </p>
            </div>
          ) : null}

          {/* Point Overbreak / Undercut (mm) Quick-Selector & Fine Tuning Panel */}
          <div className="bg-slate-950 border border-amber-500/40 rounded-xl p-2.5 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Crosshair className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-black uppercase tracking-wider text-amber-400">
                  Point Overbreak / Undercut (mm)
                </span>
              </div>
              {selectedPointIdx !== null && (
                <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono text-[10.5px] font-bold">
                  P{selectedPointIdx + 1} Selected
                </span>
              )}
            </div>

            <p className="text-[11px] text-slate-400 leading-tight">
              Select any surveyed point to choose its exact offset in millimeters (Overbreak +mm / Undercut −mm). Shown as small, subtle badges near each point.
            </p>

            {/* Horizontal Point Selector Pills */}
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
              {(survey.surveyPoints || []).map((p, pIdx) => {
                const devMm =
                  p.deviationMm !== undefined
                    ? p.deviationMm
                    : computePointDeviationMm(p);
                const isSel = selectedPointIdx === pIdx;
                return (
                  <button
                    key={`pt-sel-btn-${pIdx}`}
                    type="button"
                    onClick={() => setSelectedPointIdx(pIdx)}
                    className={`px-2 py-1 rounded-lg text-[10.5px] font-mono font-bold whitespace-nowrap border transition-all cursor-pointer ${
                      isSel
                        ? 'bg-amber-500 text-slate-950 border-amber-300 font-black shadow'
                        : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-amber-400/60'
                    }`}
                  >
                    P{pIdx + 1} ({devMm > 0 ? '+' : ''}{devMm}mm)
                  </button>
                );
              })}
              {(survey.surveyPoints || []).length === 0 && (
                <div className="text-[11px] text-slate-500 italic py-1">
                  Click on face canvas to plot survey points
                </div>
              )}
            </div>

            {selectedPointIdx !== null &&
              survey.surveyPoints &&
              survey.surveyPoints[selectedPointIdx] && (
                <div className="space-y-1.5 pt-1 border-t border-slate-800">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">
                    Choose offset for P{selectedPointIdx + 1}:
                  </div>
                  {/* Undercut Buttons */}
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="text-[9.5px] font-bold text-cyan-400 mr-1">Undercut:</span>
                    {[-200, -150, -100, -50].map((mm) => (
                      <button
                        key={`dev-btn-${mm}`}
                        type="button"
                        onClick={() => handleSetPointDeviationMm(selectedPointIdx, mm)}
                        className="px-2 py-0.5 rounded text-[10.5px] font-mono font-bold bg-cyan-950/60 hover:bg-cyan-900 border border-cyan-500/50 text-cyan-300 cursor-pointer"
                      >
                        {mm}mm
                      </button>
                    ))}
                    {/* Exact Design Profile */}
                    <button
                      type="button"
                      onClick={() => handleSetPointDeviationMm(selectedPointIdx, 0)}
                      className="px-2 py-0.5 rounded text-[10.5px] font-mono font-black bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white cursor-pointer"
                    >
                      0mm (Design)
                    </button>
                  </div>

                  {/* Overbreak Buttons */}
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="text-[9.5px] font-bold text-amber-400 mr-1">Overbreak:</span>
                    {[50, 100, 150, 200, 300, 500].map((mm) => (
                      <button
                        key={`dev-btn-${mm}`}
                        type="button"
                        onClick={() => handleSetPointDeviationMm(selectedPointIdx, mm)}
                        className="px-2 py-0.5 rounded text-[10.5px] font-mono font-bold bg-amber-950/60 hover:bg-amber-900 border border-amber-500/50 text-amber-300 cursor-pointer"
                      >
                        +{mm}mm
                      </button>
                    ))}
                  </div>

                  {/* Custom Millimeter Input */}
                  <div className="flex items-center gap-1.5 pt-1">
                    <span className="text-[10px] text-slate-400">Custom mm:</span>
                    <input
                      type="number"
                      step={5}
                      value={customDevMmInput}
                      onChange={(e) => setCustomDevMmInput(e.target.value)}
                      placeholder="+120 or -40"
                      className="w-24 bg-slate-900 border border-slate-700 rounded px-2 py-0.5 font-mono text-xs text-amber-300"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const val = Number(customDevMmInput);
                        if (!isNaN(val)) {
                          handleSetPointDeviationMm(selectedPointIdx, val);
                          setCustomDevMmInput('');
                        }
                      }}
                      className="px-2.5 py-0.5 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs cursor-pointer"
                    >
                      Apply
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const nextPts = (survey.surveyPoints || []).filter(
                          (_, i) => i !== selectedPointIdx
                        );
                        setSelectedPointIdx(null);
                        recomputeOverbreakMetrics(nextPts, survey.status);
                      }}
                      className="ml-auto px-2 py-0.5 rounded bg-rose-950/70 hover:bg-rose-900 text-rose-300 border border-rose-800/60 text-[10px] font-bold cursor-pointer"
                    >
                      Delete P{selectedPointIdx + 1}
                    </button>
                  </div>
                </div>
              )}
          </div>

          {/* Payline Input & Real Overbreak Contract Calculator */}
          <div className="bg-slate-950 border border-emerald-500/40 rounded-xl p-2.5 space-y-2">
            <div className="flex items-center justify-between gap-1.5">
              <div className="flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-black uppercase tracking-wider text-emerald-400">
                  Site Payline &amp; Real Overbreak
                </span>
              </div>
              <label className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={survey.paylineEnabled !== false}
                  onChange={(e) =>
                    recomputeOverbreakMetrics(
                      survey.surveyPoints || [],
                      survey.status,
                      { paylineEnabled: e.target.checked }
                    )
                  }
                  className="rounded text-emerald-500 focus:ring-0 cursor-pointer"
                />
                <span>Active</span>
              </label>
            </div>

            <p className="text-[11px] text-slate-400 leading-tight">
              Feed site authorized excavation boundary (Payline). Over-excavation within Payline is contractually <strong>Permissible</strong>; any profile exceeding Payline is <strong>Real Overbreak</strong> (Contractor loss / non-payable).
            </p>

            {/* Quick Preset Buttons */}
            <div className="flex flex-wrap items-center gap-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase mr-0.5">Presets:</span>
              {[
                { label: '0mm (Design)', val: 0 },
                { label: '+50mm', val: 50 },
                { label: '+100mm', val: 100 },
                { label: '+150mm (Std)', val: 150 },
                { label: '+200mm', val: 200 },
                { label: '+250mm', val: 250 },
                { label: '+300mm', val: 300 },
              ].map((preset) => {
                const isCur = (survey.paylineOffsetMm ?? 150) === preset.val;
                return (
                  <button
                    key={preset.val}
                    type="button"
                    onClick={() =>
                      recomputeOverbreakMetrics(
                        survey.surveyPoints || [],
                        survey.status,
                        {
                          paylineOffsetMm: preset.val,
                          paylineEnabled: true,
                        }
                      )
                    }
                    className={`px-2 py-0.5 rounded text-[10.5px] font-bold border cursor-pointer transition-all ${
                      isCur
                        ? 'bg-emerald-500 text-slate-950 border-emerald-300 font-black shadow'
                        : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-emerald-500/50'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>

            {/* Custom Offset Entry */}
            <div className="grid grid-cols-2 gap-2 text-xs pt-1">
              <div>
                <label className="block text-[10px] font-bold text-slate-400">
                  Payline Offset (mm)
                </label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={0}
                    max={1000}
                    step={10}
                    value={survey.paylineOffsetMm ?? 150}
                    onChange={(e) => {
                      const off = Math.max(0, Number(e.target.value));
                      recomputeOverbreakMetrics(
                        survey.surveyPoints || [],
                        survey.status,
                        {
                          paylineOffsetMm: off,
                          paylineEnabled: true,
                        }
                      );
                    }}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 font-mono text-emerald-300 font-bold"
                  />
                  <span className="text-[11px] text-slate-400 font-mono">mm</span>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400">
                  Payline Area (m²)
                </label>
                <div className="bg-slate-900 border border-slate-800 rounded px-2 py-1 font-mono font-bold text-emerald-400">
                  {survey.paylineAreaM2 ?? paylineAreaM2} m²
                </div>
              </div>
            </div>

            {/* Real Overbreak Verdict Banner */}
            {survey.status === 'completed' && (
              <div
                className={`p-2 rounded-lg border text-xs space-y-0.5 ${
                  survey.isRealOverbreak && (survey.realOverbreakAreaM2 || 0) > 0.01
                    ? 'bg-rose-950/80 border-rose-500 text-rose-200 shadow-md'
                    : (survey.overbreakAreaM2 || 0) > 0
                    ? 'bg-emerald-950/80 border-emerald-500 text-emerald-200 shadow-md'
                    : 'bg-slate-900 border-slate-700 text-slate-300'
                }`}
              >
                <div className="font-black uppercase flex items-center gap-1.5 text-[11px]">
                  {survey.isRealOverbreak && (survey.realOverbreakAreaM2 || 0) > 0.01 ? (
                    <>
                      <span className="text-sm">⚠</span>
                      <span>REAL OVERBREAK DETECTED (Exceeds Payline)</span>
                    </>
                  ) : (survey.overbreakAreaM2 || 0) > 0 ? (
                    <>
                      <span className="text-sm">✓</span>
                      <span>WITHIN PAYLINE (Permissible Overbreak)</span>
                    </>
                  ) : (
                    <span>✓ EXACT DESIGN PROFILE (No Overbreak)</span>
                  )}
                </div>
                <div className="text-[10.5px] leading-snug">
                  {survey.isRealOverbreak && (survey.realOverbreakAreaM2 || 0) > 0.01 ? (
                    <>
                      Excavation exceeds the <strong>+{survey.paylineOffsetMm ?? 150}mm Payline</strong> by{' '}
                      <strong className="text-rose-300">{survey.realOverbreakAreaM2} m²</strong> (
                      <strong>{survey.realOverbreakVolumeM3} m³</strong> Real Overbreak — Non-Payable). Permissible authorized overbreak is{' '}
                      <strong>{survey.permissibleOverbreakAreaM2} m²</strong>.
                    </>
                  ) : (survey.overbreakAreaM2 || 0) > 0 ? (
                    <>
                      Overbreak of <strong>{survey.overbreakAreaM2} m²</strong> ({survey.overbreakVolumeM3} m³) is{' '}
                      <strong>entirely within</strong> the authorized +{survey.paylineOffsetMm ?? 150}mm Payline limit ({survey.paylineAreaM2 ?? paylineAreaM2} m²). Real Overbreak ={' '}
                      <strong>0.00 m²</strong> (Permissible as per site contract).
                    </>
                  ) : (
                    <>Survey contour conforms to theoretical design profile.</>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Calculated 6-Metric Breakdown Cards */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-2">
              <div className="text-[9.5px] font-bold uppercase text-slate-400">
                Design Face Area
              </div>
              <div className="text-base font-black font-mono text-white">
                {survey.designAreaM2 || designAreaM2} m²
              </div>
            </div>
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-2">
              <div className="text-[9.5px] font-bold uppercase text-slate-400">
                Excavated Survey Area
              </div>
              <div className="text-base font-black font-mono text-cyan-300">
                {survey.excavatedAreaM2 || designAreaM2} m²
              </div>
            </div>

            <div className="bg-slate-950 border border-emerald-500/40 rounded-xl p-2">
              <div className="text-[9.5px] font-bold uppercase text-emerald-300">
                Permissible OB (Payable)
              </div>
              <div className="text-base font-black font-mono text-emerald-400">
                {survey.permissibleOverbreakAreaM2 ?? 0} m²
                <span className="text-[10px] text-emerald-300/80 font-normal ml-1">
                  ({survey.permissibleOverbreakVolumeM3 ?? 0} m³)
                </span>
              </div>
            </div>
            <div
              className={`rounded-xl p-2 border ${
                survey.isRealOverbreak && (survey.realOverbreakAreaM2 || 0) > 0.01
                  ? 'bg-rose-950/60 border-rose-500 text-rose-300'
                  : 'bg-slate-950 border-slate-800 text-slate-400'
              }`}
            >
              <div className="text-[9.5px] font-bold uppercase">
                Real Overbreak (Site Loss)
              </div>
              <div className="text-base font-black font-mono text-rose-400">
                {survey.realOverbreakAreaM2 ?? 0} m²
                <span className="text-[10px] text-rose-300/80 font-normal ml-1">
                  ({survey.realOverbreakPercent ?? 0}% | {survey.realOverbreakVolumeM3 ?? 0} m³)
                </span>
              </div>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-xl p-2">
              <div className="text-[9.5px] font-bold uppercase text-slate-400">
                Total Overbreak
              </div>
              <div className="text-sm font-black font-mono text-slate-200">
                {survey.overbreakAreaM2} m² ({survey.overbreakPercent}%)
              </div>
            </div>
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-2">
              <div className="text-[9.5px] font-bold uppercase text-slate-400">
                Max Overbreak Depth
              </div>
              <div className="text-sm font-black font-mono text-amber-300">
                {survey.maxOverbreakDepthM ?? 0} m
              </div>
            </div>
          </div>

          {/* Direct Numeric Override if Survey Team provides exact numbers */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 space-y-2">
            <div className="text-xs font-bold uppercase text-slate-300">
              Manual / Total Station Overbreak Entry (Optional)
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <label className="block text-[10px] text-slate-400">OB Area (m²)</label>
                <input
                  type="number"
                  step={0.1}
                  value={survey.overbreakAreaM2 ?? 0}
                  onChange={(e) => {
                    const obArea = Number(e.target.value);
                    onUpdateRound((r) => {
                      const currSurv =
                        r.surveyOverbreak || createDefaultSurveyOverbreak(activeLocation);
                      const nextCause =
                        obArea > 0 && currSurv.overbreakCause === 'no_overbreak'
                          ? 'geological'
                          : obArea <= 0
                          ? 'no_overbreak'
                          : currSurv.overbreakCause;

                      const allowArea = Math.max(
                        0,
                        (currSurv.paylineAreaM2 || paylineAreaM2) - designAreaM2
                      );
                      const isPayEnabled = currSurv.paylineEnabled !== false;
                      const permArea = isPayEnabled ? Number(Math.min(obArea, allowArea).toFixed(2)) : 0;
                      const realArea = isPayEnabled ? Number(Math.max(0, obArea - allowArea).toFixed(2)) : obArea;
                      const isReal = realArea > 0.01;

                      const nextSurv: FieldSurveyOverbreakData = {
                        ...currSurv,
                        status: 'completed',
                        overbreakCause: nextCause,
                        overbreakAreaM2: obArea,
                        overbreakPercent: Number(
                          ((obArea / Math.max(1, designAreaM2)) * 100).toFixed(1)
                        ),
                        overbreakVolumeM3: Number((obArea * pullM).toFixed(2)),
                        permissibleOverbreakAreaM2: permArea,
                        permissibleOverbreakVolumeM3: Number((permArea * pullM).toFixed(2)),
                        realOverbreakAreaM2: realArea,
                        realOverbreakPercent: Number(
                          ((realArea / Math.max(1, designAreaM2)) * 100).toFixed(1)
                        ),
                        realOverbreakVolumeM3: Number((realArea * pullM).toFixed(2)),
                        isRealOverbreak: isReal,
                        overbreakContractStatus: isReal
                          ? 'real_overbreak'
                          : obArea > 0
                          ? 'within_payline'
                          : 'exact_design',
                      };
                      const tempRound = { ...r, surveyOverbreak: nextSurv };
                      const autoReason = generateOverbreakSummarySentence(
                        tempRound,
                        activeLocation
                      );
                      nextSurv.overbreakReason = autoReason;
                      return {
                        ...r,
                        surveyOverbreak: nextSurv,
                        geologicalDescription: generateProfessionalGeologicalDescription(
                          { ...tempRound, surveyOverbreak: nextSurv },
                          activeLocation
                        ),
                        overbreakNotes: autoReason,
                      };
                    });
                  }}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 font-mono text-rose-300"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-400">OB Amount (m³)</label>
                <input
                  type="number"
                  step={0.1}
                  value={survey.overbreakVolumeM3 ?? 0}
                  onChange={(e) => {
                    const obVol = Number(e.target.value);
                    onUpdateRound((r) => {
                      const currSurv =
                        r.surveyOverbreak || createDefaultSurveyOverbreak(activeLocation);
                      const nextSurv: FieldSurveyOverbreakData = {
                        ...currSurv,
                        status: 'completed',
                        overbreakCause:
                          obVol > 0 && currSurv.overbreakCause === 'no_overbreak'
                            ? 'geological'
                            : currSurv.overbreakCause,
                        overbreakVolumeM3: obVol,
                      };
                      const tempRound = { ...r, surveyOverbreak: nextSurv };
                      const autoReason = generateOverbreakSummarySentence(
                        tempRound,
                        activeLocation
                      );
                      nextSurv.overbreakReason = autoReason;
                      return {
                        ...r,
                        surveyOverbreak: nextSurv,
                        geologicalDescription: generateProfessionalGeologicalDescription(
                          { ...tempRound, surveyOverbreak: nextSurv },
                          activeLocation
                        ),
                        overbreakNotes: autoReason,
                      };
                    });
                  }}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 font-mono text-amber-300"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-400">Max Depth (m)</label>
                <input
                  type="number"
                  step={0.05}
                  value={survey.maxOverbreakDepthM ?? 0}
                  onChange={(e) => {
                    const maxDepth = Number(e.target.value);
                    onUpdateRound((r) => {
                      const currSurv =
                        r.surveyOverbreak || createDefaultSurveyOverbreak(activeLocation);
                      const nextSurv: FieldSurveyOverbreakData = {
                        ...currSurv,
                        status: 'completed',
                        maxOverbreakDepthM: maxDepth,
                      };
                      const tempRound = { ...r, surveyOverbreak: nextSurv };
                      const autoReason = generateOverbreakSummarySentence(
                        tempRound,
                        activeLocation
                      );
                      nextSurv.overbreakReason = autoReason;
                      return {
                        ...r,
                        surveyOverbreak: nextSurv,
                        geologicalDescription: generateProfessionalGeologicalDescription(
                          { ...tempRound, surveyOverbreak: nextSurv },
                          activeLocation
                        ),
                        overbreakNotes: autoReason,
                      };
                    });
                  }}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 font-mono text-white"
                />
              </div>
            </div>
          </div>

          {/* Overbreak Classification (including No Overbreak) + Overall Geological & Overbreak Description */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2 flex-1 flex flex-col">
            <div className="flex flex-wrap items-center justify-between gap-1.5">
              <span className="text-xs font-black uppercase text-amber-400">
                Overbreak Classification &amp; Overall Geological Description
              </span>
              <button
                type="button"
                onClick={handleRegenerateProfessionalDescription}
                className="px-2 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/50 text-emerald-300 text-[10.5px] font-bold flex items-center gap-1 cursor-pointer"
                title="Automatically generate a professional engineering geological & overbreak description from your mapped lithology, joints, classifications, and overbreak data"
              >
                <Sparkles className="w-3 h-3" />
                <span>Auto-Generate from Data</span>
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {(
                [
                  { id: 'no_overbreak', label: 'No Overbreak' },
                  { id: 'geological', label: 'Geological Overbreak' },
                  { id: 'mechanical', label: 'Mechanical Overbreak' },
                  { id: 'both', label: 'Combined (Geo + Mech)' },
                ] as const
              ).map((item) => {
                const isSelected =
                  (survey.overbreakCause || 'no_overbreak').toLowerCase() === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() =>
                      onUpdateRound((r) => {
                        const currSurv =
                          r.surveyOverbreak || createDefaultSurveyOverbreak(activeLocation);
                        const isNoOb = item.id === 'no_overbreak';
                        const nextSurv: FieldSurveyOverbreakData = {
                          ...currSurv,
                          status: isNoOb ? 'completed' : currSurv.status,
                          overbreakCause: item.id,
                          ...(isNoOb
                            ? {
                                surveyPoints: [],
                                excavatedAreaM2: designAreaM2,
                                overbreakAreaM2: 0,
                                underbreakAreaM2: 0,
                                overbreakPercent: 0,
                                overbreakVolumeM3: 0,
                                maxOverbreakDepthM: 0,
                              }
                            : {}),
                        };
                        const tempRound: FieldExcavationRound = {
                          ...r,
                          surveyOverbreak: nextSurv,
                        };
                        const autoReason = generateOverbreakSummarySentence(
                          tempRound,
                          activeLocation
                        );
                        nextSurv.overbreakReason = autoReason;
                        const autoFullDesc = generateProfessionalGeologicalDescription(
                          { ...tempRound, surveyOverbreak: nextSurv },
                          activeLocation
                        );
                        return {
                          ...r,
                          surveyOverbreak: nextSurv,
                          geologicalDescription: autoFullDesc,
                          overbreakNotes: autoReason,
                        };
                      })
                    }
                    className={`py-1.5 px-2 rounded-lg border text-[11px] font-bold cursor-pointer transition-all ${
                      isSelected
                        ? item.id === 'no_overbreak'
                          ? 'bg-emerald-500 text-slate-950 border-emerald-300 font-black shadow'
                          : 'bg-amber-500 text-slate-950 border-amber-300 font-black shadow'
                        : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-slate-500'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>

            <div className="flex-1 flex flex-col gap-1">
              <label className="text-[10.5px] font-bold text-slate-300">
                Overall Geological Description (Lithology, Structure, Rock Mass &amp; Overbreak — Auto-Generated &amp; Editable):
              </label>
              <textarea
                rows={5}
                value={activeRound.geologicalDescription ?? survey.overbreakReason ?? ''}
                onChange={(e) => {
                  const val = e.target.value;
                  onUpdateRound((r) => ({
                    ...r,
                    geologicalDescription: val,
                    surveyOverbreak: {
                      ...(r.surveyOverbreak || createDefaultSurveyOverbreak(activeLocation)),
                      overbreakReason: val,
                    },
                  }));
                }}
                placeholder="Professional geological & overbreak description auto-generated from mapped lithology, discontinuity sets, Q/RMR/GSI ratings, and overbreak survey..."
                className="flex-1 w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-2 text-xs leading-relaxed text-white"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
