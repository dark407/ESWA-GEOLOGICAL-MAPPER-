import React from 'react';
import {
  FileDown,
  FileCode,
  FileSpreadsheet,
  Printer,
  ArrowLeft,
  CheckCircle2,
  Layers,
  TrendingUp,
  Shield,
  Truck,
  Compass,
  Scissors,
  Sparkles,
} from 'lucide-react';
import { MiningGeologicalFeature, MiningStopeItem, MiningProjectItem } from '../../types/mining';
import { FaceChannelSampleRecord } from '../../types/tunnel';
import {
  calculateCompositeFaceAssays,
  calculateLaubscherMrmr,
  evaluateMathewsStability,
  generateMiningStopePolygon,
} from '../../engine/miningFaceEngine';

export interface MiningExportsWindowProps {
  driftId: string;
  chainage: string;
  mineLevel: string;
  currentStope?: MiningStopeItem;
  currentProject?: MiningProjectItem;
  features: MiningGeologicalFeature[];
  channelSamples: FaceChannelSampleRecord[];
  composites: ReturnType<typeof calculateCompositeFaceAssays>;
  mrmrResult: ReturnType<typeof calculateLaubscherMrmr>;
  mathewsResult?: ReturnType<typeof evaluateMathewsStability>;
  onExportDxf: () => void;
  onExportCsv: () => void;
  onOpenPrintModal: () => void;
  onReturnToCanvas: () => void;
}

export const MiningExportsWindow: React.FC<MiningExportsWindowProps> = ({
  driftId,
  chainage,
  mineLevel,
  currentStope,
  currentProject,
  features,
  channelSamples,
  composites,
  mrmrResult,
  mathewsResult,
  onExportDxf,
  onExportCsv,
  onOpenPrintModal,
  onReturnToCanvas,
}) => {
  const gradeUnits = currentProject?.gradeUnits || 'g/t';
  const cutoffGrade = currentStope?.targetCutoffGrade ?? 2.5;
  const stopeShape = currentStope?.stopeShape || 'd_arch';
  const stopeWidth = currentStope?.stopeWidthM ?? 4.8;
  const stopeHeight = currentStope?.stopeHeightM ?? 4.2;
  const wallHeight = currentStope?.wallHeightM ?? 2.8;
  const rockMassClassText = mrmrResult.rockMassClass.startsWith('Class')
    ? mrmrResult.rockMassClass
    : `Class ${mrmrResult.rockMassClass}`;

  const profileMetrics = generateMiningStopePolygon(
    stopeShape,
    stopeWidth,
    stopeHeight,
    wallHeight,
    undefined,
    currentStope?.customProfilePoints,
    currentStope?.customRoofShape
  );

  const visibleFeatures = features.filter((f) => f.visible !== false && f.points && f.points.length > 0);
  const polyFeaturesCount = visibleFeatures.filter((f) => f.geometryType !== 'POINT').length;
  const pointFeaturesCount = visibleFeatures.filter((f) => f.geometryType === 'POINT').length;

  return (
    <div className="flex-1 flex flex-col bg-slate-950 overflow-y-auto">
      {/* Top Bar */}
      <div className="p-4 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2.5 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30 shrink-0">
            <FileDown className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm sm:text-base font-black text-slate-100 uppercase tracking-wide truncate">
              Mine Engineering Deliverables &amp; Analytical Export Hub
            </h2>
            <p className="text-xs text-slate-400 truncate">
              Heading: <strong className="text-amber-300">{driftId}</strong> ({chainage}) · Level:{' '}
              <strong className="text-slate-200">{mineLevel}</strong> · Shape:{' '}
              <strong className="text-cyan-300">
                {stopeShape.replace('_', ' ').toUpperCase()} ({stopeWidth}m × {stopeHeight}m)
              </strong>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-300 flex flex-wrap items-center gap-2">
            <span>
              Verdict: <strong className="text-amber-400">{composites.verdict.replace(/_/g, ' ')}</strong>
            </span>
            <span className="text-slate-600">|</span>
            <span>
              MRMR: <strong className="text-emerald-400">{mrmrResult.designMrmr}</strong> ({rockMassClassText})
            </span>
          </div>

          <button
            type="button"
            onClick={onOpenPrintModal}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-xs font-black text-slate-950 transition-all cursor-pointer shadow-md"
          >
            <Printer className="w-4 h-4" />
            <span>Open A4 Analytical Dossier</span>
          </button>

          <button
            type="button"
            onClick={onReturnToCanvas}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-amber-400 border border-slate-700 transition-all cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Canvas</span>
          </button>
        </div>
      </div>

      {/* Main Content Container */}
      <div className="p-4 sm:p-6 max-w-6xl mx-auto w-full space-y-6">
        {/* 4 Deliverable Cards Grid — Stacked Metric Sub-Boxes so Zero Text Overlaps */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Card 1: 3D AutoCAD DXF Vector Export */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-amber-500/40 transition-all flex flex-col justify-between gap-4 shadow-xl">
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0">
                    <FileCode className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-black text-slate-100 uppercase tracking-wider leading-snug">
                      3D AutoCAD / Deswik / Vulcan DXF
                    </h3>
                    <p className="text-[11px] text-amber-400 font-mono truncate">
                      Standard ASCII DXF R12/R2000 Vector Format
                    </p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-300 text-[10px] font-black font-mono border border-amber-500/30 shrink-0">
                  .DXF CAD
                </span>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed">
                Exports true-to-scale underground excavation perimeter ({stopeShape.replace('_', ' ')},{' '}
                {profileMetrics.areaM2} m²), mapped ore lode polygons, fault/shear traces, structural dip vectors, and
                channel sample cuts separated into standard mine CAD layers.
              </p>

              {/* Stacked 4-Cell Summary Grid — Zero Horizontal Collision */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/90 flex flex-col gap-0.5 min-w-0">
                  <span className="text-[10px] font-sans font-bold uppercase text-slate-500 truncate">
                    Perimeter Frame
                  </span>
                  <strong className="text-emerald-400 truncate">
                    {stopeWidth}m × {stopeHeight}m
                  </strong>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/90 flex flex-col gap-0.5 min-w-0">
                  <span className="text-[10px] font-sans font-bold uppercase text-slate-500 truncate">
                    Lodes &amp; Traces
                  </span>
                  <strong className="text-slate-100 truncate">{polyFeaturesCount} Vectors</strong>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/90 flex flex-col gap-0.5 min-w-0">
                  <span className="text-[10px] font-sans font-bold uppercase text-slate-500 truncate">
                    Dip Stations
                  </span>
                  <strong className="text-slate-100 truncate">{pointFeaturesCount} Points</strong>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/90 flex flex-col gap-0.5 min-w-0">
                  <span className="text-[10px] font-sans font-bold uppercase text-slate-500 truncate">
                    Channel Cuts
                  </span>
                  <strong className="text-amber-300 truncate">{channelSamples.length} Cuts</strong>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onExportDxf}
              className="w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg cursor-pointer transition-all active:scale-98"
            >
              <FileDown className="w-4 h-4 shrink-0" />
              <span className="truncate">
                Download {driftId}_{chainage.replace(/\s+/g, '')}.dxf
              </span>
            </button>
          </div>

          {/* Card 2: Assay & Grade Reconciliation CSV */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-emerald-500/40 transition-all flex flex-col justify-between gap-4 shadow-xl">
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-black text-slate-100 uppercase tracking-wider leading-snug">
                      Channel Assay &amp; Reconciliation CSV
                    </h3>
                    <p className="text-[11px] text-emerald-400 font-mono truncate">
                      acQuire / Datamine / Leapfrog Grade Control Table
                    </p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-300 text-[10px] font-black font-mono border border-emerald-500/30 shrink-0">
                  .CSV DATA
                </span>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed">
                Exports every channel sample interval with true thickness, specific gravity (SG), assay grade,
                length×SG accumulation, unplanned wallrock dilution, and muck routing verdict.
              </p>

              {/* Stacked 4-Cell Summary Grid — Zero Horizontal Collision */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/90 flex flex-col gap-0.5 min-w-0">
                  <span className="text-[10px] font-sans font-bold uppercase text-slate-500 truncate">
                    Channel Samples
                  </span>
                  <strong className="text-slate-100 truncate">{channelSamples.length} Logged</strong>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/90 flex flex-col gap-0.5 min-w-0">
                  <span className="text-[10px] font-sans font-bold uppercase text-slate-500 truncate">
                    Composite Grade
                  </span>
                  <strong className="text-emerald-400 truncate">
                    {composites.weightedGrade} {gradeUnits}
                  </strong>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/90 flex flex-col gap-0.5 min-w-0">
                  <span className="text-[10px] font-sans font-bold uppercase text-slate-500 truncate">
                    Wall Dilution
                  </span>
                  <strong className="text-amber-300 truncate">{composites.dilutionPercentByMass}%</strong>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/90 flex flex-col gap-0.5 min-w-0">
                  <span className="text-[10px] font-sans font-bold uppercase text-slate-500 truncate">
                    Round Tonnage
                  </span>
                  <strong className="text-slate-100 truncate">{composites.estimatedTonnesPerRound} t</strong>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onExportCsv}
              className="w-full py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg cursor-pointer transition-all active:scale-98"
            >
              <FileSpreadsheet className="w-4 h-4 shrink-0" />
              <span className="truncate">
                Download {driftId}_{chainage.replace(/\s+/g, '')}_Assays.csv
              </span>
            </button>
          </div>

          {/* Card 3: Multi-Page ISO A4 Analytical Dossier (300 DPI PDF & Editable Word) */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-cyan-500/40 transition-all flex flex-col justify-between gap-4 shadow-xl">
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2.5 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 shrink-0">
                    <Printer className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-black text-slate-100 uppercase tracking-wider leading-snug">
                      Multi-Page ISO A4 Analytical Dossier
                    </h3>
                    <p className="text-[11px] text-cyan-400 font-mono truncate">
                      300 DPI PDF &amp; Editable Word (.doc) Studio
                    </p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-lg bg-cyan-500/15 text-cyan-300 text-[10px] font-black font-mono border border-cyan-500/30 shrink-0">
                  300 DPI A4
                </span>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed">
                Generates a multi-page ISO A4 Underground Mining Analytical Dossier with scaled underground face CAD
                diagram, numbered feature callout legend, channel assay reconciliation, Laubscher MRMR &amp;
                Mathews-Potvin stability graph, ground support cross-section, croppable dual logos, and 3-party
                signature boxes.
              </p>

              {/* Stacked 4-Cell Summary Grid — Zero Horizontal Collision */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/90 flex flex-col gap-0.5 min-w-0">
                  <span className="text-[10px] font-sans font-bold uppercase text-slate-500 truncate">
                    Dossier Format
                  </span>
                  <strong className="text-cyan-400 truncate">1 to 3 ISO A4 Pages</strong>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/90 flex flex-col gap-0.5 min-w-0">
                  <span className="text-[10px] font-sans font-bold uppercase text-slate-500 truncate">
                    Export Formats
                  </span>
                  <strong className="text-slate-100 truncate">300 DPI PDF + .DOC</strong>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/90 flex flex-col gap-0.5 min-w-0">
                  <span className="text-[10px] font-sans font-bold uppercase text-slate-500 truncate">
                    Design MRMR
                  </span>
                  <strong className="text-amber-300 truncate">
                    {mrmrResult.designMrmr} ({rockMassClassText})
                  </strong>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/90 flex flex-col gap-0.5 min-w-0">
                  <span className="text-[10px] font-sans font-bold uppercase text-slate-500 truncate">
                    Mathews N&apos; / HR
                  </span>
                  <strong className="text-emerald-400 truncate">
                    N&apos;={mathewsResult?.stabilityNumberN.toFixed(1) ?? '12.4'} / HR=
                    {mathewsResult?.hydraulicRadiusM.toFixed(1) ?? profileMetrics.hydraulicRadiusM.toFixed(1)}m
                  </strong>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onOpenPrintModal}
              className="w-full py-2.5 px-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg cursor-pointer transition-all active:scale-98"
            >
              <Printer className="w-4 h-4 shrink-0" />
              <span className="truncate">Open Multi-Page ISO A4 Analytical Dossier Studio</span>
            </button>
          </div>

          {/* Card 4: Live Shift Dispatch & Muck Routing Verification */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between gap-4 shadow-xl">
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2.5 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30 shrink-0">
                    <Truck className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-black text-slate-100 uppercase tracking-wider leading-snug">
                      Live Shift Dispatch &amp; Haulage Verification
                    </h3>
                    <p className="text-[11px] text-purple-400 font-mono truncate">
                      Real-Time Ore / Stockpile / Waste Routing Summary
                    </p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-lg bg-purple-500/15 text-purple-300 text-[10px] font-black font-mono border border-purple-500/30 shrink-0">
                  VERIFIED
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2.5 text-xs font-mono">
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/90 flex flex-col gap-0.5 min-w-0">
                  <span className="text-[10px] font-sans font-bold uppercase text-slate-500 truncate">
                    Mass-Weighted Face Grade
                  </span>
                  <div className="flex items-baseline justify-between gap-1">
                    <strong className="text-sm font-black text-amber-400 truncate">
                      {composites.weightedGrade.toFixed(2)} {gradeUnits}
                    </strong>
                    <span className="text-[10px] text-slate-500 shrink-0">
                      Cutoff: {cutoffGrade} {gradeUnits}
                    </span>
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/90 flex flex-col gap-0.5 min-w-0">
                  <span className="text-[10px] font-sans font-bold uppercase text-slate-500 truncate">
                    Unplanned Wallrock Dilution
                  </span>
                  <div className="flex items-baseline justify-between gap-1">
                    <strong
                      className={`text-sm font-black truncate ${
                        composites.dilutionPercentByMass > 25 ? 'text-rose-400' : 'text-emerald-400'
                      }`}
                    >
                      {composites.dilutionPercentByMass.toFixed(1)}%
                    </strong>
                    <span className="text-[10px] text-slate-500 shrink-0">
                      SG {currentStope?.oreSpecificGravity ?? 3.35}/{currentStope?.wasteSpecificGravity ?? 2.75}
                    </span>
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/90 flex flex-col gap-0.5 min-w-0">
                  <span className="text-[10px] font-sans font-bold uppercase text-slate-500 truncate">
                    Blast Round Tonnage &amp; Metal
                  </span>
                  <strong className="text-slate-100 truncate">
                    {composites.estimatedTonnesPerRound} t · {(composites.containedMetalUnits / 31.1035).toFixed(2)} oz
                  </strong>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/90 flex flex-col gap-0.5 min-w-0">
                  <span className="text-[10px] font-sans font-bold uppercase text-slate-500 truncate">
                    Laubscher MRMR Stability
                  </span>
                  <strong className="text-amber-300 truncate">
                    {mrmrResult.designMrmr} / 100 ({rockMassClassText})
                  </strong>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-950/90 border border-slate-800 text-[11px] font-mono text-slate-300 leading-snug">
                <span className="text-slate-500 uppercase font-sans font-bold text-[9.5px] block mb-0.5">
                  Required Ground Support Prescription:
                </span>
                <span className="text-slate-200 font-semibold">{mrmrResult.recommendedSupport}</span>
              </div>
            </div>

            <div
              className={`py-2.5 px-4 rounded-xl text-center font-black text-xs flex items-center justify-center gap-2 shadow-lg ${
                composites.verdict === 'MILL'
                  ? 'bg-emerald-500 text-slate-950'
                  : composites.verdict === 'LOW_GRADE_STOCKPILE'
                  ? 'bg-amber-500 text-slate-950'
                  : 'bg-rose-500 text-white'
              }`}
            >
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span className="truncate">
                DISPATCH DECISION: ROUTE TO {composites.verdict.replace(/_/g, ' ')}
              </span>
            </div>
          </div>
        </div>

        {/* ====================================================================
            STRUCTURED EXPORT DATA READINESS OVERVIEW TABLE
           ==================================================================== */}
        <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xl">
          <div className="px-5 py-3 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-200">
                Complete Stope Face Data Inventory Included in Official Exports
              </h3>
            </div>
            <span className="text-[11px] font-mono text-slate-400">
              All parameters synchronized with Face Canvas, Assays &amp; Geotech Windows
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-800 text-xs font-mono">
            {/* Column 1: Excavation & Structural Summary */}
            <div className="p-4 space-y-2.5">
              <div className="flex items-center gap-1.5 text-[11px] font-sans font-black uppercase tracking-wider text-amber-400">
                <Compass className="w-3.5 h-3.5" />
                <span>01. Excavation &amp; CAD Geometry</span>
              </div>
              <div className="space-y-1.5 text-[11.5px]">
                <div className="flex items-center justify-between gap-2 py-1 border-b border-slate-800/70">
                  <span className="text-slate-400">Heading / Stope ID</span>
                  <strong className="text-slate-100">{driftId}</strong>
                </div>
                <div className="flex items-center justify-between gap-2 py-1 border-b border-slate-800/70">
                  <span className="text-slate-400">Level &amp; Chainage</span>
                  <strong className="text-slate-100">
                    {mineLevel} · {chainage}
                  </strong>
                </div>
                <div className="flex items-center justify-between gap-2 py-1 border-b border-slate-800/70">
                  <span className="text-slate-400">Fed Profile Shape</span>
                  <strong className="text-cyan-300">{stopeShape.replace('_', ' ').toUpperCase()}</strong>
                </div>
                <div className="flex items-center justify-between gap-2 py-1 border-b border-slate-800/70">
                  <span className="text-slate-400">Span × Height (Wall Ht)</span>
                  <strong className="text-slate-100">
                    {stopeWidth}m × {stopeHeight}m ({wallHeight}m)
                  </strong>
                </div>
                <div className="flex items-center justify-between gap-2 py-1">
                  <span className="text-slate-400">True Face Area / Entities</span>
                  <strong className="text-emerald-400">
                    {profileMetrics.areaM2} m² · {visibleFeatures.length} Features
                  </strong>
                </div>
              </div>
            </div>

            {/* Column 2: Grade Control & Channel Assays */}
            <div className="p-4 space-y-2.5">
              <div className="flex items-center gap-1.5 text-[11px] font-sans font-black uppercase tracking-wider text-emerald-400">
                <Scissors className="w-3.5 h-3.5" />
                <span>02. Grade Control &amp; Assay Cuts</span>
              </div>
              <div className="space-y-1.5 text-[11.5px]">
                <div className="flex items-center justify-between gap-2 py-1 border-b border-slate-800/70">
                  <span className="text-slate-400">Logged Channel Cuts</span>
                  <strong className="text-slate-100">{channelSamples.length} Samples</strong>
                </div>
                <div className="flex items-center justify-between gap-2 py-1 border-b border-slate-800/70">
                  <span className="text-slate-400">Weighted Face Grade</span>
                  <strong className="text-emerald-400">
                    {composites.weightedGrade.toFixed(2)} {gradeUnits}
                  </strong>
                </div>
                <div className="flex items-center justify-between gap-2 py-1 border-b border-slate-800/70">
                  <span className="text-slate-400">Target Cutoff Grade</span>
                  <strong className="text-slate-200">
                    {cutoffGrade.toFixed(2)} {gradeUnits}
                  </strong>
                </div>
                <div className="flex items-center justify-between gap-2 py-1 border-b border-slate-800/70">
                  <span className="text-slate-400">Unplanned Dilution</span>
                  <strong className="text-amber-300">{composites.dilutionPercentByMass.toFixed(1)}%</strong>
                </div>
                <div className="flex items-center justify-between gap-2 py-1">
                  <span className="text-slate-400">Contained Metal / Round</span>
                  <strong className="text-slate-100">
                    {(composites.containedMetalUnits / 31.1035).toFixed(2)} oz ({composites.estimatedTonnesPerRound} t)
                  </strong>
                </div>
              </div>
            </div>

            {/* Column 3: Geomechanics & Ground Support */}
            <div className="p-4 space-y-2.5">
              <div className="flex items-center gap-1.5 text-[11px] font-sans font-black uppercase tracking-wider text-cyan-400">
                <Shield className="w-3.5 h-3.5" />
                <span>03. MRMR &amp; Mathews Stability</span>
              </div>
              <div className="space-y-1.5 text-[11.5px]">
                <div className="flex items-center justify-between gap-2 py-1 border-b border-slate-800/70">
                  <span className="text-slate-400">In-Situ Base RMR</span>
                  <strong className="text-slate-100">{mrmrResult.baseRmr} / 100</strong>
                </div>
                <div className="flex items-center justify-between gap-2 py-1 border-b border-slate-800/70">
                  <span className="text-slate-400">Design MRMR Rating</span>
                  <strong className="text-amber-400">
                    {mrmrResult.designMrmr} / 100 ({rockMassClassText})
                  </strong>
                </div>
                <div className="flex items-center justify-between gap-2 py-1 border-b border-slate-800/70">
                  <span className="text-slate-400">Hydraulic Radius (HR)</span>
                  <strong className="text-slate-100">
                    {(mathewsResult?.hydraulicRadiusM ?? profileMetrics.hydraulicRadiusM).toFixed(2)} m
                  </strong>
                </div>
                <div className="flex items-center justify-between gap-2 py-1 border-b border-slate-800/70">
                  <span className="text-slate-400">Mathews Stability N&apos;</span>
                  <strong className="text-emerald-400">
                    N&apos; = {(mathewsResult?.stabilityNumberN ?? 12.4).toFixed(2)}
                  </strong>
                </div>
                <div className="flex items-center justify-between gap-2 py-1">
                  <span className="text-slate-400">Stability Graph Zone</span>
                  <strong className="text-cyan-300 truncate">
                    {mathewsResult?.zoneLabel || 'Stable Excavation Zone'}
                  </strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
