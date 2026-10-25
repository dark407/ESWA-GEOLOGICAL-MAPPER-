import React from 'react';
import {
  TrendingUp,
  ArrowLeft,
  DollarSign,
  Truck,
  Sparkles,
  Scale,
  Sliders,
  AlertTriangle,
  CheckCircle2,
  Layers,
  ArrowUpRight,
} from 'lucide-react';
import { MiningGeologicalFeature, MiningStopeShape } from '../../types/mining';
import { FaceChannelSampleRecord } from '../../types/tunnel';
import { calculateCompositeFaceAssays } from '../../engine/miningFaceEngine';

export interface MiningGradesWindowProps {
  driftId: string;
  chainage: string;
  mineLevel: string;
  oreBodyName: string;
  stopeWidth: number;
  stopeHeight: number;
  stopeShape: MiningStopeShape;
  blastPull: number;
  setBlastPull: (v: number) => void;
  cutoffGrade: number;
  setCutoffGrade: (v: number) => void;
  oreSg: number;
  setOreSg: (v: number) => void;
  wasteSg: number;
  setWasteSg: (v: number) => void;
  metalPriceAuOz: number;
  setMetalPriceAuOz: (v: number) => void;
  miningCostPerTonne: number;
  setMiningCostPerTonne: (v: number) => void;
  millingCostPerTonne: number;
  setMillingCostPerTonne: (v: number) => void;
  features: MiningGeologicalFeature[];
  channelSamples: FaceChannelSampleRecord[];
  composites: ReturnType<typeof calculateCompositeFaceAssays>;
  onReturnToCanvas: () => void;
  onOpenChannels: () => void;
}

export const MiningGradesWindow: React.FC<MiningGradesWindowProps> = ({
  driftId,
  chainage,
  mineLevel,
  oreBodyName,
  stopeWidth,
  stopeHeight,
  stopeShape,
  blastPull,
  setBlastPull,
  cutoffGrade,
  setCutoffGrade,
  oreSg,
  setOreSg,
  wasteSg,
  setWasteSg,
  metalPriceAuOz,
  setMetalPriceAuOz,
  miningCostPerTonne,
  setMiningCostPerTonne,
  millingCostPerTonne,
  setMillingCostPerTonne,
  features,
  channelSamples,
  composites,
  onReturnToCanvas,
  onOpenChannels,
}) => {
  // Financial metrics
  const totalCostPerTonne = miningCostPerTonne + millingCostPerTonne;
  const totalRoundCost = composites.estimatedTonnesPerRound * totalCostPerTonne;
  const grossRoundRevenue = (composites.containedMetalUnits / 31.1035) * metalPriceAuOz;
  const netRoundProfit = grossRoundRevenue - totalRoundCost;
  const isProfitable = netRoundProfit > 0;

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
              <span className="text-base font-black text-amber-400">
                Face Grade &amp; Dilution Reconciliation Window
              </span>
              <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                Working Window
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Heading: <strong className="text-slate-200">{driftId}</strong> · Chainage:{' '}
              <strong className="text-amber-400">{chainage}</strong> · Level: {mineLevel} · {oreBodyName}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenChannels}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-cyan-300 border border-slate-700 cursor-pointer"
          >
            <span>View Channel Assays</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* KPI METRIC CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Weighted Face Grade */}
        <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Weighted Grade</span>
            <Sparkles className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-amber-400">
            {composites.weightedGrade} <span className="text-xs font-normal text-slate-400">g/t</span>
          </div>
          <div className="text-[10px] text-slate-400">
            Cutoff: <strong className="text-emerald-400">{cutoffGrade.toFixed(2)} g/t</strong>
          </div>
        </div>

        {/* Dilution % */}
        <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Face Dilution</span>
            <Scale className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-black text-rose-400">
            {composites.dilutionPercentByMass}%
          </div>
          <div className="text-[10px] text-slate-400">Waste by mass across round</div>
        </div>

        {/* Round Tonnage */}
        <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Round Tonnage</span>
            <Truck className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-black text-cyan-300">
            {composites.estimatedTonnesPerRound} <span className="text-xs font-normal text-slate-400">t</span>
          </div>
          <div className="text-[10px] text-slate-400">Advance: {blastPull}m pull</div>
        </div>

        {/* Contained Metal */}
        <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Contained Gold</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-400">
            {(composites.containedMetalUnits / 31.1035).toFixed(1)}{' '}
            <span className="text-xs font-normal text-slate-400">oz</span>
          </div>
          <div className="text-[10px] text-slate-400">
            {composites.containedMetalUnits.toFixed(0)} grams metal
          </div>
        </div>

        {/* Gross Round Revenue */}
        <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Gross Revenue</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-slate-100">
            ${Math.round(grossRoundRevenue).toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-400">@ ${metalPriceAuOz}/oz Au</div>
        </div>

        {/* Net Profit per Round */}
        <div
          className={`p-3.5 rounded-2xl border space-y-1 ${
            isProfitable
              ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-300'
              : 'bg-rose-950/20 border-rose-500/40 text-rose-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs">
            <span>Round Net Margin</span>
            {isProfitable ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 text-rose-400" />}
          </div>
          <div className="text-2xl font-black">
            ${Math.round(netRoundProfit).toLocaleString()}
          </div>
          <div className="text-[10px] opacity-80">
            Cost: ${Math.round(totalRoundCost).toLocaleString()}
          </div>
        </div>
      </div>

      {/* TWO COLUMN WORKBENCH */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Muck Destination Verdict & Parameters (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Muck Destination Verdict Card */}
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Muck Haulage Verdict
              </span>
              <span
                className={`px-2.5 py-1 rounded-lg text-xs font-black ${
                  composites.verdict === 'MILL'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : composites.verdict === 'LOW_GRADE_STOCKPILE'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                }`}
              >
                {composites.verdict === 'MILL'
                  ? 'ROUTE TO PROCESSING MILL'
                  : composites.verdict === 'LOW_GRADE_STOCKPILE'
                  ? 'ROUTE TO LOW-GRADE STOCKPILE'
                  : 'DISPATCH TO WASTE ROCK DUMP'}
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              {composites.verdictDescription}
            </p>
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1.5">
              <div className="flex justify-between text-slate-400">
                <span>Weighted Face Grade:</span>
                <strong className="text-amber-400 font-bold">{composites.weightedGrade} g/t</strong>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Plant Cutoff Grade:</span>
                <strong className="text-emerald-400 font-bold">{cutoffGrade.toFixed(2)} g/t</strong>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Stockpile Cutoff (0.6x Cutoff):</span>
                <strong className="text-amber-300 font-bold">{(cutoffGrade * 0.6).toFixed(2)} g/t</strong>
              </div>
            </div>
          </div>

          {/* Interactive Economics & Calibration Controls */}
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3.5">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-800 text-xs font-bold text-amber-400 uppercase tracking-wider">
              <Sliders className="w-4 h-4" />
              <span>Sensitivity &amp; Cutoff Controls</span>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-slate-300 font-bold">Mill Cutoff Grade:</span>
                  <span className="text-emerald-400 font-black">{cutoffGrade.toFixed(2)} g/t</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="10.0"
                  step="0.1"
                  value={cutoffGrade}
                  onChange={(e) => setCutoffGrade(parseFloat(e.target.value) || 2.5)}
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-slate-300 font-bold">Blast Advance Pull:</span>
                  <span className="text-cyan-300 font-black">{blastPull.toFixed(1)} m</span>
                </div>
                <input
                  type="range"
                  min="1.0"
                  max="5.0"
                  step="0.1"
                  value={blastPull}
                  onChange={(e) => setBlastPull(parseFloat(e.target.value) || 3.2)}
                  className="w-full accent-cyan-500 cursor-pointer"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <label className="space-y-1">
                  <span className="text-slate-400 text-[11px]">Ore SG (t/m³):</span>
                  <input
                    type="number"
                    step="0.05"
                    value={oreSg}
                    onChange={(e) => setOreSg(parseFloat(e.target.value) || 3.35)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 font-bold"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-slate-400 text-[11px]">Waste SG (t/m³):</span>
                  <input
                    type="number"
                    step="0.05"
                    value={wasteSg}
                    onChange={(e) => setWasteSg(parseFloat(e.target.value) || 2.72)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 font-bold"
                  />
                </label>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-1">
                <label className="space-y-1">
                  <span className="text-slate-400 text-[10px]">Au ($/oz):</span>
                  <input
                    type="number"
                    step="10"
                    value={metalPriceAuOz}
                    onChange={(e) => setMetalPriceAuOz(parseFloat(e.target.value) || 2650)}
                    className="w-full px-2 py-1 rounded-lg bg-slate-950 border border-slate-700 text-emerald-400 font-bold text-xs"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-slate-400 text-[10px]">Mine ($/t):</span>
                  <input
                    type="number"
                    step="1"
                    value={miningCostPerTonne}
                    onChange={(e) => setMiningCostPerTonne(parseFloat(e.target.value) || 68)}
                    className="w-full px-2 py-1 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 font-bold text-xs"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-slate-400 text-[10px]">Mill ($/t):</span>
                  <input
                    type="number"
                    step="1"
                    value={millingCostPerTonne}
                    onChange={(e) => setMillingCostPerTonne(parseFloat(e.target.value) || 34)}
                    className="w-full px-2 py-1 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 font-bold text-xs"
                  />
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Zone Breakdown Table & True Thickness Analysis (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Vein & Face Zone Breakdown */}
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-4 h-4 text-amber-400" />
                <span>Face Zone Mass &amp; Dilution Breakdown</span>
              </span>
              <span className="text-[11px] text-slate-400">
                Face Span: {stopeWidth}m × {stopeHeight}m
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="p-2.5">Zone Classification</th>
                    <th className="p-2.5">SG (t/m³)</th>
                    <th className="p-2.5">Grade (g/t)</th>
                    <th className="p-2.5">Mass Fraction</th>
                    <th className="p-2.5">Routing</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  <tr className="hover:bg-slate-850/50">
                    <td className="p-2.5 flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                      <strong className="text-slate-100">High Grade Lode</strong>
                    </td>
                    <td className="p-2.5 text-slate-300">{oreSg.toFixed(2)}</td>
                    <td className="p-2.5 font-bold text-rose-400">12.50 g/t</td>
                    <td className="p-2.5 text-slate-300">32.4%</td>
                    <td className="p-2.5">
                      <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                        Direct to Mill
                      </span>
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-850/50">
                    <td className="p-2.5 flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                      <strong className="text-slate-100">Medium Grade Margins</strong>
                    </td>
                    <td className="p-2.5 text-slate-300">{oreSg.toFixed(2)}</td>
                    <td className="p-2.5 font-bold text-amber-400">4.20 g/t</td>
                    <td className="p-2.5 text-slate-300">28.1%</td>
                    <td className="p-2.5">
                      <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                        Direct to Mill
                      </span>
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-850/50">
                    <td className="p-2.5 flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
                      <strong className="text-slate-100">Low Grade Halo</strong>
                    </td>
                    <td className="p-2.5 text-slate-300">{((oreSg + wasteSg) / 2).toFixed(2)}</td>
                    <td className="p-2.5 font-bold text-yellow-300">1.80 g/t</td>
                    <td className="p-2.5 text-slate-300">14.5%</td>
                    <td className="p-2.5">
                      <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold">
                        Stockpile
                      </span>
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-850/50">
                    <td className="p-2.5 flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-slate-500" />
                      <strong className="text-slate-400">Overbreak Waste (Dilution)</strong>
                    </td>
                    <td className="p-2.5 text-slate-300">{wasteSg.toFixed(2)}</td>
                    <td className="p-2.5 font-bold text-slate-400">0.25 g/t</td>
                    <td className="p-2.5 text-rose-400 font-bold">
                      {composites.dilutionPercentByMass}%
                    </td>
                    <td className="p-2.5">
                      <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 text-[10px] font-bold">
                        Waste Dilution
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Mass-Weighted Composite Calculation Transparency Card */}
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2.5">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
              Mass-Weighted Reconciliation Formula
            </span>
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 font-mono">
              <div className="text-amber-400 font-bold mb-1">
                Weighted Grade = Σ (Length × SG × Grade) / Σ (Length × SG)
              </div>
              <div className="text-slate-400 text-[11px] leading-relaxed">
                Reconciliation takes into account variable specific gravities between high-density
                massive sulfides/quartz veins ({oreSg} t/m³) versus host basalt/andesite wallrock
                ({wasteSg} t/m³).
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
