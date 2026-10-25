import React, { useState } from 'react';
import {
  BookOpen,
  X,
  Layers,
  Shield,
  Sliders,
  CheckCircle2,
  HardHat,
  Compass,
  FileText,
  Building,
  MapPin,
  Flame,
  Search,
  ExternalLink,
  ChevronRight,
} from 'lucide-react';
import { IndustryMode, SavedProjectRecord } from '../types/tunnel';

interface SupportAndGeotechnicalReferenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  industryMode: IndustryMode;
  savedProjects?: SavedProjectRecord[];
}

export const SupportAndGeotechnicalReferenceModal: React.FC<SupportAndGeotechnicalReferenceModalProps> = ({
  isOpen,
  onClose,
  industryMode: defaultIndustryMode = 'NATM',
  savedProjects = [],
}) => {
  const [activeTab, setActiveTab] = useState<'support_guide' | 'grain_size' | 'rmr_chart' | 'q_system' | 'project_locations'>('support_guide');
  const [currentMode, setCurrentMode] = useState<IndustryMode>(defaultIndustryMode);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(savedProjects[0]?.id || '');
  const [searchFilter, setSearchFilter] = useState('');

  if (!isOpen) return null;

  const activeProject = savedProjects.find((p) => p.id === selectedProjectId) || savedProjects[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-4xl bg-slate-900 border-2 border-emerald-500/60 rounded-2xl shadow-2xl flex flex-col max-h-[94vh] overflow-hidden text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-b border-emerald-500/30 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center text-emerald-400">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-emerald-300 tracking-tight flex items-center gap-2">
                <span>Geotechnical Ground Support &amp; Reference Manual</span>
                <span className="text-[10.5px] font-mono font-bold bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded border border-emerald-500/30">
                  {currentMode} Edition
                </span>
              </h3>
              <p className="text-[10.5px] text-slate-400 font-mono">
                Project Support Schedules, Grain Size Spectrum, RMR &amp; Q-System Standards
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* 3-Mode Quick Switcher */}
            <div className="flex items-center p-0.5 rounded-lg bg-slate-950 border border-slate-800">
              {(['NATM', 'TBM', 'MINING'] as IndustryMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setCurrentMode(m)}
                  className={`px-2.5 py-1 rounded text-xs font-mono font-black cursor-pointer transition-all ${
                    currentMode === m
                      ? m === 'NATM'
                        ? 'bg-amber-500 text-slate-950 shadow'
                        : m === 'TBM'
                        ? 'bg-cyan-500 text-slate-950 shadow'
                        : 'bg-emerald-500 text-slate-950 shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-rose-950/80 hover:text-rose-200 transition-colors cursor-pointer"
              title="Close Reference Manual"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab Navigation Strip */}
        <div className="flex items-center gap-1 px-4 py-1.5 bg-slate-950 border-b border-slate-800 shrink-0 overflow-x-auto no-scrollbar">
          {[
            { id: 'support_guide', label: `${currentMode} Support Classes`, icon: Shield },
            { id: 'project_locations', label: 'Project & Location Support Match', icon: Building },
            { id: 'grain_size', label: 'Grain Size & Texture Chart', icon: Layers },
            { id: 'rmr_chart', label: 'RMR (Bieniawski 1989)', icon: FileText },
            { id: 'q_system', label: 'Q-System (Grimstad & Barton)', icon: HardHat },
          ].map((tab) => {
            const Icon = tab.icon;
            const isAct = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-all ${
                  isAct
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 shadow-xs'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isAct ? 'text-emerald-400' : 'text-slate-500'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-4 overflow-y-auto no-scrollbar space-y-4 flex-1">
          {/* TAB 1: MODE-SPECIFIC SUPPORT CLASSES */}
          {activeTab === 'support_guide' && (
            <div className="space-y-4">
              {currentMode === 'NATM' && (
                <div className="space-y-3">
                  <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                    <h4 className="font-extrabold text-sm text-amber-300 flex items-center gap-2">
                      <Shield className="w-4 h-4 text-amber-400" />
                      <span>NATM Ground Support Classes (Drill &amp; Blast Conventional Tunnelling)</span>
                    </h4>
                    <p className="text-xs text-slate-300 mt-1">
                      Designed to mobilize rock mass self-supporting arch. Standard categories A1 through C2 calibrated for span 8m–12m.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {[
                      {
                        cls: 'Class I (A1 / A2) — Stable Rock',
                        rmr: 'RMR 81–100 | Q > 10',
                        rock: 'Fresh, massive Quartzite, Granite, Gneiss. Very wide joint spacing (> 2m).',
                        support: 'Spot rockbolts (Swellex / SN Ø25mm, L=3.0m) where required. Unreinforced shotcrete 30–50mm if spalling occurs.',
                        invert: 'Flat open invert. No closure requirement.',
                        color: 'border-emerald-500/40 bg-emerald-950/20 text-emerald-300',
                      },
                      {
                        cls: 'Class II (B1) — Friable / Slightly Spalling',
                        rmr: 'RMR 61–80 | Q 4–10',
                        rock: 'Fresh to slightly weathered Sandstone, Schist. Spacing 0.6–2.0m.',
                        support: 'Systematic pattern bolts Ø25mm, L=3.5m @ 1.8m × 1.8m spacing. 50–75mm steel-fiber reinforced shotcrete (SFRC 30 kg/m³).',
                        invert: 'Open invert. Bench excavation up to 15–20m behind face.',
                        color: 'border-blue-500/40 bg-blue-950/20 text-blue-300',
                      },
                      {
                        cls: 'Class III (B2) — Blocky / Seamy Rock',
                        rmr: 'RMR 41–60 | Q 1–4',
                        rock: 'Moderately weathered Shale, Phyllite, jointed Limestone. Spacing 0.2–0.6m.',
                        support: 'Systematic SN/Swellex bolts @ 1.2–1.5m spacing, L=4.0m. 100–120mm fiber shotcrete + welded wire mesh (Ø6mm, 100×100mm). Light 3-bar lattice girders @ 1.5m spacing.',
                        invert: 'Bench length restricted to 6–10m. Temporary strut if side pressure rises.',
                        color: 'border-amber-500/40 bg-amber-950/20 text-amber-300',
                      },
                      {
                        cls: 'Class IV (C1) — Very Poor / Squeezing',
                        rmr: 'RMR 21–40 | Q 0.1–1.0',
                        rock: 'Heavily sheared Siltstone, Fault Gouge, highly weathered rock with water seepage.',
                        support: 'Systematic bolts @ 1.0m spacing, L=4.5–6.0m. 150–200mm shotcrete with double mesh layers. Heavy lattice girders or HEB 160 steel sets @ 0.8–1.0m. Forepoling spiles (Ø32mm × 4m @ 30cm spacing) ahead of face.',
                        invert: 'Invert ring closure within 1.0 to 1.5 tunnel diameters (D) from face.',
                        color: 'border-rose-500/40 bg-rose-950/20 text-rose-300',
                      },
                      {
                        cls: 'Class V (C2) — Severe Squeezing / Swelling',
                        rmr: 'RMR < 20 | Q < 0.1',
                        rock: 'Decomposed rock, clayey fault breccia, running ground under high overburden stress.',
                        support: 'Heavy pipe umbrella canopy (Ø114mm or Ø76mm steel tubes × 12m with cement grouting). Face fiberglass dowels (15–20 dowels × 12m). 250mm shotcrete with yielding elements. Heavy HEB 200 steel sets @ 0.6m.',
                        invert: 'Immediate invert ring closure within 0.5D–1.0D from face. Top heading & bench split.',
                        color: 'border-red-600/60 bg-red-950/30 text-red-300',
                      },
                    ].map((item) => (
                      <div key={item.cls} className={`p-3 rounded-xl border ${item.color} space-y-1.5`}>
                        <div className="flex items-start justify-between gap-1">
                          <h5 className="font-extrabold text-xs">{item.cls}</h5>
                          <span className="font-mono text-[10px] font-bold px-1.5 py-0.2 rounded bg-black/40">
                            {item.rmr}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-300">
                          <span className="font-bold text-slate-400">Ground: </span>
                          {item.rock}
                        </div>
                        <div className="text-[11px] text-slate-200">
                          <span className="font-bold text-amber-400">Support: </span>
                          {item.support}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          <span className="font-bold text-slate-400">Invert: </span>
                          {item.invert}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {currentMode === 'TBM' && (
                <div className="space-y-3">
                  <div className="p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-xl">
                    <h4 className="font-extrabold text-sm text-cyan-300 flex items-center gap-2">
                      <Shield className="w-4 h-4 text-cyan-400" />
                      <span>Mechanized TBM Ground Support &amp; Segmental Lining Reference</span>
                    </h4>
                    <p className="text-xs text-slate-300 mt-1">
                      Precast reinforced concrete segmental rings, backfill annulus grouting, and disc cutter wear criteria.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="p-3 bg-slate-950 border border-cyan-500/30 rounded-xl space-y-2">
                      <h5 className="font-extrabold text-xs text-cyan-300 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Precast Segmental Lining Ring Systems</span>
                      </h5>
                      <ul className="text-xs text-slate-300 space-y-1 list-disc list-inside">
                        <li><strong>Universal Ring Geometry:</strong> Tapered ring (typically 40–50mm taper) rotated in 16 to 24 bolt hole positions to negotiate horizontal and vertical curves.</li>
                        <li><strong>Ring Division:</strong> 5+1, 6+1, or 7+1 (Standard segments + 2 Counter-keys + 1 Keystone).</li>
                        <li><strong>Segment Concrete Grade:</strong> C50/60 or C60/75 high-performance fiber or rebar reinforced.</li>
                        <li><strong>Gaskets:</strong> EPDM elastomeric compression gasket + hydrophilic swelling strip on outer groove. Water tightness to 6–10 bar.</li>
                      </ul>
                    </div>

                    <div className="p-3 bg-slate-950 border border-cyan-500/30 rounded-xl space-y-2">
                      <h5 className="font-extrabold text-xs text-cyan-300 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Two-Component Annulus Grouting (A+B)</span>
                      </h5>
                      <ul className="text-xs text-slate-300 space-y-1 list-disc list-inside">
                        <li><strong>Component A:</strong> Cement + Water + Bentonite (30–40 kg/m³) + Retarder. Remains fluid for 24–48 hours.</li>
                        <li><strong>Component B:</strong> Sodium silicate (waterglass) accelerator (8–10% by volume).</li>
                        <li><strong>Gel Time:</strong> 10 to 18 seconds upon contact in mixing nozzle at tail skin.</li>
                        <li><strong>Grout Pressure:</strong> 1.5 to 3.0 bar (must exceed ground water hydrostatic pressure by 0.5–1.0 bar to prevent settlement).</li>
                        <li><strong>Injection Volume:</strong> 130% to 150% of theoretical annular tail gap volume.</li>
                      </ul>
                    </div>

                    <div className="p-3 bg-slate-950 border border-cyan-500/30 rounded-xl space-y-2">
                      <h5 className="font-extrabold text-xs text-cyan-300 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Disc Cutter Inspection &amp; Wear Limits</span>
                      </h5>
                      <ul className="text-xs text-slate-300 space-y-1 list-disc list-inside">
                        <li><strong>Disc Diameter:</strong> 17-inch (432mm) or 19-inch (483mm) heavy-duty rolling disc cutters.</li>
                        <li><strong>Maximum Radial Wear:</strong> 25mm on 17" cutter ring; 30mm on 19" cutter ring. Replace prior to housing contact.</li>
                        <li><strong>Hub &amp; Bearing Rotation:</strong> Free rotation without axial play (&lt; 0.5mm). Seized bearings cause flat spots.</li>
                        <li><strong>Torque Verification:</strong> Cutter mounting wedges torqued to 450–550 N·m with anti-seize compound.</li>
                      </ul>
                    </div>

                    <div className="p-3 bg-slate-950 border border-cyan-500/30 rounded-xl space-y-2">
                      <h5 className="font-extrabold text-xs text-cyan-300 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Tail Skin Grease &amp; Face Chamber Equilibrium</span>
                      </h5>
                      <ul className="text-xs text-slate-300 space-y-1 list-disc list-inside">
                        <li><strong>Tail Wire Brushes:</strong> 3 or 4 concentric brush rows with continuous pressurized grease barriers.</li>
                        <li><strong>Grease Consumption:</strong> 0.8 to 1.5 kg per meter of advance per brush chamber.</li>
                        <li><strong>EPB Chamber Pressure:</strong> Maintained at equilibrium: P_face = P_earth + P_water + 0.2 bar buffer.</li>
                        <li><strong>Foam Conditioning:</strong> FER (Foam Expansion Ratio) 8–15; FIR (Foam Injection Ratio) 30–60%.</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {currentMode === 'MINING' && (
                <div className="space-y-3">
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
                    <h4 className="font-extrabold text-sm text-emerald-300 flex items-center gap-2">
                      <Shield className="w-4 h-4 text-emerald-400" />
                      <span>Underground Hardrock Mining Ground Support &amp; Mathews Stope Guidelines</span>
                    </h4>
                    <p className="text-xs text-slate-300 mt-1">
                      Friction stabilizers, fully grouted resin rebar, bulbed cable bolts, dynamic yielding bolts, and Mathews stability chart.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="p-3 bg-slate-950 border border-emerald-500/30 rounded-xl space-y-2">
                      <h5 className="font-extrabold text-xs text-emerald-300 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Friction Stabilizers (Split Sets)</span>
                      </h5>
                      <ul className="text-xs text-slate-300 space-y-1 list-disc list-inside">
                        <li><strong>Sizes:</strong> SS-39 (39mm OD in 35–38mm hole) and SS-46 (46mm OD in 41–44mm hole).</li>
                        <li><strong>Capacity:</strong> Initial friction anchor 80 to 120 kN (8–12 tonnes). Increases with ground movement.</li>
                        <li><strong>Application:</strong> Fast drift production support, stope brows, temporary hanging wall pinning.</li>
                        <li><strong>Corrosion Note:</strong> Uncoated steel has 1–3 year life in acidic mine water; specify hot-dip galvanized.</li>
                      </ul>
                    </div>

                    <div className="p-3 bg-slate-950 border border-emerald-500/30 rounded-xl space-y-2">
                      <h5 className="font-extrabold text-xs text-emerald-300 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Resin Rebar &amp; Dynamic Yielding Bolts</span>
                      </h5>
                      <ul className="text-xs text-slate-300 space-y-1 list-disc list-inside">
                        <li><strong>Threadbar:</strong> Ø20mm / Ø22mm grade 500 MPa rebar with dual-speed polyester resin cartridges.</li>
                        <li><strong>Fast/Slow Resin:</strong> Fast resin (30-second set) at toe anchor; slow resin (90-second set) along column.</li>
                        <li><strong>Dynamic Support (D-Bolt / Cone Bolt):</strong> Smooth shank with anchor paddles capable of 150–250mm elongation without snapping during rockburst energy release (up to 30–50 kJ/m²).</li>
                        <li><strong>Mesh:</strong> High-tensile chain-link or welded mesh (5.6mm wire) strapped across rockbolt plates.</li>
                      </ul>
                    </div>

                    <div className="p-3 bg-slate-950 border border-emerald-500/30 rounded-xl space-y-2">
                      <h5 className="font-extrabold text-xs text-emerald-300 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Stope Hanging Wall Cable Bolting</span>
                      </h5>
                      <ul className="text-xs text-slate-300 space-y-1 list-disc list-inside">
                        <li><strong>Strand:</strong> 15.2mm (0.6") high-tensile 7-wire strand (UTS 260 kN per strand).</li>
                        <li><strong>Bulbed / Modified Strand:</strong> 25mm birdcages or nutcages every 1.0m to dramatically increase mechanical interlock in cement grout.</li>
                        <li><strong>Grout W:C Ratio:</strong> 0.35 to 0.40 neat cement grout with anti-bleed agent (UCS &gt; 40 MPa at 28 days).</li>
                        <li><strong>Installation Pattern:</strong> Fan arrays 1.8m to 2.5m spacing, 8m to 15m deep into hanging wall.</li>
                      </ul>
                    </div>

                    <div className="p-3 bg-slate-950 border border-emerald-500/30 rounded-xl space-y-2">
                      <h5 className="font-extrabold text-xs text-emerald-300 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Mathews Stability Graph &amp; Stope Backfill</span>
                      </h5>
                      <ul className="text-xs text-slate-300 space-y-1 list-disc list-inside">
                        <li><strong>Stability Number N':</strong> N' = Q' × A (stress factor) × B (joint orientation factor) × C (gravity factor).</li>
                        <li><strong>Hydraulic Radius (HR):</strong> HR = Area / Perimeter. Stable stopes typically have HR &lt; 6–8 without cables; HR 8–15 requires systematic cable bolting.</li>
                        <li><strong>Paste Backfill:</strong> Mill tailings filtered to 75–82% solids + 3–7% OPC binder. Slump 7–9 inches (180–230mm).</li>
                        <li><strong>Curing:</strong> 28-day UCS 0.5–1.0 MPa for primary stopes; 1.5–2.0 MPa for undercut sills.</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: PROJECT & LOCATION SUPPORT MATCH */}
          {activeTab === 'project_locations' && (
            <div className="space-y-3">
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="font-bold text-xs text-slate-200">Select Project &amp; Tunnel Heading:</h4>
                  <p className="text-[11px] text-slate-400">View what ground support class and parameters are approved for this specific tunnel location.</p>
                </div>
                {savedProjects.length > 0 && (
                  <select
                    value={selectedProjectId}
                    onChange={(e) => setSelectedProjectId(e.target.value)}
                    className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-emerald-300 font-bold outline-none"
                  >
                    {savedProjects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.projectName || p.tunnelName} ({p.location || 'Heading 01'})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {activeProject ? (
                <div className="space-y-3">
                  <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-sm text-emerald-400">{activeProject.projectName || activeProject.tunnelName}</span>
                      <span className="text-[10.5px] font-mono text-slate-400">ID: {activeProject.id.slice(-6).toUpperCase()}</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-slate-300 pt-1">
                      <div><span className="text-slate-500 font-bold">Client:</span> {activeProject.settings?.sheetConfig?.clientSignName || 'N/A'}</div>
                      <div><span className="text-slate-500 font-bold">Consultant:</span> {activeProject.settings?.sheetConfig?.consultantSignName || 'N/A'}</div>
                      <div><span className="text-slate-500 font-bold">Contractor:</span> {activeProject.settings?.sheetConfig?.contractorSignName || 'N/A'}</div>
                      <div><span className="text-slate-500 font-bold">Location:</span> {activeProject.location || 'Main Heading'}</div>
                    </div>
                  </div>

                  {/* Tunnel Locations Table */}
                  <div className="border border-slate-800 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-950 text-slate-400 font-mono text-[10.5px] border-b border-slate-800">
                        <tr>
                          <th className="p-2.5">Location / Heading</th>
                          <th className="p-2.5">Shape &amp; Size</th>
                          <th className="p-2.5">Chainage Range</th>
                          <th className="p-2.5">Approved Support Class</th>
                          <th className="p-2.5">Rockbolts &amp; Shotcrete</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800 font-mono text-[11px]">
                        {[
                          {
                            id: activeProject.id,
                            name: activeProject.location || activeProject.settings?.location || 'Main Heading 01',
                            shape: activeProject.geometry?.profileType || 'horseshoe',
                            widthM: activeProject.geometry?.width || 8.5,
                            heightM: activeProject.geometry?.height || 7.2,
                            chainageLabel: `${activeProject.chainage || activeProject.faceChainage || 'CH 0+00.0m'}`,
                          },
                        ].map((loc, idx) => (
                          <tr key={loc.id || idx} className="hover:bg-slate-850">
                            <td className="p-2.5 font-bold text-slate-100 flex items-center gap-1.5">
                              <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                              <span>{loc.name || `Heading ${idx + 1}`}</span>
                            </td>
                            <td className="p-2.5 text-slate-300">
                              {loc.shape?.toUpperCase() || 'HORSESHOE'} ({loc.widthM}m × {loc.heightM}m)
                            </td>
                            <td className="p-2.5 text-slate-300">
                              {loc.chainageLabel}
                            </td>
                            <td className="p-2.5">
                              <span className="px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-600 font-bold text-[10px]">
                                NATM Class III / B2 (RMR 45–55)
                              </span>
                            </td>
                            <td className="p-2.5 text-slate-300">
                              Swellex L=3.5m @ 1.5m × 1.5m + 100mm SFRC + Lattice Girders
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="p-6 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl">
                  No projects saved in memory. Create or import a project in Data Storage to view custom location support matching.
                </div>
              )}
            </div>
          )}

          {/* TAB 3: GRAIN SIZE SPECTRUM & SOIL/ROCK TEXTURE */}
          {activeTab === 'grain_size' && (
            <div className="space-y-3">
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
                <h4 className="font-extrabold text-sm text-cyan-300 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-cyan-400" />
                  <span>Standard Udden-Wentworth Grain Size Spectrum &amp; Crystal Textures</span>
                </h4>
                <p className="text-xs text-slate-300 mt-1">
                  Authoritative engineering grain size scale for clastic sedimentary rocks, fault gouge, soils, and igneous textures.
                </p>
              </div>

              {/* Visual Grain Spectrum Bar */}
              <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950">
                <div className="p-2.5 border-b border-slate-800 font-bold text-xs text-slate-300 flex items-center justify-between">
                  <span>Particle Classification Table (Wentworth Scale)</span>
                  <span className="text-[10px] text-slate-500 font-mono">ISO 14688-1 / ASTM D2487</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-slate-900 text-slate-400 text-[10.5px] border-b border-slate-800">
                      <tr>
                        <th className="p-2">Category</th>
                        <th className="p-2">Sub-division</th>
                        <th className="p-2">Millimeter Range</th>
                        <th className="p-2">Microns (µm) / Phi (φ)</th>
                        <th className="p-2">Field Identification &amp; Rock Equivalent</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 text-[11px]">
                      <tr className="bg-slate-950/60">
                        <td className="p-2 font-bold text-amber-400">Clay</td>
                        <td className="p-2 text-slate-300">Colloidal &amp; Fine Clay</td>
                        <td className="p-2 text-emerald-400 font-bold">&lt; 0.0039 mm</td>
                        <td className="p-2 text-slate-400">&lt; 4 µm (φ &gt; 8)</td>
                        <td className="p-2 text-slate-300 font-sans">Smooth feel between fingers and teeth; plastic when wet. (Shale, Claystone)</td>
                      </tr>
                      <tr>
                        <td className="p-2 font-bold text-amber-400">Silt</td>
                        <td className="p-2 text-slate-300">Fine, Medium, Coarse Silt</td>
                        <td className="p-2 text-emerald-400 font-bold">0.0039 – 0.0625 mm</td>
                        <td className="p-2 text-slate-400">4 – 63 µm (φ 8 to 4)</td>
                        <td className="p-2 text-slate-300 font-sans">Gritty between teeth, smooth to touch. Individual grains invisible to naked eye. (Siltstone)</td>
                      </tr>
                      <tr className="bg-slate-950/60">
                        <td className="p-2 font-bold text-cyan-400" rowSpan={5}>Sand</td>
                        <td className="p-2 text-slate-300">Very Fine Sand</td>
                        <td className="p-2 text-emerald-400 font-bold">0.0625 – 0.125 mm</td>
                        <td className="p-2 text-slate-400">63 – 125 µm (φ 4 to 3)</td>
                        <td className="p-2 text-slate-300 font-sans" rowSpan={5}>Visible grains, rough texture, non-plastic. Sugar-like texture. (Sandstone, Greywacke, Quartzite)</td>
                      </tr>
                      <tr className="bg-slate-950/60">
                        <td className="p-2 text-slate-300">Fine Sand</td>
                        <td className="p-2 text-emerald-400 font-bold">0.125 – 0.25 mm</td>
                        <td className="p-2 text-slate-400">125 – 250 µm (φ 3 to 2)</td>
                      </tr>
                      <tr className="bg-slate-950/60">
                        <td className="p-2 text-slate-300">Medium Sand</td>
                        <td className="p-2 text-emerald-400 font-bold">0.25 – 0.50 mm</td>
                        <td className="p-2 text-slate-400">250 – 500 µm (φ 2 to 1)</td>
                      </tr>
                      <tr className="bg-slate-950/60">
                        <td className="p-2 text-slate-300">Coarse Sand</td>
                        <td className="p-2 text-emerald-400 font-bold">0.50 – 1.0 mm</td>
                        <td className="p-2 text-slate-400">500 – 1000 µm (φ 1 to 0)</td>
                      </tr>
                      <tr className="bg-slate-950/60">
                        <td className="p-2 text-slate-300">Very Coarse Sand</td>
                        <td className="p-2 text-emerald-400 font-bold">1.0 – 2.0 mm</td>
                        <td className="p-2 text-slate-400">1000 – 2000 µm (φ 0 to -1)</td>
                      </tr>
                      <tr>
                        <td className="p-2 font-bold text-indigo-400" rowSpan={2}>Gravel</td>
                        <td className="p-2 text-slate-300">Granule / Fine Gravel</td>
                        <td className="p-2 text-emerald-400 font-bold">2.0 – 4.0 mm</td>
                        <td className="p-2 text-slate-400">2 – 4 mm (φ -1 to -2)</td>
                        <td className="p-2 text-slate-300 font-sans">Matchhead size rock particles. (Conglomerate matrix)</td>
                      </tr>
                      <tr>
                        <td className="p-2 text-slate-300">Pebble Gravel</td>
                        <td className="p-2 text-emerald-400 font-bold">4.0 – 64 mm</td>
                        <td className="p-2 text-slate-400">4 – 64 mm (φ -2 to -6)</td>
                        <td className="p-2 text-slate-300 font-sans">Pea to tennis ball sized stones. (Conglomerate / Breccia clasts)</td>
                      </tr>
                      <tr className="bg-slate-950/60">
                        <td className="p-2 font-bold text-rose-400">Cobble</td>
                        <td className="p-2 text-slate-300">Cobbles</td>
                        <td className="p-2 text-emerald-400 font-bold">64 – 256 mm</td>
                        <td className="p-2 text-slate-400">6.4 – 25.6 cm</td>
                        <td className="p-2 text-slate-300 font-sans">Grapefruit to basketball size stones. Hand-carried blocks.</td>
                      </tr>
                      <tr>
                        <td className="p-2 font-bold text-red-500">Boulder</td>
                        <td className="p-2 text-slate-300">Boulders</td>
                        <td className="p-2 text-emerald-400 font-bold">&gt; 256 mm (&gt; 0.25 m)</td>
                        <td className="p-2 text-slate-400">&gt; 25.6 cm</td>
                        <td className="p-2 text-slate-300 font-sans">Massive blocks requiring heavy machinery to handle.</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Crystal / Igneous & Metamorphic Texture Box */}
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                <h5 className="font-extrabold text-xs text-amber-300">Crystalline Grain Size (Igneous &amp; Metamorphic Textures)</h5>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                  <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="font-bold text-cyan-300 block">Aphanitic</span>
                    <span className="text-[10px] text-slate-400 font-mono">&lt; 1.0 mm</span>
                    <p className="text-[10px] text-slate-400 mt-1">Crystals too small to identify with eye (Basalt, Rhyolite).</p>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="font-bold text-cyan-300 block">Fine Phaneritic</span>
                    <span className="text-[10px] text-slate-400 font-mono">1.0 – 5.0 mm</span>
                    <p className="text-[10px] text-slate-400 mt-1">Microgranite, fine Gabbro, Diabase.</p>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="font-bold text-cyan-300 block">Medium Phaneritic</span>
                    <span className="text-[10px] text-slate-400 font-mono">5.0 – 10.0 mm</span>
                    <p className="text-[10px] text-slate-400 mt-1">Standard intrusive Granite, Diorite, Gneiss.</p>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="font-bold text-cyan-300 block">Coarse Phaneritic</span>
                    <span className="text-[10px] text-slate-400 font-mono">10.0 – 30.0 mm</span>
                    <p className="text-[10px] text-slate-400 mt-1">Porphyritic phenocrysts, coarse Syenite.</p>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="font-bold text-cyan-300 block">Pegmatitic</span>
                    <span className="text-[10px] text-slate-400 font-mono">&gt; 30.0 mm</span>
                    <p className="text-[10px] text-slate-400 mt-1">Huge crystal veins (Quartz, Feldspar, Mica books).</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: RMR (BIENIAWSKI 1989) CHART */}
          {activeTab === 'rmr_chart' && (
            <div className="space-y-3">
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
                <h4 className="font-extrabold text-sm text-amber-300 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-amber-400" />
                  <span>Bieniawski RMR89 Excavation &amp; Support Guidelines (10m Span Tunnel)</span>
                </h4>
                <p className="text-xs text-slate-300 mt-1">
                  Empirical guidelines for horseshoe/D-shaped tunnels under maximum 25 MPa vertical in-situ stress.
                </p>
              </div>

              <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-slate-900 text-slate-400 text-[10.5px] border-b border-slate-800">
                    <tr>
                      <th className="p-2.5">Rock Class</th>
                      <th className="p-2.5">Stand-up Time</th>
                      <th className="p-2.5">Excavation Method</th>
                      <th className="p-2.5">Rockbolts (20mm fully grouted)</th>
                      <th className="p-2.5">Shotcrete</th>
                      <th className="p-2.5">Steel Ribs</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-[11px]">
                    <tr className="hover:bg-slate-850">
                      <td className="p-2.5 font-bold text-emerald-400">Class I: Very Good (81–100)</td>
                      <td className="p-2.5 text-slate-300">20 years for 15m span</td>
                      <td className="p-2.5 text-slate-300">Full face, 3m advance</td>
                      <td className="p-2.5 text-slate-300">Generally none; spot bolts in crown if needed</td>
                      <td className="p-2.5 text-slate-300">None</td>
                      <td className="p-2.5 text-slate-300">None</td>
                    </tr>
                    <tr className="hover:bg-slate-850 bg-slate-950/60">
                      <td className="p-2.5 font-bold text-blue-400">Class II: Good (61–80)</td>
                      <td className="p-2.5 text-slate-300">1 year for 10m span</td>
                      <td className="p-2.5 text-slate-300">Full face, 1.0–1.5m advance; support 20m from face</td>
                      <td className="p-2.5 text-slate-300">Locally in crown, L=3m, spaced 2.5m with wire mesh</td>
                      <td className="p-2.5 text-slate-300">50mm in crown where required</td>
                      <td className="p-2.5 text-slate-300">None</td>
                    </tr>
                    <tr className="hover:bg-slate-850">
                      <td className="p-2.5 font-bold text-amber-400">Class III: Fair (41–60)</td>
                      <td className="p-2.5 text-slate-300">1 week for 5m span</td>
                      <td className="p-2.5 text-slate-300">Top heading &amp; bench, 1.5–3.0m advance; complete support 10m from face</td>
                      <td className="p-2.5 text-slate-300">Systematic, L=4m, spaced 1.5–2.0m in crown and walls with wire mesh</td>
                      <td className="p-2.5 text-slate-300">50–100mm in crown and 30mm in sides</td>
                      <td className="p-2.5 text-slate-300">None</td>
                    </tr>
                    <tr className="hover:bg-slate-850 bg-slate-950/60">
                      <td className="p-2.5 font-bold text-rose-400">Class IV: Poor (21–40)</td>
                      <td className="p-2.5 text-slate-300">10 hours for 2.5m span</td>
                      <td className="p-2.5 text-slate-300">Top heading &amp; bench, 1.0–1.5m advance; install support concurrently with excavation</td>
                      <td className="p-2.5 text-slate-300">Systematic, L=4–5m, spaced 1.0–1.5m in crown &amp; walls with wire mesh</td>
                      <td className="p-2.5 text-slate-300">100–150mm in crown and 100mm in sides</td>
                      <td className="p-2.5 text-slate-300">Light to medium ribs spaced 1.5m where required</td>
                    </tr>
                    <tr className="hover:bg-slate-850">
                      <td className="p-2.5 font-bold text-red-500">Class V: Very Poor (&lt; 20)</td>
                      <td className="p-2.5 text-slate-300">30 minutes for 1m span</td>
                      <td className="p-2.5 text-slate-300">Multiple drifts; 0.5–1.0m advance; forepoling; invert within 10m of face</td>
                      <td className="p-2.5 text-slate-300">Systematic, L=5–6m, spaced 1.0–1.2m in crown &amp; walls with mesh. Invert bolts</td>
                      <td className="p-2.5 text-slate-300">150–200mm in crown, 150mm in sides, 50mm at face</td>
                      <td className="p-2.5 text-slate-300">Medium to heavy ribs spaced 0.75m with steel lagging and invert struts</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 5: Q-SYSTEM (GRIMSTAD & BARTON 1993) CHART */}
          {activeTab === 'q_system' && (
            <div className="space-y-3">
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
                <h4 className="font-extrabold text-sm text-cyan-300 flex items-center gap-2">
                  <HardHat className="w-4 h-4 text-cyan-400" />
                  <span>NGI Q-System Ground Support Categories (Grimstad &amp; Barton 1993)</span>
                </h4>
                <p className="text-xs text-slate-300 mt-1">
                  Correlation between Rock Mass Quality Q = (RQD/Jn) × (Jr/Ja) × (Jw/SRF) and Equivalent Dimension De = Span / ESR.
                </p>
              </div>

              <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-slate-900 text-slate-400 text-[10.5px] border-b border-slate-800">
                    <tr>
                      <th className="p-2.5">Category</th>
                      <th className="p-2.5">Q Range</th>
                      <th className="p-2.5">Rock Mass Description</th>
                      <th className="p-2.5">Bolt Spacing (ctc)</th>
                      <th className="p-2.5">Fiber-Reinforced Shotcrete (Sfr)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-[11px]">
                    <tr className="hover:bg-slate-850">
                      <td className="p-2.5 font-bold text-emerald-400">1. Unsupported</td>
                      <td className="p-2.5 text-emerald-400 font-bold">&gt; 10 to 1000</td>
                      <td className="p-2.5 text-slate-300">Exceptionally good to extremely good</td>
                      <td className="p-2.5 text-slate-400">None</td>
                      <td className="p-2.5 text-slate-400">None</td>
                    </tr>
                    <tr className="hover:bg-slate-850 bg-slate-950/60">
                      <td className="p-2.5 font-bold text-blue-400">2. Spot Bolting (sb)</td>
                      <td className="p-2.5 text-blue-400 font-bold">4.0 to 10</td>
                      <td className="p-2.5 text-slate-300">Good quality rock</td>
                      <td className="p-2.5 text-slate-300">Spot bolts only where loose blocks occur</td>
                      <td className="p-2.5 text-slate-400">None</td>
                    </tr>
                    <tr className="hover:bg-slate-850">
                      <td className="p-2.5 font-bold text-cyan-400">3. Systematic Bolting (B)</td>
                      <td className="p-2.5 text-cyan-400 font-bold">1.0 to 4.0</td>
                      <td className="p-2.5 text-slate-300">Fair quality rock</td>
                      <td className="p-2.5 text-slate-300">Bolts @ 2.0m to 2.5m spacing</td>
                      <td className="p-2.5 text-slate-400">None to spot shotcrete</td>
                    </tr>
                    <tr className="hover:bg-slate-850 bg-slate-950/60">
                      <td className="p-2.5 font-bold text-amber-400">4. Systematic Bolting + unreinforced S (B+S)</td>
                      <td className="p-2.5 text-amber-400 font-bold">0.4 to 1.0</td>
                      <td className="p-2.5 text-slate-300">Poor quality rock</td>
                      <td className="p-2.5 text-slate-300">Bolts @ 1.7m to 2.0m spacing</td>
                      <td className="p-2.5 text-slate-300">40–50mm plain shotcrete</td>
                    </tr>
                    <tr className="hover:bg-slate-850">
                      <td className="p-2.5 font-bold text-orange-400">5. Fiber Shotcrete &amp; Bolting (Sfr+B)</td>
                      <td className="p-2.5 text-orange-400 font-bold">0.1 to 0.4</td>
                      <td className="p-2.5 text-slate-300">Very poor quality rock</td>
                      <td className="p-2.5 text-slate-300">Bolts @ 1.4m to 1.7m spacing</td>
                      <td className="p-2.5 text-slate-300">50–90mm steel fiber shotcrete</td>
                    </tr>
                    <tr className="hover:bg-slate-850 bg-slate-950/60">
                      <td className="p-2.5 font-bold text-rose-400">6. Heavy Fiber Shotcrete &amp; Bolting</td>
                      <td className="p-2.5 text-rose-400 font-bold">0.01 to 0.1</td>
                      <td className="p-2.5 text-slate-300">Extremely poor quality rock</td>
                      <td className="p-2.5 text-slate-300">Bolts @ 1.1m to 1.4m spacing</td>
                      <td className="p-2.5 text-slate-300">90–120mm fiber shotcrete</td>
                    </tr>
                    <tr className="hover:bg-slate-850">
                      <td className="p-2.5 font-bold text-red-500">7. Heavy Sfr + Reinforced Ribs (RRS)</td>
                      <td className="p-2.5 text-red-500 font-bold">&lt; 0.01</td>
                      <td className="p-2.5 text-slate-300">Exceptionally poor / squeezing rock</td>
                      <td className="p-2.5 text-slate-300">Bolts @ 1.0m spacing</td>
                      <td className="p-2.5 text-slate-300">120–250mm Sfr + reinforced concrete arches (CCA)</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-4 py-2 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs shrink-0">
          <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-emerald-400" />
            <span>International ISRM, NGI, and US Army Corps of Engineers ground support references.</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs cursor-pointer transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
