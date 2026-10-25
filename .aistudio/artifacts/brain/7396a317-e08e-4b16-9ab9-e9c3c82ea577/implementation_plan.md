# Underground Shaft Face Mapping, Instrumentation & Monitoring, and Forward Probe Hole Drilling

Comprehensive architectural implementation plan to integrate vertical shaft sink bottom mapping, geotechnical instrumentation telemetry (convergence, MPBX, load cells, TARP alerts), and forward probe hole drilling logs (water inflow, gas, void detection, pre-grouting clearance) into the ESWA underground face mapping workflow.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> Please review the workflow integration model and recommended defaults before code execution begins:
> 
> 1. **Excavation Mode Selection (Horizontal Drift vs. Vertical Shaft Sink)**:
>    - *Recommended Default*: Unified workspace profile switcher allowing instant toggle between **Horizontal Drift/Stope** (D-arch, Horseshoe, Flat back) and **Vertical Shaft Sink** (Circular shaft bottom with polar plumb-line grid, radial sectors, depth below collar).
> 
> 2. **Working Window Expansion in Top Header**:
>    - *Recommended Default*: Elevate **Instrumentation & Monitoring** and **Probe Hole Drilling** as dedicated top-header working windows alongside `Face Canvas`, `Grades & Dilution`, `Channel Assays`, `Structural Geology`, `Geotech Stability`, and `Mine Exports`.
> 
> 3. **Forward Probe Drilling Clearance & Hazard Thresholds**:
>    - *Recommended Default*: Integrated trigger action response plans (TARP) where forward probe water inflows (>50 L/min) or void detections trigger an amber/red warning requiring mandatory pre-grouting clearance prior to blasting advance.

---

### 1. Overview & Core Concept

- **What It Delivers**:
  1. **Vertical Shaft Face Mapping**: Interactive circular/rectangular shaft sink bottom CAD mapping with polar coordinate grid (radius $r$, azimuth $\theta$), laser plumb-line datums (Center, North, East), radial sector water seepage tracking, and sink depth below collar (m).
  2. **Geotechnical Instrumentation & Monitoring**: Comprehensive monitoring console for underground convergence pins (crown-invert and sidewall-sidewall displacement), multi-point borehole extensometers (MPBX rock mass dilation), load cells, vibrating wire piezometers, interactive time-displacement velocity curves ($\text{mm/day}$), and 3-tier TARP alert levels.
  3. **Forward Probe Hole Drilling Log**: Ahead-of-face exploratory drilling pattern (center advance, crown probe, perimeter look-out holes) logging drilling penetration rates, high-pressure water inflow ($L/\text{min}$, bar), hazardous gas detection ($CH_4, H_2S$), void/cavity warnings, and blast round excavation clearance certificates.

- **Target Persona**: Underground Senior Mine Geologists, Geotechnical & Rock Engineering Superintendents, Shaft Sinking Engineers, and Mine Safety Inspectors.
- **Key Value**: Closes the critical safety loop between geological mapping, proactive advance hazard detection (probe holes), and empirical rock mass behavior (instrumentation convergence), eliminating surprise water inrushes and catastrophic ground collapse.

---

### 2. User Experience & Visual Design

#### A. Key User Flows

1. **Shaft Face Mapping Flow**:
   - In **Face Setup** or via a top profile switcher, the user selects **Vertical Shaft Sink**.
   - The canvas transforms from a lateral tunnel section to a **circular shaft sink bottom** with polar degree markings ($0^\circ$ North to $360^\circ$), concentric radial rings (1m, 2m, 3m radius), center plumb point, and collar depth (e.g., `-482.5m Below Collar`).
   - The user drafts geological lithologies, ore veins, faults, and water inflow seepages using Pencil, SPL, Polyline, and Eraser tools calibrated to polar coordinates.
   - Shaft curb ring lining and advance pull per blast are calculated and displayed.

2. **Instrumentation & Monitoring Working Window Flow**:
   - The user clicks **Instrumentation & Monitoring** in the top header.
   - The dedicated console displays 4 real-time instrument stations (Convergence Station CV-04, Extensometer MPBX-02, Piezometer VWP-01, Rockbolt Load Cell LC-03).
   - An interactive time-series displacement graph plots measured deformation ($\text{mm}$) against days since excavation, calculating current deformation velocity ($\text{mm/day}$).
   - If velocity exceeds the alert threshold ($>1.5\text{ mm/day}$ or $>15\text{ mm}$ total), the system automatically updates the TARP status to **LEVEL 2: AMBER ALERT** and displays required ground support rehabilitation measures.
   - Users can add new instrument readouts, set baseline dates, and record physical sensor observations.

3. **Forward Probe Hole Drilling Working Window Flow**:
   - The user clicks **Probe Hole Drilling** in the top header.
   - A visual 2D pattern elevation shows the probe hole layout fanning out ahead of the active face (Center lead hole at $+0^\circ$, Crown lookout hole at $+15^\circ$, Left/Right wing holes at $\pm12^\circ$).
   - A comprehensive interactive drill log records: Hole ID, Azimuth, Dip, Drilled Length (e.g. 24m ahead), Penetration Rate ($\text{m/hr}$), Water Inflow ($L/\text{min}$), Water Pressure ($\text{kPa}$), Gas readings, Void detection (Yes/No), and Lithological contact depths.
   - The **Excavation Clearance Verdict** updates dynamically: If water is $<15\text{ L/min}$ and no voids are hit, status reads `CLEAR TO BLAST ROUND (3.2m ADVANCE)`. If high-pressure inflow is intercepted, status triggers `MANDATORY CEMENTITIOUS PRE-GROUTING REQUIRED`.

#### B. Visual Identity & Theme

- **Color Discipline (60-30-10)**:
  - *60% Deep Obsidian Field*: `#020617` / `#070B18` matching ESWA mining dark theme.
  - *30% Structural Panels & Hairline Grids*: Slate-900 panels (`#0F172A`), hairline borders (`#1E293B`), polar coordinate lines (`#334155`).
  - *10% Precision Accents*:
    - Telemetry Amber (`#F59E0B`) for active working window tabs & geotechnical ratings.
    - Laser Cyan (`#06B6D4`) for probe hole drill strings and hydrogeological inflows.
    - Emerald (`#10B981`) for stable TARP status & clearance certificates.
    - Rose / Crimson (`#EF4444`) for high-pressure water inrushes, void alerts, and TARP Level 3 triggers.
- **Typography & Precision Notation**:
  - Technical font pairing with `Plus Jakarta Sans` for clean titles and `JetBrains Mono` / `font-mono tabular-nums` for all sensor telemetry, depth coordinates, drill intervals, and displacement values.
  - Strict unit separation: e.g. `24.5 mm` displacement, `68.2 L/min` inflow, `4.2 m` diameter.

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: Shaft Sink Integration Model (Unified Face Canvas vs. Separate Applet)**:
  - *Chosen Approach*: Seamlessly integrate shaft profiles into the primary Face Mapping Canvas via an excavation profile selector (`HORIZONTAL_DRIFT` vs `VERTICAL_SHAFT_SINK`).
  - *Why*: Eliminates fragmented state, reuses all battle-tested CAD vector tools (Pencil, SPL, Polyline, Eraser, Undo/Redo), and preserves the export pipeline.
  - *Alternatives Considered*: Building a disconnected standalone shaft workspace was rejected because it duplicates geometry engines and fragments project storage.

- **Decision 2: Top Header Navigation with Segmented Working Windows**:
  - *Chosen Approach*: Add `Shaft Face`, `Monitoring`, and `Probe Holes` to the existing top-header segmented working window bar, with responsive scroll and active badges.
  - *Why*: Direct 1-click access empowers the geologist to jump between mapping the face, checking convergence velocity, and reviewing forward probe clearance without multi-level modal nesting.

- **Decision 3: Forward Probe Safety Grouting Logic**:
  - *Chosen Approach*: Implement automatic safety threshold calculations based on standard mining codes: probe holes must maintain a minimum safety barrier (lead distance $\ge 5\text{m}$) ahead of the planned blast pull. If water exceeds $50\text{ L/min}$, blasting is interlocked until pressure-grouting confirmation is logged.
  - *Why*: Adheres to global underground mine safety standards (US MSHA, Western Australia DMIRS, South African Mine Health and Safety Act).

---

### 4. Technical Architecture & Data Strategy

#### A. Architecture & Component Hierarchy

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 MINING TOP HEADER BAR                                  │
│  [Main Window] · Drift/Shaft ID · Level · Depth · [WORKING WINDOW TABS] · [Vault/Save] │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
        ┌───────────────────────────────────┼────────────────────────────────────┐
        ▼                                   ▼                                    ▼
┌───────────────────────┐       ┌───────────────────────┐        ┌───────────────────────┐
│     FACE CANVAS       │       │   INSTRUMENTATION &   │        │      PROBE HOLE       │
│  (Drift vs. Shaft)    │       │      MONITORING       │        │        DRILLING       │
├───────────────────────┤       ├───────────────────────┤        ├───────────────────────┤
│ • D-Arch/Shanty/DXF   │       │ • Convergence Pins    │        │ • Ahead-of-Face 2D    │
│ • Polar Shaft Sink    │       │ • MPBX Boreholes      │        │   Fan Pattern View    │
│ • Laser Plumb Datums  │       │ • Displacement Graph  │        │ • Forward Drill Log   │
│ • Pencil, SPL, Poly   │       │ • Velocity (mm/day)   │        │ • Water & Gas Inflow  │
│ • Radial Water Seeps  │       │ • TARP Alert Triggers │        │ • Grouting Clearance  │
└───────────────────────┘       └───────────────────────┘        └───────────────────────┘
        │                                   │                                    │
        └───────────────────────────────────┼────────────────────────────────────┘
                                            ▼
                    ┌───────────────────────────────────────────────┐
                    │          MINING STORAGE & DATA ENGINE         │
                    │ • LocalStorage & IndexedDB Vault Storage      │
                    │ • 3D DXF Exporter (Shaft + Probes + Face)     │
                    │ • CSV Lab Exporter & PDF Printable Face Sheet │
                    └───────────────────────────────────────────────┘
```

#### B. Data Model Extensions (`src/types/mining.ts`)

```typescript
// Shaft Sink Definition
export interface MiningShaftSinkProfile {
  shaftDiameterM: number;
  depthBelowCollarM: number;
  shaftCenterCoordinates: { easting: number; northing: number };
  plumbLineOffsets: {
    centerPlumb: { x: number; y: number };
    northPlumb: { x: number; y: number };
    eastPlumb: { x: number; y: number };
  };
  liningRingNumber: number;
  curbRingDistanceToFaceM: number;
  totalWaterInflowLpm: number;
}

// Instrumentation & Convergence Monitoring
export interface GeotechInstrumentationStation {
  id: string;
  stationName: string;
  type: 'CONVERGENCE_PINS' | 'MPBX' | 'PIEZOMETER_VWP' | 'LOAD_CELL';
  chainageOrDepth: string;
  installationDate: string;
  baselineReadingMm: number;
  currentReadingMm: number;
  totalDisplacementMm: number;
  velocityMmPerDay: number;
  warningThresholdMm: number;
  criticalThresholdMm: number;
  tarpLevel: 'NORMAL' | 'AMBER_ALERT' | 'RED_EVACUATE';
  readingsHistory: { timestamp: string; readingMm: number; velocity: number }[];
  installedGroundSupport: string;
}

// Forward Probe Hole Drilling Log
export interface ForwardProbeHoleRecord {
  id: string;
  holeNumber: string;
  collarElevationM: number;
  plannedLengthM: number;
  drilledLengthM: number;
  azimuthDeg: number;
  dipDeg: number;
  holePurpose: 'WATER_CHECK' | 'GAS_CHECK' | 'GEOTECH_PILOT' | 'GROUT_PROBE';
  penetrationRateMPerHr: number;
  waterInflowLpm: number;
  waterPressureBar: number;
  gasDetected: { ch4Pct: number; h2sPpm: number; coPpm: number };
  cavityOrVoidEncountered: boolean;
  voidInterval?: { fromM: number; toM: number };
  geologicalContactNotes: string;
  clearanceStatus: 'CLEAR_TO_ADVANCE' | 'RESTRICTED_ADVANCE' | 'MANDATORY_PREGROUTING';
}
```

#### C. New & Updated Component Modules

1. `src/components/mining/MiningShaftCanvas.tsx`: Polar coordinate rendering engine for circular shaft sink mapping with radial degree ticks, concentric circles, plumb datums, and sector classification.
2. `src/components/mining/MiningInstrumentationWindow.tsx`: Dedicated geotechnical monitoring workbench with interactive deformation velocity graphs, sensor logs, and TARP status management.
3. `src/components/mining/MiningProbeDrillingWindow.tsx`: Dedicated forward probe drilling workbench with fan pattern cross-section, penetration logs, inflow gauges, and advance clearance certificates.
4. `src/components/mining/MiningMappingWorkspace.tsx`: Top header navigation integration with new working window tabs, state synchronization, and profile switching.
5. `src/engine/miningFaceEngine.ts`: Shaft polygon calculation and probe hole 3D DXF string generation.
