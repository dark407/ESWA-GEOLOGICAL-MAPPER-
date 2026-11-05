# Domain-Specific Multi-Page Analytical Dossiers for TBM & Underground Mining

Deliver publication-grade, multi-page ISO A4 analytical dossiers for **TBM Mechanized Tunneling** and **Underground Hardrock Mining** that match the engineering rigor, document finishing, and 300 DPI PDF / Word export quality of the NATM report while organizing every page around each discipline's unique data model, calculations, and operational purpose.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> All core architectural and content decisions below reflect your confirmed choices from Phase 1. Neither TBM nor Mining reports will force NATM-specific fields; instead, each dossier adapts dynamically to the actual data logged in that module and automatically hides optional sections that have not been recorded.

- **Confirmed Decision 1 — Multi-Page Analytical Dossier with Cover Sheet**: Both TBM and Underground Mining reports will be structured as multi-page ISO A4 portrait engineering dossiers featuring an executive cover/title block, dedicated graphical mapping & CAD sheets, quantitative analytical/telemetry sheets, and formal multi-party sign-off blocks.
- **Confirmed Decision 2 — TBM-Specific Engineering Scope**:
  1. **360° Unrolled Ring Map, Cutterhead Face & Annular Segment Ring Diagram** (lithology contacts, discontinuities, water ingress points, key segment clock position, ring roll/pitch/lead).
  2. **TBM Boring Telemetry & Machine Performance** (thrust force, cutterhead torque, RPM, penetration rate, Field Penetration Index $FPI$, Specific Energy $SE$, and EPB/Slurry face pressure parameters when applicable).
  3. **Geotechnical Classification & Correlations** ($Q_{\text{TBM}}$, Barton $Q$, Bieniawski $\text{RMR}_{89}$, Hoek $\text{GSI}$, rock mass properties $E_m$, $\sigma_{cm}$, and support/lining verification).
  4. **Cutterhead Tool Wear Map, Annular Grout Volume & Probe Hole Drilling Ahead Log** (radial disc cutter wear profile, actual vs. theoretical backfill grout ratio, and MWD/probe drilling ahead log).
  5. **Multi-Ring Longitudinal Chainage Trend Charts** (thrust, torque, penetration rate, $Q$/$\text{RMR}$, and groundwater inflow plotted across the filtered ring/chainage interval).
- **Confirmed Decision 3 — Underground Mining Geological & Grade-Control Scope**:
  1. **Scaled Stope/Drift Face CAD Map** (true-to-scale fed underground profile with clipped geological patterns for high/medium/low grade ore lodes, quartz veins, faults, shear zones, alteration halos, and channel cut vectors).
  2. **Channel Cut Assay Table, Composite Grade & Dilution Reconciliation** (length- × SG-weighted composite grade, true thickness, unplanned wallrock dilution %, and QA/QC flags).
  3. **Muck Haulage Routing Verdict, Blast Round Tonnage & Contained Metal** (automated Mill / Low-Grade Stockpile / Waste Dump dispatch stamp, ore vs. waste tonnage split, and contained metal in grams/troy ounces or tonnes).
  4. **Laubscher MRMR & Mathews-Potvin Stability Graph** (in-situ RMR to adjusted Mining Rock Mass Rating breakdown, Hydraulic Radius $HR$, Modified Stability Number $N'$, and plotted stability zone).
  5. **Kinematic Wedge Analysis & Ground Support Pattern Diagram** (structural discontinuity table, stereonet/wedge hazard evaluation, and rockbolt/mesh/shotcrete ground support specification).
- **Confirmed Decision 4 — Shared NATM-Grade Document Finishing & Exports**:
  - **True 300 DPI Multi-Page ISO A4 PDF & Editable Word (`.docx`) Export** (`2480 × 3508 px` per page supersampled canvas pipeline + structured Word document generator).
  - **Universal Dual Company Logo Cropper & Digital Signature Boxes** (interactive auto-trim, zoom/pan/crop modal, and transparent PNG signature placement for Geologist, Engineer/Operator, and Manager/Client).
  - **Smart Auto-Hide for Unlogged Optional Sections** (if probe drilling, instrumentation, or channel cuts are empty for a given record, those sub-blocks gracefully collapse or adapt without printing fake placeholder numbers).
  - **Editable Geologist Remarks & Custom Sign-Off Title Block** (live inline editing persisted per project/workspace).

---

## 1. Overview & Core Concept

- **What It Does**: Replaces generic single-sheet summaries in the TBM and Underground Mining modules with comprehensive, multi-page ISO A4 engineering dossiers tailored to mechanized tunneling and underground hardrock grade control/geomechanics.
- **Target Audience / Persona**: Tunneling Chief Geologists, TBM Shift & Performance Engineers, Underground Mine Production Geologists, Grade Control Superintendents, and Rock Mechanics Engineers preparing official shift handovers, audit packages, and statutory compliance records.
- **Key Value**:
  - **Domain Authenticity**: TBM dossiers focus on ring advance, cutterhead mechanics, segmental lining, annular grouting, and longitudinal boring trends; Mining dossiers focus on stope face lithology/ore geometry, assay composites, dilution, muck routing, and MRMR/Mathews stability.
  - **Zero Forced/Empty Boilerplate**: Every table, chart, and diagram is driven strictly by the user's logged TBM rings or mapped Mining stope faces, with automatic conditional rendering when optional parameters are omitted.

---

## 2. User Experience & Visual Design

### Key User Flows
1. **Launching the Dossier Studio**:
   - **In TBM**: From the TBM Reports Workspace (or directly from a logged Ring Record), the user selects the target ring or chainage range, switches between specialized dossier presets or the **Full Multi-Page TBM Analytical Dossier**, customizes logos/signatures/remarks inline, previews every A4 page at true scale, and exports a **300 DPI Multi-Page PDF** or **Editable Word (`.docx`)**.
   - **In Underground Mining**: From the Face Mapping Toolbar (`Print / Official Report`) or the **Mine CAD, Geological Delivery & Compliance Hub**, the user opens the **Multi-Page Underground Mining Geological & Geotechnical Dossier**, toggles optional pages/sections, adjusts dual company logos and signatures via the interactive cropper, edits dispatch notes, and downloads the **300 DPI Multi-Page PDF** or **Editable Word (`.docx`)**.
2. **Logo & Signature Calibration**:
   - Clicking either header logo slot (Client / Contractor / Mine Company) or any footer signature box opens the **Universal Image Crop & Fit Modal** with 1-click Auto-Trim of whitespace, zoom/pan sliders, and transparent rendering.
3. **Dynamic Section Visibility & Auto-Hide**:
   - An interactive toolbar bar above the A4 preview lets the user toggle **"Auto-Hide Empty Optional Sections"** (enabled by default) or manually check/uncheck individual dossier sections before exporting.

### Visual Identity & Theme
- **Aesthetic Direction**: Clinical engineering blueprint and empirical dossier precision (`references/8_science_space_biotech.md`).
- **Color Palette & Mood (60-30-10 Distribution)**:
  - **60% Dominant Canvas**: Workspace studio backdrop in deep obsidian slate (`#07090E` / `bg-slate-950`) surrounding crisp, physical ISO A4 paper sheets in pure archival white (`#FFFFFF`) with high-contrast ink (`#0F172A`).
  - **30% Structural Surfaces & Grids**: Precision `1px` hairline CAD borders (`#CBD5E1` / `#0F172A` for primary title blocks), subtle header fill tints (`#F8FAFC`), and technical coordinate axes.
  - **10% Calibrated Telemetry Accents**: Cyan (`#06B6D4`) for TBM boring telemetry and hydrogeology; Amber/Gold (`#F59E0B`) and Emerald (`#10B981`) for Mining ore grade reconciliation and stability zones; Rose (`#E11D48`) strictly for high-grade cutoffs or critical ground hazards.
- **Typography & Tabular Discipline**:
  - **Headers & Engineering Titles**: Clean technical geometric sans-serif with balanced headline wrapping and clear hierarchical section indices (`01. Executive Ring Summary`, `02. Cutterhead & 360° Unrolled Ring Map`).
  - **Telemetry, Coordinates, Assays & Calculations**: Strict tabular numerals (`font-mono tabular-nums`) with explicit unit separation (prominent numeric readout paired with muted unit notation such as `kN`, `kNm`, `mm/rev`, `MJ/m³`, `g/t Au`, `mRL`).
  - **Anti-Slop & Zero-Pill Discipline**: Metadata in title blocks and tables uses clean unboxed typography with hairlines and `·` separators rather than decorative rounded pills or status dots.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Distinct Multi-Page Architectures for TBM vs. Mining**
  - *Chosen Approach*: Build two purpose-engineered multi-page A4 dossier renderers and export pipelines—one dedicated to **TBM Mechanized Tunneling** (3–4 pages depending on available data) and one dedicated to **Underground Mining Face & Stope Evaluation** (3 pages)—sharing only the low-level 300 DPI raster/vector PDF compiler, Word `.docx` builder, and Universal Logo/Signature Cropper.
  - *Why*: TBM excavation is governed by continuous ring-by-ring chainage advance, machine thrust/torque/FPI telemetry, precast segment kinematics, and probe drilling ahead, whereas Underground Mining is governed by discrete stope/drift blast rounds, 2D vector ore/waste polygons, channel sample assays, dilution economics, and MRMR/Mathews stope stability.
  - *Alternatives Considered*: Reusing the NATM 2-page template with renamed labels was rejected because it forces irrelevant NATM support fields and omits critical TBM telemetry and Mining grade-control economics.

- **Decision 2: Data-Driven Auto-Hide for Optional Sub-Sections**
  - *Chosen Approach*: Inspect each record's populated arrays and numeric fields prior to layout composition. Sections with zero logged items (e.g., no probe hole drilled on that ring, no hazards recorded, or no channel samples cut on a development waste face) either auto-collapse cleanly or display a single concise `"Not Recorded for This Interval"` row when the user toggles full-template mode.
  - *Why*: Prevents cluttered tables full of zeroes or dashes and ensures reports look authoritative whether the user logged a quick face sketch or a full telemetry + assay suite.

- **Decision 3: True 300 DPI Multi-Page Canvas PDF + Native Word (`.docx`) Generation**
  - *Chosen Approach*: Render each ISO A4 page (`210mm × 297mm` aspect ratio, `1240 × 1754 px` base layout supersampled at `2.0×` to `2480 × 3508 px`) onto offscreen high-DPI canvases with embedded SVG vector drawings, geological patterns, and cropped logos/signatures, then bundle all pages into a single multi-page binary PDF-1.4 document and a companion `.docx` export.
  - *Why*: Guarantees 100% visual fidelity between on-screen A4 preview, printed hardcopy, and downloaded PDF/Word files with zero external server dependencies.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

### Architecture & Component Diagram

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                 SHARED DOCUMENT FINISHING & EXPORT INFRASTRUCTURE            │
│  ┌────────────────────────────────────┐  ┌────────────────────────────────┐  │
│  │ UniversalLogoAndSignatureAdjuster  │  │ Multi-Page 300 DPI A4 PDF &    │  │
│  │ • Auto-Trim & Crop/Zoom/Pan Modal  │  │ Word (.docx) Export Engine     │  │
│  │ • Persisted Dual Logos & 3 Signs   │  │ • 2480×3508px Page Composer    │  │
│  └─────────────────┬──────────────────┘  └───────────────┬────────────────┘  │
└────────────────────┼─────────────────────────────────────┼───────────────────┘
                     │                                     │
         ┌───────────┴───────────┐             ┌───────────┴───────────┐
         ▼                       ▼             ▼                       ▼
┌─────────────────────────────────────────┐   ┌─────────────────────────────────────────┐
│     TBM MULTI-PAGE DOSSIER STUDIO       │   │   MINING MULTI-PAGE DOSSIER STUDIO      │
│                                         │   │                                         │
│ ┌─────────────────────────────────────┐ │   │ ┌─────────────────────────────────────┐ │
│ │ Page 1: Cover Title Block, Ring/Ch  │ │   │ │ Page 1: Cover Title Block, Scaled   │ │
│ │ Metadata, 360° Unrolled Ring Map,   │ │   │ │ Underground Face CAD Map (Clipped), │ │
│ │ Cutterhead Face & Segment Ring SVG  │ │   │ │ Lithology/Structural Legend & Notes │ │
│ └─────────────────────────────────────┘ │   │ └─────────────────────────────────────┘ │
│ ┌─────────────────────────────────────┐ │   │ ┌─────────────────────────────────────┐ │
│ │ Page 2: Boring Telemetry (Thrust,   │ │   │ │ Page 2: Grade Control & Assay       │ │
│ │ Torque, PR, FPI, SE, EPB/Slurry),   │ │   │ │ Reconciliation Table, Weighted      │ │
│ │ Cutterhead Tool Wear Map & Grout    │ │   │ │ Composite, Dilution & Muck Verdict  │ │
│ └─────────────────────────────────────┘ │   │ └─────────────────────────────────────┘ │
│ ┌─────────────────────────────────────┐ │   │ ┌─────────────────────────────────────┐ │
│ │ Page 3: Q-TBM, Barton Q, RMR89,     │ │   │ │ Page 3: Laubscher MRMR Breakdown,   │ │
│ │ GSI, Probe Drilling Ahead Log,      │ │   │ │ Mathews-Potvin Stability Graph,     │ │
│ │ Multi-Ring Trend Charts & Sign-Off  │ │   │ │ Kinematic Wedge & Support Sign-Off  │ │
│ └─────────────────────────────────────┘ │   │ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘   └─────────────────────────────────────────┘
```

### Data Model & Page Composition Strategy

1. **TBM Multi-Page Analytical Dossier (`TbmExcavationRecord` + `TbmLocationItem` + `TbmProjectItem`)**:
   - **Page 1 — Executive Cover & Graphical Ring/Cutterhead Mapping**:
     - ISO Engineering Title Block with dual cropped company logos, Project/Tunnel/TBM Machine specs, Ring #, Chainage interval, Shift, and Advance duration.
     - **2D Cutterhead Face & 360° Unrolled Cylindrical Ring Map SVG**: Displays mapped rock lithology, discontinuity sets ($J_1..J_n$) with Strike/Dip/Dip-Direction, water inflow points, and segmental lining ring configuration (Key segment clock position, ring roll/pitch/lead).
     - Geological & Muck Inspection Synthesis table (rock type, weathering, UCS, chip angularity, fines/coarse ratio).
   - **Page 2 — TBM Boring Telemetry, Cutter Wear & Annular Backfill Grouting**:
     - **Boring Telemetry Matrix**: Thrust ($kN$), Torque ($kNm$), Cutterhead speed ($RPM$), Penetration per rev ($mm/rev$), Penetration rate ($mm/min$), Field Penetration Index ($FPI$), Specific Energy ($MJ/m^3$), plus conditional EPB chamber pressure/foam or Slurry density/flow metrics if the TBM is EPB/Slurry.
     - **Cutterhead Disc Wear & Tool Replacement Diagram**: Radial cutter track visualization, average wear ($mm$), cutters replaced, and downtime summary.
     - **Segmental Lining & Annular Grout Verification**: Actual vs. Theoretical grout volume ($m^3$), Grout Fill Ratio ($\%$), injection pressure ($bar$), and tail skin grease consumption ($kg$).
   - **Page 3 — Geomechanics ($Q_{\text{TBM}}$ / $\text{RMR}$), Probe Drilling Ahead, Longitudinal Trends & Sign-Off**:
     - **Rock Mass Classification & Correlations**: Barton $Q$, $Q_{\text{TBM}}$, Bieniawski $\text{RMR}_{89}$, $\text{GSI}$, Deformation Modulus $E_m$, and Support Pressure $P_{\text{arch}}$.
     - **Probe Drilling Ahead & Hydrogeology Log** *(auto-hidden if no probe hole or water inflow recorded)*: Probe hole length, drilling rate, water return, cavities ahead, and advance recommendation.
     - **Multi-Ring Longitudinal Chainage Trend Profiles**: SVG multi-track strip chart plotting Thrust/Torque, Penetration Rate, and $Q$/$\text{RMR}$ across the selected ring range.
     - **Editable Geologist Remarks & 3-Column Official Sign-Off Block** (Tunnel Geologist, TBM Shift Engineer, Project Manager) with transparent PNG signature support.

2. **Underground Mining Multi-Page Analytical Dossier (`MiningStopeItem` + `MiningLocationItem` + `MiningProjectItem`)**:
   - **Page 1 — Executive Cover & Scaled Underground Face CAD Sheet**:
     - ISO Mine Engineering Title Block with dual cropped company logos, Mine Name, Level RL, Stope/Drift ID, Chainage/Cut #, Mining Method, Commodity, and Target Cutoff Grade.
     - **High-Resolution Scaled Underground Face CAD Diagram**: Renders the exact fed excavation shape (`d_arch`, `horseshoe`, `rectangular_flat`, `shanty`, `gothic_arch`, `custom_parametric`, or `dxf_import`) with metric coordinate grid, clipped geological polygons (High/Med/Low Grade Ore Lodes, Quartz Veins, Faults, Shears, Dykes, Alteration Halos), structural dip/dip-direction ticks, and numbered Channel Sample cut vectors.
     - **Mapped Geological Features & Lithology Legend Table**: Lists all mapped polygons and polylines with feature type, rock/mineralogy code, true/apparent thickness, dip/dip-direction, and surface area/trace length.
   - **Page 2 — Grade Control, Channel Assay Reconciliation & Muck Routing Dispatch**:
     - **Muck Haulage Routing Verdict Banner**: High-contrast engineering dispatch stamp (`MILL FEED`, `LOW-GRADE STOCKPILE`, or `WASTE DUMP`) with blast round volume, ore/waste specific gravity, estimated round tonnage, and contained metal ($g / oz$ or $t$).
     - **Channel Sample Assay & QA/QC Table** *(auto-adapts if no channels cut)*: Sample ID, Vein/Domain, Cut Width ($m$), True Thickness ($m$), Rock SG, Assay Grade ($g/t$ or $\%$), Grade × Thickness accumulation, and QA/QC status.
     - **Grade & Dilution Profile Chart**: Visual bar/strip comparison of individual channel cut grades against the Target Cutoff Grade, Weighted Composite Face Grade, and Diluted Muck Grade.
   - **Page 3 — Geomechanical Stability (Laubscher MRMR & Mathews-Potvin), Wedge Analysis & Sign-Off**:
     - **Laubscher MRMR Calculation Breakdown**: In-situ RMR, weathering/mining-induced stress/joint orientation/blasting adjustment factors, final Design MRMR score, Rock Mass Class, and recommended ground support.
     - **Mathews-Potvin Stope Stability Graph (SVG)**: Plots Hydraulic Radius ($HR$) vs. Modified Stability Number ($N' = Q' \times A \times B \times C$) directly on the logarithmic Stability / Transition / Caving zones.
     - **Structural Discontinuity & Kinematic Wedge Summary + Ground Support Pattern**: Lists mapped joint/fault sets, wedge stability safety factors, and support pattern details.
     - **Editable Mine Geologist Handover Remarks & 3-Column Official Sign-Off Block** (Mine Geologist, Grade Control / Geotechnical Engineer, Mine Captain / Superintendent) with transparent PNG signature support.

### Interactive Component & State Mapping
- **Logo & Signature State**: Both TBM and Mining dossiers integrate `UniversalImageCropAndFitModal`, `ReportHeaderLogoBox`, and `ReportBorderlessGeologistSignRow` (or multi-party signature boxes) with persisted crop configurations in `localStorage` so users only configure their company logos and signatures once.
- **Section Auto-Hide & Page Controls**: Interactive toggle switches in the dossier preview header allow switching between **Full Analytical Dossier (All Pages)**, **Compact 2-Page Sheet**, or **Single-Page Executive Summary**, plus toggling **Auto-Hide Empty Optional Sections**.
- **Direct 300 DPI Multi-Page PDF & Word Export**: Clicking **Download 300 DPI PDF** or **Export Editable Word (.docx)** renders all active dossier pages sequentially and downloads a clean, multi-page engineering document.
