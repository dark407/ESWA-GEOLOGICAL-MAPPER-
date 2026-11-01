# Over NATM — Continuous 3D Logging & Unified 6-Stage Geotechnical Pipeline Plan

A unified, 6-stage geotechnical engineering pipeline that synchronizes logged excavation rounds from **Underground Face Mapping** into **Over NATM Continuous 3D Logging** across both **Tunnel (Horizontal / Inclined)** and **Vertical Shaft (Circular / Half-Circle)** excavations—progressing seamlessly from Round Selection & Sync through Clean ESWA 3D CAD Editing, High-Precision 3D Joint Inspection, Continuous Full-Length FEM/DEM Verification, Advanced Longitudinal Analysis, and the Final A3 Landscape Report.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The following architectural and UX decisions were explicitly confirmed by the user during Phase 1 clarification:
> - **Unified 6-Step Wizard Navigation**: All 6 stages (`1. Setup & Sync` → `2. ESWA 3D CAD` → `3. 3D Analysis & Joint Inspector` → `4. Continuous FEM/DEM` → `5. Advanced Analysis` → `6. A3 Report`) are organized into a unified workspace with a persistent top step bar so engineers can advance sequentially or jump back to refine edits at any time.
> - **Unlogged Chainage / Depth Gaps**: Whenever an RD chainage or shaft depth interval is missing between logged rounds, the interval is preserved at true scale as a **blank white/dark gap bounded by dashed RD/depth lines**—never filled with synthetic rock data or collapsed.
> - **Vertical Shaft 2D Strip Unfolding**: In Vertical Shaft mode, the 2D continuous strip log inside ESWA CAD and the A3 Report unfolds the cylindrical shaft wall into **4 compass-quadrant columns (`1. NE 0°–90°`, `2. ES 90°–180°`, `3. SW 180°–270°`, `4. WN 270°–360°`)** arranged vertically by sink depth (or active half-circle quadrants when Half-Circle mode is used).
> - **Continuous Full-Length FEM/DEM Visualization**: Stage 4 renders both a **Continuous Longitudinal Profile** along the entire selected chainage/depth and **Per-Round Cross-Section Slices** comparing **Before Support (Unreinforced)** vs. **After Support (Reinforced)** stress, displacement, plastic radius, and Safety Factor.

---

## 1. Overview & Core Concept

In NATM and underground shaft sinking, geotechnical engineers map individual advance pulls in **Underground Face Mapping** and then synthesize those rounds into a continuous 3D/2D geological strip record to evaluate structural continuity, design support transitions, and issue certified A3 engineering logs.

Previously, the Continuous 3D Logging workflow was loosely coupled, tunnel-centric, and suffered from visual label clutter inside the CAD strip canvas. This upgrade establishes a **single, common 6-stage workflow** that adapts automatically to **Tunnel** and **Vertical Shaft** geometries:

1. **Stage 1 — Excavation Mode, Project, Location & RD / Depth Range Sync**: Toggle between **Tunnel** and **Vertical Shaft**, filter saved projects and locations accordingly, inspect all logged face/sink rounds with their exact pull intervals (`fromRd` to `toRd`), and choose the target **From RD/Depth** and **To RD/Depth** range.
2. **Stage 2 — Clean ESWA 3D CAD Strip Log Editor**: Syncs the selected pulls directly into a clutter-free 2D/3D strip canvas. Unlogged intervals remain blank with dashed RD boundary lines. Provides full interactive CAD tools directly on the strip canvas: **Edit Text / Callouts**, **Delete**, **Move Joint**, **Merge Joints** (across adjacent pulls), **Expand / Extend Joint** (drag endpoints or extrapolate across pulls), **Draw Joint**, and **Edit Dip/Strike**.
3. **Stage 3 — Complete 3D Analysis & High-Precision 3D Joint Inspection**: Interactive 3D tunnel arch or vertical cylindrical/half-circle shaft viewport where every continuous joint plane, fault zone, and lithology boundary is reconstructed in 3D space. Engineers can isolate and inspect any joint with high precision—viewing its true 3D cutting plane, dip/dip-direction (or strike hinge), persistence across rounds, and kinematic wedge intersection.
4. **Stage 4 — Continuous Full-Length FEM / DEM Analysis (Before & After Support)**: Uses the continuous chain of rock mass parameters ($Q$, RMR, GSI, $\sigma_{ci}$, overburden $H$) and installed support details (bolts, shotcrete, steel ribs, curb ring) per round along the entire selected length to compute high-precision **Before Support** vs. **After Support** elasto-plastic FEM and discrete-block DEM behavior.
5. **Stage 5 — Continuous Advanced Geotechnical Analysis**: Multi-round longitudinal analytics derived from the synced chainage/depth dataset—including longitudinal $Q$/RMR/GSI profiles, support pressure demand vs. installed capacity, kinematic wedge factor-of-safety along chainage/depth, stand-up time & active span checks, water inflow profile, and look-ahead/sink ahead hazard forecasting.
6. **Stage 6 — Final A3 Landscape Continuous Engineering Report**: Print-ready ISO A3 engineering sheet integrating the edited CAD strip log (Tunnel 3-zone or Shaft 4-quadrant layout), true-scale blank unlogged gaps, 3D joint inspection schedule, continuous FEM/DEM verification summary, and per-round rock mass & support ledger.

---

## 2. User Experience & Visual Design

### End-to-End 6-Stage User Flow

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                     OVER NATM — CONTINUOUS 3D LOGGING WIZARD                     │
│  [1. Setup & Sync] ──> [2. ESWA 3D CAD] ──> [3. 3D Joint Inspector]              │
│        ──> [4. Continuous FEM/DEM] ──> [5. Advanced Analysis] ──> [6. A3 Report] │
└────────────────────────────────────────┬─────────────────────────────────────────┘
                                         │
       ┌─────────────────────────────────┼─────────────────────────────────┐
       ▼                                 ▼                                 ▼
┌────────────────────────────┐  ┌──────────────────────────┐  ┌────────────────────────────┐
│ Stage 1: Mode & Range Sync │  │ Stage 2: Clean ESWA CAD  │  │ Stage 3: 3D Joint Inspect  │
│ • Toggle: Tunnel | Shaft   │  │ • Zero clutter strip log │  │ • 3D Tunnel / Shaft mesh   │
│ • Select Project & Location│  │ • Blank dashed RD gaps   │  │ • Click any joint plane    │
│ • View logged pulls table  │  │ • Edit Text, Delete,     │  │ • True 3D plane cutting,   │
│ • Pick From RD → To RD     │  │   Move, Merge, Expand    │  │   dip/strike & wedge check │
└──────────────┬─────────────┘  └─────────────┬────────────┘  └──────────────┬─────────────┘
               │                              │                              │
               └──────────────────────────────┼──────────────────────────────┘
                                              ▼
       ┌──────────────────────────────────────┼────────────────────────────────────┐
       ▼                                      ▼                                    ▼
┌────────────────────────────┐  ┌──────────────────────────┐  ┌────────────────────────────┐
│ Stage 4: Full FEM / DEM    │  │ Stage 5: Advanced Geotech│  │ Stage 6: Final A3 Report   │
│ • Longitudinal profile     │  │ • Multi-round Q/RMR/GSI  │  │ • Synced CAD strip diagram │
│   (Before vs After Support)│  │ • Kinematic wedge profile│  │ • Unlogged RD gap markers  │
│ • Per-round 2D/3D cross-   │  │ • Stand-up time, water   │  │ • Joint & FEM/DEM tables   │
│   section slice inspector  │  │   inflow & look-ahead    │  │ • Vector SVG / Print export│
└────────────────────────────┘  └──────────────────────────┘  └────────────────────────────┘
```

### Visual Design & Anti-Clutter Principles
- **Clean Strip Canvas Contract**: Inside the Stage 2 ESWA 3D CAD canvas and Stage 6 A3 strip diagram, intrusive floating badges, overlapping multi-line joint callout boxes, and decorative telemetry clutter are eliminated. Joint traces render as crisp structural polylines with compact, non-overlapping dip/strike ticks (`J1 65°/140°`) and user-positioned text annotations.
- **Unlogged Gap Visualization**: Missing RD/depth intervals between logged rounds render as clean, uncoloured intervals bounded by dashed horizontal/vertical chainage lines (`stroke-dasharray="6,4"`) with a subtle centered annotation (`UNLOGGED INTERVAL: RD 120.0m – 125.0m`) so spatial scale is 100% preserved.
- **Tabular Engineering Numerals**: All chainage/depth readouts, dip/dip-direction angles, FEM displacements ($u_{max}$ in $\text{mm}$), plastic radii ($R_p$ in $\text{m}$), and Factors of Safety ($FoS$) enforce `tabular-nums` (`font-mono`) for vertical alignment across tables and longitudinal charts.

---

## 3. Key Product Decisions & Trade-Offs

### Decision 1: Live Bidirectional State Across All 6 Stages
- **Chosen Approach**: Edits performed in **Stage 2 (ESWA 3D CAD)**—such as merging two joint segments across adjacent rounds, extending a joint trace with the Expand tool, deleting an artifact trace, or editing text annotations—immediately update the shared `ContinuousTunnelStripDataset` state consumed by **Stage 3 (3D Joint Inspection)**, **Stage 4 (Continuous FEM/DEM)**, **Stage 5 (Advanced Analysis)**, and **Stage 6 (A3 Report)**.
- **Why**: Guarantees a single source of truth so engineers never see stale traces when moving from CAD editing to 3D kinematic inspection or final A3 printing.

### Decision 2: Geometry-Aware Unfolding for Tunnel vs. Vertical Shaft
- **Chosen Approach**:
  - **Tunnel Mode**: Unfolds the arch perimeter into `Left Wall | Crown | Right Wall` along horizontal chainage (`From RD` $\rightarrow$ `To RD`), while respecting Top Heading vs. Benching excavation masks.
  - **Vertical Shaft Mode**: Unfolds the circular ($360^\circ$) or half-circle ($180^\circ$ with median wall) shaft perimeter into compass quadrants (`1. NE 0°–90° | 2. ES 90°–180° | 3. SW 180°–270° | 4. WN 270°–360°`) progressing downward by depth (`From Depth` $\rightarrow$ `To Depth`).
- **Why**: Preserves exact azimuthal orientation and spatial continuity for both horizontal drives and vertical shafts without distorting joint intersections.

### Decision 3: Dedicated "Expand / Extend Joint" CAD Tool Alongside Move & Merge
- **Chosen Approach**: Add a dedicated **Expand Joint (`expand_joint`)** tool in Stage 2 ESWA CAD that lets the user drag either endpoint of a joint trace or extrapolate it across adjacent pull boundaries along its true dip/strike trajectory, complementing **Move Joint**, **Merge Joints**, **Edit Text**, and **Delete**.
- **Why**: In continuous strip logging, a major discontinuity mapped in Round $N$ often projects into Round $N+1$; allowing direct endpoint expansion and cross-pull merging makes continuous structural correlation fast and accurate.

---

## 4. Technical Architecture & Data Strategy

```
┌───────────────────────────────────────────────────────────────────────────────────┐
│                 Underground Face Mapping Saved Projects & Rounds                  │
│   • Excavation Mode: 'TUNNEL' | 'SHAFT' (Full Circle / Half-Circle + Median)      │
│   • Per-Round Pull: { fromRd, toRd, joints, lithology, Q, RMR, GSI, support, H }  │
└─────────────────────────────────────────┬─────────────────────────────────────────┘
                                          │
                                          ▼
┌───────────────────────────────────────────────────────────────────────────────────┐
│          Continuous 3D Strip Synchronization & Gap Detection Engine               │
│   • Filters by Mode (Tunnel vs Shaft) -> Project -> Location -> [From RD, To RD]  │
│   • Sorts rounds by RD/Depth and detects unlogged intervals                       │
│   • Emits MAPPED pulls + MISSING_GAP intervals (true-scale blank intervals)       │
│   • Reconstructs 2D unfolded coordinates & 3D spatial joint planes                │
└─────────────────────────────────────────┬─────────────────────────────────────────┘
                                          │
        ┌─────────────────────────────────┼─────────────────────────────────┐
        ▼                                 ▼                                 ▼
┌───────────────────────┐     ┌───────────────────────┐     ┌───────────────────────┐
│ Stage 2: ESWA 3D CAD  │     │ Stage 3: 3D Inspector │     │ Stages 4 & 5: Continuous│
│ • Clean 2D/3D Canvas  │     │ • 3D Tunnel / Shaft   │     │ FEM/DEM & Adv Geotech │
│ • Move / Merge /      │────>│   Mesh + Joint Planes │────>│ • Per-round & full-   │
│   Expand / Delete /   │     │ • Precision Plane     │     │   length Before vs    │
│   Edit Text & Strike  │     │   & Wedge Inspector   │     │   After Support solver│
└───────────┬───────────┘     └───────────┬───────────┘     └───────────┬───────────┘
            │                             │                             │
            └─────────────────────────────┼─────────────────────────────┘
                                          ▼
┌───────────────────────────────────────────────────────────────────────────────────┐
│                   Stage 6: Final A3 Landscape Engineering Report                  │
│   • Renders Clean Edited Strip Log + Dashed Blank Gaps + 3D Projection            │
│   • Includes Continuous FEM/DEM Support Verification & Rock Mass Summary Table    │
└───────────────────────────────────────────────────────────────────────────────────┘
```

### Core Engineering Modules in Execution Phase
1. **Stage 1 Setup & Range Sync**:
   - Mode switcher (`Tunnel` vs. `Vertical Shaft`) that filters available projects/locations and displays a visual pull coverage timeline highlighting mapped rounds (`MAPPED`) and unlogged gaps (`MISSING_GAP`) between the chosen `From RD` and `To RD`.
2. **Stage 2 Clean ESWA 3D CAD Strip Editor**:
   - Decluttered 2D unfolded strip log and synchronized 3D preview supporting both Tunnel (`Left Wall | Crown | Right Wall`) and Vertical Shaft (`NE | ES | SW | WN` or Half-Circle + Median Wall).
   - Interactive CAD toolset: **Select**, **Draw Joint**, **Move Joint**, **Expand / Extend Joint** (endpoint drag & cross-pull projection), **Merge Joints**, **Edit Dip/Strike**, **Edit Text / Annotation**, and **Delete**.
   - True-scale blank rendering for `MISSING_GAP` intervals with dashed RD/depth boundary lines.
3. **Stage 3 Complete 3D Analysis & High-Precision Joint Inspector**:
   - Interactive Three.js 3D viewport rendering the full chainage/depth excavation geometry, lithology zones, and true 3D dipping joint discs/planes slicing the excavation perimeter.
   - High-precision Joint Inspection Drawer displaying selected joint true dip/dip-direction, strike hinge, persistence length across pulls, JRC/JCS roughness, aperture/filling, and 3D tetrahedral wedge kinematics ($FoS$, sliding vector, block volume).
4. **Stage 4 Continuous Full-Length FEM / DEM Analysis (Before & After Support)**:
   - Continuous analytical/numerical elasto-plastic FEM & discrete-element DEM solver evaluating every mapped pull along the selected chainage/depth using each round's rock mass properties ($Q$, RMR, GSI, $\sigma_{ci}$, $m_i$, $D$, overburden $H$) and installed support (bolt length/spacing, shotcrete thickness, steel sets/curb ring).
   - Dual-view visualization:
     - **Longitudinal Profile View**: Full-length chainage/depth plots comparing **Before Support (Unreinforced)** vs. **After Support (Reinforced)** crown/wall displacement ($u_{max}$), plastic zone radius ($R_p$), support pressure vs. capacity, and Factor of Safety ($FoS$).
     - **Per-Round Cross-Section Slice View**: Interactive 2D/3D FEM/DEM contour and block-stability cross-section for any clicked pull along the profile (adapting accurately to Tunnel arch/heading/bench or Shaft circular/half-circle geometry).
5. **Stage 5 Continuous Advanced Geotechnical Analysis**:
   - Multi-round longitudinal profile of Barton $Q$, Bieniawski RMR89, and Hoek-Brown GSI, kinematic wedge mobilization risk along chainage/depth, stand-up time vs. unsupported span envelope, groundwater inflow estimation, and look-ahead/sink-ahead hazard forecast.
6. **Stage 6 Final A3 Continuous Engineering Report**:
   - ISO A3 landscape report uniting the edited CAD strip log, dashed blank unlogged intervals, 3D structural block diagram, continuous FEM/DEM Before/After verification table, and rock mass classification schedule with vector SVG and print/PDF export.
