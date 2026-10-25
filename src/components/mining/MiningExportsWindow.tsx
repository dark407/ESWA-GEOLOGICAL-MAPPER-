import React, { useState } from 'react';
import {
  FileDown,
  ArrowLeft,
  FileCode,
  FileSpreadsheet,
  Printer,
  FileText,
  Download,
  Check,
  Layers,
  Sparkles,
  ShieldCheck,
  Copy,
} from 'lucide-react';
import { MiningStopeItem, MiningProjectItem, MiningGeologicalFeature } from '../../types/mining';
import { FaceChannelSampleRecord } from '../../types/tunnel';
import { calculateCompositeFaceAssays, calculateLaubscherMrmr, evaluateMathewsStability } from '../../engine/miningFaceEngine';

export interface MiningExportsWindowProps {
  driftId: string;
  chainage: string;
  mineLevel: string;
  currentStope: MiningStopeItem | undefined;
  currentProject: MiningProjectItem | undefined;
  features: MiningGeologicalFeature[];
  channelSamples: FaceChannelSampleRecord[];
  composites: ReturnType<typeof calculateCompositeFaceAssays>;
  mrmrResult: ReturnType<typeof calculateLaubscherMrmr>;
  mathewsResult: ReturnType<typeof evaluateMathewsStability>;
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
  const [copiedSummary, setCopiedSummary] = useState(false);

  const handoverSummaryText = `=== ESWA UNDERGROUND MINE GEOLOGY SHIFT HANDOVER ===
Project: ${currentProject?.projectName || 'Underground Gold Mine'}
Heading: ${driftId} | Level: ${mineLevel} | Chainage: ${chainage}
Geologist: ${currentStope?.responsibleGeologist || 'Duty Geologist'}
Date: ${new Date().toLocaleDateString()}

[FACE ASSAY RECONCILIATION]
- Weighted Face Grade: ${composites.weightedGrade} g/t
- Face Dilution: ${composites.dilutionPercentByMass}%
- Round Estimated Tonnage: ${composites.estimatedTonnesPerRound} t
- Contained Gold: ${(composites.containedMetalUnits / 31.1035).toFixed(1)} oz (${composites.containedMetalUnits.toFixed(0)} g)
- Muck Haulage Verdict: ${composites.verdict} (${composites.verdictDescription})

[GEOTECHNICAL STABILITY]
- Laubscher Design MRMR: ${mrmrResult.designMrmr} / 100 (Class ${mrmrResult.rockMassClass})
- Ground Support Requirement: ${mrmrResult.recommendedSupport}
- Mathews-Potvin Stope Stability: ${mathewsResult.zoneLabel} (N'=${mathewsResult.stabilityNumberN.toFixed(1)})

[MAPPED FEATURES]
- Geological Contacts/Veins: ${features.filter((f) => f.featureType === 'ORE_BOUNDARY').length}
- Faults & Structural Joints: ${features.filter((f) => f.featureType === 'FAULT' || f.featureType === 'JOINT').length}
- Channel Cuts: ${channelSamples.length}
===================================================`;

  const handleCopySummary = () => {
    navigator.clipboard.writeText(handoverSummaryText);
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2500);
  };

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
              <span className="text-base font-black text-rose-400">
                Mine CAD, Geological Delivery &amp; Compliance Hub
              </span>
              <span className="text-xs px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold border border-rose-500/30">
                Working Window
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Heading: <strong className="text-slate-200">{driftId}</strong> · Chainage:{' '}
              <strong className="text-amber-400">{chainage}</strong> · Level: {mineLevel} · Complete Surpac/Deswik &amp; QA/QC Pipelines
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopySummary}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 border border-slate-700 cursor-pointer"
          >
            {copiedSummary ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedSummary ? 'Copied Handover' : 'Copy Shift Handover'}</span>
          </button>
        </div>
      </div>

      {/* 4 PRIMARY DELIVERABLE CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: 3D Surpac / Deswik DXF */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400">
                <FileCode className="w-6 h-6" />
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 font-bold">
                CAD 3D Strings
              </span>
            </div>
            <div>
              <h3 className="font-bold text-slate-100 text-sm">Surpac / Deswik 3D DXF</h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Full 3D coordinate face strings including profile perimeter, high-grade ore wireframe boundaries, structural shear joints, and channel cut lines.
              </p>
            </div>
            <div className="text-[11px] text-slate-500 space-y-1 bg-slate-950 p-2.5 rounded-xl border border-slate-800">
              <div>Layers: FACE_PROFILE, GEOL_ORE, FAULTS, CHANNELS</div>
              <div>Entities: {features.length + channelSamples.length + 1} Strings</div>
            </div>
          </div>

          <button
            type="button"
            onClick={onExportDxf}
            className="w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center gap-2 transition-all shadow cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Download Surpac 3D DXF</span>
          </button>
        </div>

        {/* Card 2: QA/QC Channel Assays CSV */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="p-2.5 rounded-xl bg-cyan-500/20 text-cyan-400">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 font-bold">
                Assay DB
              </span>
            </div>
            <div>
              <h3 className="font-bold text-slate-100 text-sm">Channel Assays CSV</h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Database-ready CSV table compatible with Datashed, Fusion, and laboratory LIMS. Includes true thickness, mass-weighted composites, and SG.
              </p>
            </div>
            <div className="text-[11px] text-slate-500 space-y-1 bg-slate-950 p-2.5 rounded-xl border border-slate-800">
              <div>Samples: {channelSamples.length} Cuts</div>
              <div>Weighted Composite: {composites.weightedGrade} g/t</div>
            </div>
          </div>

          <button
            type="button"
            onClick={onExportCsv}
            className="w-full py-2.5 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-black text-xs flex items-center justify-center gap-2 transition-all shadow cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Download Assays CSV</span>
          </button>
        </div>

        {/* Card 3: Printable PDF Face Sheet */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400">
                <Printer className="w-6 h-6" />
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-bold">
                Official PDF
              </span>
            </div>
            <div>
              <h3 className="font-bold text-slate-100 text-sm">Printable Face Sheet PDF</h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Official mine geologist face mapping document featuring engineering title block, scaled face diagram, sample assay intervals, and sign-off stamps.
              </p>
            </div>
            <div className="text-[11px] text-slate-500 space-y-1 bg-slate-950 p-2.5 rounded-xl border border-slate-800">
              <div>Format: High-Res Scaled Vector</div>
              <div>Includes: Geotech &amp; Muck Haulage Sign-off</div>
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenPrintModal}
            className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black text-xs flex items-center justify-center gap-2 transition-all shadow cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>View &amp; Print PDF Sheet</span>
          </button>
        </div>

        {/* Card 4: Shift Handover Geological Summary */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="p-2.5 rounded-xl bg-purple-500/20 text-purple-400">
                <FileText className="w-6 h-6" />
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20 font-bold">
                Dispatch
              </span>
            </div>
            <div>
              <h3 className="font-bold text-slate-100 text-sm">Shift Handover Summary</h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Concise text dispatch for shift supervisors, blast crew, and mine planning engineers containing reconciliation metrics and ground support warnings.
              </p>
            </div>
            <div className="text-[11px] text-slate-500 space-y-1 bg-slate-950 p-2.5 rounded-xl border border-slate-800">
              <div>Verdict: {composites.verdict}</div>
              <div>Ground Support: Class {mrmrResult.rockMassClass}</div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCopySummary}
            className="w-full py-2.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-black text-xs flex items-center justify-center gap-2 transition-all shadow cursor-pointer"
          >
            {copiedSummary ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            <span>{copiedSummary ? 'Copied to Clipboard' : 'Copy Dispatch Text'}</span>
          </button>
        </div>
      </div>

      {/* LIVE DISPATCH PREVIEW BLOCK */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <FileText className="w-4 h-4 text-purple-400" />
            <span>Shift Handover Geological Dispatch Preview</span>
          </span>
          <button
            type="button"
            onClick={handleCopySummary}
            className="text-xs font-bold text-purple-400 hover:text-purple-300 flex items-center gap-1 cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>{copiedSummary ? 'Copied' : 'Copy Text'}</span>
          </button>
        </div>

        <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-emerald-400 overflow-x-auto leading-relaxed whitespace-pre-wrap">
          {handoverSummaryText}
        </pre>
      </div>
    </div>
  );
};
