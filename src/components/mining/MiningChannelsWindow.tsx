import React, { useState } from 'react';
import {
  Scissors,
  ArrowLeft,
  Plus,
  Trash2,
  Download,
  FileSpreadsheet,
  Layers,
  Sparkles,
  Calculator,
  Check,
  AlertCircle,
  Eye,
} from 'lucide-react';
import { FaceChannelSampleRecord } from '../../types/tunnel';
import { calculateCompositeFaceAssays } from '../../engine/miningFaceEngine';

export interface MiningChannelsWindowProps {
  driftId: string;
  chainage: string;
  mineLevel: string;
  stopeWidth: number;
  stopeHeight: number;
  oreSg: number;
  channelSamples: FaceChannelSampleRecord[];
  setChannelSamples: React.Dispatch<React.SetStateAction<FaceChannelSampleRecord[]>>;
  pushUndo: (features?: any, samples?: FaceChannelSampleRecord[]) => void;
  composites: ReturnType<typeof calculateCompositeFaceAssays>;
  onExportCsv: () => void;
  onReturnToCanvas: () => void;
}

export const MiningChannelsWindow: React.FC<MiningChannelsWindowProps> = ({
  driftId,
  chainage,
  mineLevel,
  stopeWidth,
  stopeHeight,
  oreSg,
  channelSamples,
  setChannelSamples,
  pushUndo,
  composites,
  onExportCsv,
  onReturnToCanvas,
}) => {
  const [selectedId, setSelectedId] = useState<string | null>(channelSamples[0]?.id || null);

  // Quick Add Cut State
  const [newFrom, setNewFrom] = useState<number>(
    channelSamples.length > 0 ? channelSamples[channelSamples.length - 1].toMeter : 0.5
  );
  const [newTo, setNewTo] = useState<number>(
    Math.min(stopeWidth, (channelSamples.length > 0 ? channelSamples[channelSamples.length - 1].toMeter : 0.5) + 0.8)
  );
  const [newGrade, setNewGrade] = useState<number>(5.5);
  const [newCategory, setNewCategory] = useState<'ORE' | 'LOW_GRADE' | 'WASTE'>('ORE');
  const [newLithology, setNewLithology] = useState<string>('Quartz-Sulfide Vein');

  const handleAddNewCut = () => {
    if (newTo <= newFrom) return;
    const sampleNum = `CS-${String(channelSamples.length + 1).padStart(2, '0')}`;
    const len = Number((newTo - newFrom).toFixed(2));
    const newCut: FaceChannelSampleRecord = {
      id: `CS-${Date.now().toString(36).toUpperCase()}`,
      sampleNumber: sampleNum,
      fromMeter: newFrom,
      toMeter: newTo,
      sampleLengthMeters: len,
      trueThicknessMeters: len,
      assayGrade: newGrade,
      gradeValue: newGrade.toFixed(2),
      sampledBy: 'Mine Geologist',
      date: new Date().toISOString().split('T')[0],
      specificGravity: oreSg,
      zoneCategory: newCategory,
      lithologyOrVein: newLithology,
      notes: 'Chip-channel continuous cut across face',
    };

    const next = [...channelSamples, newCut];
    pushUndo(undefined, next);
    setSelectedId(newCut.id);
    setNewFrom(newTo);
    setNewTo(Math.min(stopeWidth, Number((newTo + 0.8).toFixed(2))));
  };

  const handleDeleteCut = (id: string) => {
    const next = channelSamples.filter((s) => s.id !== id);
    pushUndo(undefined, next);
    if (selectedId === id) {
      setSelectedId(next[0]?.id || null);
    }
  };

  const handleUpdateCut = (id: string, updates: Partial<FaceChannelSampleRecord>) => {
    setChannelSamples((prev) =>
      prev.map((s) => {
        if (s.id === id) {
          const updated = { ...s, ...updates };
          if (updates.assayGrade !== undefined) {
            updated.gradeValue = String(updates.assayGrade);
          }
          if (updates.fromMeter !== undefined || updates.toMeter !== undefined) {
            const fm = updates.fromMeter ?? s.fromMeter;
            const tm = updates.toMeter ?? s.toMeter;
            updated.sampleLengthMeters = Number(Math.max(0, tm - fm).toFixed(2));
            updated.trueThicknessMeters = updated.sampleLengthMeters;
          }
          return updated;
        }
        return s;
      })
    );
  };

  // Sampled span
  const totalSampledMeters = channelSamples.reduce((sum, s) => sum + s.sampleLengthMeters, 0);
  const minGrade = channelSamples.length > 0 ? Math.min(...channelSamples.map((s) => (typeof s.assayGrade === 'number' ? s.assayGrade : 0))) : 0;
  const maxGrade = channelSamples.length > 0 ? Math.max(...channelSamples.map((s) => (typeof s.assayGrade === 'number' ? s.assayGrade : 0))) : 0;

  return (
    <div className="flex-1 flex flex-col bg-slate-950 text-slate-100 overflow-y-auto font-mono p-4 sm:p-6 space-y-6">
      {/* Subheader / Window Nav */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onReturnToCanvas}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition-all shadow cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Face Canvas</span>
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-black text-cyan-400">
                Channel Sampling &amp; Assay Registry Window
              </span>
              <span className="text-xs px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30">
                Working Window
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Heading: <strong className="text-slate-200">{driftId}</strong> · Chainage:{' '}
              <strong className="text-amber-400">{chainage}</strong> · Level: {mineLevel} · Sample Baseline: 1.5m Elevation
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onExportCsv}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-black text-xs transition-all shadow cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Channel Assays CSV</span>
          </button>
        </div>
      </div>

      {/* KPI METRIC CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
          <div className="text-xs text-slate-400 flex items-center justify-between">
            <span>Total Cuts</span>
            <Scissors className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-black text-cyan-300">{channelSamples.length}</div>
          <div className="text-[10px] text-slate-400">Intervals mapped</div>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
          <div className="text-xs text-slate-400 flex items-center justify-between">
            <span>Sampled Span</span>
            <Layers className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-400">
            {totalSampledMeters.toFixed(2)} <span className="text-xs font-normal text-slate-400">m</span>
          </div>
          <div className="text-[10px] text-slate-400">
            Span Coverage: {((totalSampledMeters / Math.max(1, stopeWidth)) * 100).toFixed(0)}%
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
          <div className="text-xs text-slate-400 flex items-center justify-between">
            <span>Composite Grade</span>
            <Sparkles className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-amber-400">
            {composites.weightedGrade} <span className="text-xs font-normal text-slate-400">g/t</span>
          </div>
          <div className="text-[10px] text-slate-400">Mass-weighted assay</div>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
          <div className="text-xs text-slate-400 flex items-center justify-between">
            <span>Min Assay</span>
            <AlertCircle className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-black text-slate-300">
            {minGrade.toFixed(2)} <span className="text-xs font-normal text-slate-400">g/t</span>
          </div>
          <div className="text-[10px] text-slate-400">Lowest cut</div>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
          <div className="text-xs text-slate-400 flex items-center justify-between">
            <span>Peak Assay</span>
            <Sparkles className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-black text-rose-400">
            {maxGrade.toFixed(2)} <span className="text-xs font-normal text-slate-400">g/t</span>
          </div>
          <div className="text-[10px] text-slate-400">Highest sample</div>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
          <div className="text-xs text-slate-400 flex items-center justify-between">
            <span>Contained Units</span>
            <Calculator className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-300">
            {composites.containedMetalUnits.toFixed(0)} <span className="text-xs font-normal text-slate-400">g</span>
          </div>
          <div className="text-[10px] text-slate-400">Across round</div>
        </div>
      </div>

      {/* VISUAL CHANNEL CUT ELEVATION PREVIEW */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
            Face Channel Elevation Visualizer (1.5m Reference Datum)
          </span>
          <span className="text-[11px] text-slate-400">Floor Span: 0.0m to {stopeWidth}m</span>
        </div>

        <div className="relative h-20 w-full bg-slate-950 rounded-xl border border-slate-800 overflow-hidden flex items-center px-4">
          {/* Floor Reference */}
          <div className="w-full relative h-10 flex items-center">
            {/* Guide line */}
            <div className="absolute inset-x-0 h-1 bg-slate-800" />

            {/* Mapped Samples */}
            {channelSamples.map((s) => {
              const leftPct = (s.fromMeter / stopeWidth) * 100;
              const widthPct = (s.sampleLengthMeters / stopeWidth) * 100;
              const isOre = s.zoneCategory === 'ORE';
              const isLow = s.zoneCategory === 'LOW_GRADE';
              const isSel = selectedId === s.id;

              return (
                <div
                  key={s.id}
                  onClick={() => setSelectedId(s.id)}
                  style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                  className={`absolute h-8 rounded-lg flex items-center justify-center text-[10px] font-bold cursor-pointer transition-all border ${
                    isSel
                      ? 'ring-2 ring-white z-10 scale-105'
                      : 'hover:brightness-125'
                  } ${
                    isOre
                      ? 'bg-emerald-500/30 text-emerald-300 border-emerald-400'
                      : isLow
                      ? 'bg-amber-500/30 text-amber-300 border-amber-400'
                      : 'bg-rose-500/30 text-rose-300 border-rose-400'
                  }`}
                >
                  <span className="truncate px-1">
                    {s.sampleNumber}: {typeof s.assayGrade === 'number' ? s.assayGrade.toFixed(1) : s.gradeValue}g/t
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* EDITABLE SAMPLES TABLE & ADD CUT FORM */}
      <div className="space-y-4">
        {/* Add Cut Quick Bar */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-wider">
            <Plus className="w-4 h-4" />
            <span>Add Face Channel Sample Cut</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
            <label className="space-y-1">
              <span className="text-slate-400 text-[11px]">From (m):</span>
              <input
                type="number"
                step="0.1"
                value={newFrom}
                onChange={(e) => setNewFrom(parseFloat(e.target.value) || 0)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 font-bold"
              />
            </label>
            <label className="space-y-1">
              <span className="text-slate-400 text-[11px]">To (m):</span>
              <input
                type="number"
                step="0.1"
                value={newTo}
                onChange={(e) => setNewTo(parseFloat(e.target.value) || 0)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 font-bold"
              />
            </label>
            <label className="space-y-1">
              <span className="text-slate-400 text-[11px]">Assay Grade (g/t):</span>
              <input
                type="number"
                step="0.1"
                value={newGrade}
                onChange={(e) => setNewGrade(parseFloat(e.target.value) || 0)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-amber-400 font-bold"
              />
            </label>
            <label className="space-y-1">
              <span className="text-slate-400 text-[11px]">Category:</span>
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value as any)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-200"
              >
                <option value="ORE">Ore</option>
                <option value="LOW_GRADE">Low Grade</option>
                <option value="WASTE">Waste</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-slate-400 text-[11px]">Lithology:</span>
              <input
                type="text"
                value={newLithology}
                onChange={(e) => setNewLithology(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-200"
              />
            </label>
            <div className="flex items-end">
              <button
                type="button"
                onClick={handleAddNewCut}
                className="w-full py-1.5 px-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black flex items-center justify-center gap-1.5 transition-all shadow cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add Sample</span>
              </button>
            </div>
          </div>
        </div>

        {/* Master Channel Assays Table */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-cyan-400" />
              <span>Face Channel Samples Register ({channelSamples.length})</span>
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="p-2.5">Sample ID</th>
                  <th className="p-2.5">From (m)</th>
                  <th className="p-2.5">To (m)</th>
                  <th className="p-2.5">Length (m)</th>
                  <th className="p-2.5">True Thickness</th>
                  <th className="p-2.5">Assay Grade (g/t)</th>
                  <th className="p-2.5">Zone Category</th>
                  <th className="p-2.5">Lithology / Vein</th>
                  <th className="p-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {channelSamples.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-6 text-center text-slate-500">
                      No channel samples mapped yet. Use "Add Sample" above or click "Channel" on the face canvas.
                    </td>
                  </tr>
                ) : (
                  channelSamples.map((s) => {
                    const isSel = selectedId === s.id;
                    return (
                      <tr
                        key={s.id}
                        onClick={() => setSelectedId(s.id)}
                        className={`cursor-pointer transition-colors ${
                          isSel ? 'bg-cyan-950/20' : 'hover:bg-slate-850/50'
                        }`}
                      >
                        <td className="p-2.5 font-bold text-slate-100 flex items-center gap-2">
                          <span
                            className={`w-2.5 h-2.5 rounded-full ${
                              s.zoneCategory === 'ORE'
                                ? 'bg-emerald-400'
                                : s.zoneCategory === 'LOW_GRADE'
                                ? 'bg-amber-400'
                                : 'bg-rose-400'
                            }`}
                          />
                          <span>{s.sampleNumber}</span>
                        </td>
                        <td className="p-2.5">
                          <input
                            type="number"
                            step="0.05"
                            value={s.fromMeter}
                            onChange={(e) =>
                              handleUpdateCut(s.id, { fromMeter: parseFloat(e.target.value) || 0 })
                            }
                            className="w-16 px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-200"
                          />
                        </td>
                        <td className="p-2.5">
                          <input
                            type="number"
                            step="0.05"
                            value={s.toMeter}
                            onChange={(e) =>
                              handleUpdateCut(s.id, { toMeter: parseFloat(e.target.value) || 0 })
                            }
                            className="w-16 px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-200"
                          />
                        </td>
                        <td className="p-2.5 text-slate-300 font-bold">
                          {s.sampleLengthMeters.toFixed(2)}m
                        </td>
                        <td className="p-2.5 text-cyan-300">
                          {s.trueThicknessMeters ? s.trueThicknessMeters.toFixed(2) : s.sampleLengthMeters.toFixed(2)}m
                        </td>
                        <td className="p-2.5">
                          <input
                            type="number"
                            step="0.05"
                            value={typeof s.assayGrade === 'number' ? s.assayGrade : parseFloat(s.gradeValue || '0')}
                            onChange={(e) =>
                              handleUpdateCut(s.id, { assayGrade: parseFloat(e.target.value) || 0 })
                            }
                            className="w-20 px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-amber-400 font-bold"
                          />
                        </td>
                        <td className="p-2.5">
                          <select
                            value={s.zoneCategory || 'ORE'}
                            onChange={(e) => handleUpdateCut(s.id, { zoneCategory: e.target.value as any })}
                            className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-[11px] text-slate-200"
                          >
                            <option value="ORE">Ore</option>
                            <option value="LOW_GRADE">Low Grade</option>
                            <option value="WASTE">Waste</option>
                          </select>
                        </td>
                        <td className="p-2.5">
                          <input
                            type="text"
                            value={s.lithologyOrVein || ''}
                            onChange={(e) => handleUpdateCut(s.id, { lithologyOrVein: e.target.value })}
                            className="w-40 px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-300 text-[11px]"
                          />
                        </td>
                        <td className="p-2.5 text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteCut(s.id);
                            }}
                            className="p-1.5 rounded hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 cursor-pointer"
                            title="Delete Channel Cut"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
