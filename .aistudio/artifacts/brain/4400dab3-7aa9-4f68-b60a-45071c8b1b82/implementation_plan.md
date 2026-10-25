# Isolated Underground Mining Suite: Professional Face Mapping, Core Logging & Data Storage

Comprehensive architectural blueprint to transform the ESWA Mining Window from a prototype into an enterprise-grade, fully working underground mining suite for all underground mine types (hardrock precious/base metals, coal, potash/salt, industrial minerals), strictly isolated from NATM civil tunnelling and TBM modules.

## User Review & Critical Decisions

> [!IMPORTANT]
> The clarifying answers provided have been integrated into this architecture:
> - **Stope & Face Shapes**: Support all standard mining shapes (D-arch, horseshoe, rectangular room-and-pillar, shanty, gothic) plus custom parametric geometry and DXF boundary import.
> - **Geological & Geotechnical Tools**: Vein/ore contacts, hanging wall/foot wall boundaries, channel sampling lines with assay grades, major fault/shear zones, individual joint traces, and Laubscher MRMR / Barton Q stope stability.
> - **Exports**: Mine planning 3D DXF (Surpac, Deswik, Datamine, Vulcan compatible), professional PDF A4/A3 Mining Face Sheet, and CSV channel sample assay logs.
> - **Strict Isolation**: Zero mutation of NATM or TBM state; dedicated `eswa_mining_*` storage namespace and isolated components.

- **Confirmed Decision 1**: Single-face canvas only. No crown arch or sidewall unfolding is rendered for mining stopes, removing NATM-specific group joint clustering and continuous strip log clutter.
- **Confirmed Decision 2**: Identical setup flow to underground civil mapping (Project $\rightarrow$ Level/Heading Location $\rightarrow$ Face Station/Chainage & Advance $\rightarrow$ Custom Stope Shape & Size $\rightarrow$ Field Digital Sketch vs Photogrammetry Orthophoto).

---

## 1. Overview & Core Concept

- **What It Does**: A complete, professional underground mine geology and grade control system. Geologists configure mine level, stope/drift IDs, and exact face profile geometry, then conduct face mapping in either direct digital field mode or calibrated photogrammetry mode. Tools feature vein boundary tracing with ore-grade classification, continuous channel/chip sampling lines with true-width calculations, fault slickenside mapping, Laubscher MRMR / Potvin Mathews stope stability evaluation, and instant mine-grade CAD/PDF/CSV exports.
- **Target Audience / Persona**: Production mine geologists, grade control geologists, underground geotechnical/rock mechanics engineers, and exploration geologists across all commodity types.
- **Key Value**: Replaces paper mapping sheets and disparate spreadsheets with a single, calibrated tablet/desktop workflow that outputs 3D DXF files directly compatible with Deswik, Surpac, Datamine, and Vulcan, while calculating stope stability and dilution in real time at the working face.

---

## 2. User Experience & Visual Design

### Key User Flows

```
┌────────────────────────────────────────────────────────────────────────┐
│                   MINING MAIN WINDOW (3 PILLARS)                       │
├──────────────────────────┬─────────────────────────┬───────────────────┤
│ 1. Underground Face Map  │ 2. Core Logging         │ 3. Data Storage   │
│    [New / Resume]        │    [New / Resume]       │    [Vault Modal]  │
└────────────┬─────────────┴─────────────────────────┴───────────────────┘
             │
             ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   MINING FACE SETUP WIZARD                             │
│  Step 1: Project & Mine Location (Level RL, Drift/Stope Heading ID)    │
│  Step 2: Face Station, Advance Pull (m) & Heading Azimuth              │
│  Step 3: Stope Shape & Size (D-Arch, Horseshoe, Rectangular, DXF)     │
│  Step 4: Mode Choice: [Field Digital Canvas] vs [Photogrammetry Photo] │
└────────────┬───────────────────────────────────────────────────────────┘
             │
             ▼
┌────────────────────────────────────────────────────────────────────────┐
│                 MINING FACE MAPPING WORKSPACE (FACE ONLY)              │
│  • Top Bar: Stope ID, Level RL, Pull Length, Mode Switcher            │
│  • Left Toolbar: Ore Veins, Contacts, Faults, Joints, Channel Samples  │
│  • Center Stage: Calibrated Stope Face Canvas with Metric Grid         │
│  • Right Inspector Tabs:                                               │
│    - Ore & Grade Control (Channel Assays, Dilution %, True Width)      │
│    - Discontinuities (Dip/DipDir, JRC, Infill, Water Inflow)           │
│    - Geotechnical Rating (Laubscher MRMR, Barton Q', Mathews N)       │
│    - Export Center (Surpac/Deswik DXF, PDF Face Sheet, CSV Assays)     │
└────────────────────────────────────────────────────────────────────────┘
```

### Visual Identity & Theme
- **Aesthetic Direction**: High-precision underground mine geology instrumentation; rugged, calibrated, high contrast.
- **Color Palette & Mood**: Deep mine obsidian (`#030712`) background with warm amber (`#F59E0B`), gold ore veins (`#EAB308`), massive sulfide copper (`#F97316`), waste rock slate (`#64748B`), and clean hairline dividers (`#1E293B`).
- **Typography & Hierarchy**: `Plus Jakarta Sans` for clean titles, `JetBrains Mono / font-mono tabular-nums` for coordinates, strike/dip angles, assay numbers, and channel widths.
- **Zero-Pill Discipline**: All face metadata (e.g. `Level -450m RL · Stope 402-N · Advance 3.2m · Face 142.5m`) rendered as unboxed inline typography with `·` dividers.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Strict Single-Face Focus**:
  - *Chosen Approach*: Underground mining face mapping canvas renders exclusively the excavated face perimeter (no crown or sidewalls).
  - *Why*: In mining stoping and drift development, geologists map the newly blasted face at every cut for grade control and blast optimization. Sidewalls are covered in shotcrete or mesh, and crown unfolding belongs to civil tunnel strip logs.
- **Decision 2: Channel Sampling with Automatic True-Width Geometry**:
  - *Chosen Approach*: Geologists drag a channel line across the face; the engine auto-segments it across mapped vein boundaries and calculates true thickness based on vein dip and strike.
  - *Why*: Eliminates manual trigonometry errors during underground shift sampling; feeds direct grade composites into CSV/database.
- **Decision 3: Complete Isolation Architecture**:
  - *Chosen Approach*: Isolated state management with `eswa_mining_*` keys and independent React modules under `src/components/mining/` and `src/engine/miningFaceEngine.ts`.
  - *Why*: Ensures zero regressions in NATM or TBM features while allowing mining-specific workflows to evolve freely.

---

## 4. Technical Architecture & Data Strategy

### System Component Diagram

```
┌──────────────────────────────────────────────────────────────────────────┐
│                             App.tsx                                      │
│         (Routes to MiningMainWindow when industryMode === 'MINING')      │
└────────────────────────────────────┬─────────────────────────────────────┘
                                     │
                                     ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                         MiningMainWindow.tsx                             │
│  ┌───────────────────────┬───────────────────────┬────────────────────┐  │
│  │ 1. Face Mapping       │ 2. Core Logging       │ 3. Data Storage    │  │
│  │    (Triggers Wizard)  │    (Core Workspace)   │    (Vault Modal)   │  │
│  └───────────────────────┴───────────────────────┴────────────────────┘  │
└──────────────────┬───────────────────────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                      MiningFaceSetupWizard.tsx                           │
│  • Project / Level / Stope Heading selector                              │
│  • Parametric Stope Geometries & DXF parser                              │
│  • Field Canvas vs Photogrammetry Router                                 │
└──────────────────┬───────────────────────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                     MiningFaceMappingWorkspace.tsx                       │
│  ┌───────────────────────────────┬────────────────────────────────────┐  │
│  │ MiningFaceCanvas.tsx          │ MiningFaceSidebar.tsx              │  │
│  │ • Stope Face Outline (Only)   │ • Vein/Ore Grade Control Tab       │  │
│  │ • Vein & Lithology Polygons   │ • Discontinuity & Structure Tab    │  │
│  │ • Major Fault / Shear Lines   │ • Laubscher MRMR & Mathews Graph   │  │
│  │ • Channel Sample Lines (1..n) │ • CAD & PDF Export Generator       │  │
│  └───────────────────────────────┴────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────┘
```

### Data Entities & Schema (`src/types/mining.ts`)

```typescript
export interface MiningStopeDefinition {
  id: string;
  projectId: string;
  levelName: string; // e.g., "Level -450m RL" or "1200L"
  stopeId: string; // e.g., "Stope 402-N" or "XC-14 East"
  faceChainageM: number; // e.g., 142.50
  blastPullLengthM: number; // e.g., 3.20
  headingAzimuthDeg: number; // e.g., 045
  profileShape: 'd_arch' | 'horseshoe' | 'rectangular' | 'shanty' | 'gothic' | 'custom_dxf';
  widthM: number;
  heightM: number;
  wallHeightM: number;
  crownRadiusM: number;
  customProfileDxf?: string;
  crossSectionPoints: Array<{ x: number; y: number }>;
}

export interface MiningFaceMapRecord {
  id: string;
  stopeId: string;
  mappingType: 'FIELD' | 'PHOTOGRAMMETRY';
  mappedAt: string;
  geologistName: string;
  veins: MiningVeinRecord[];
  structures: MiningStructureRecord[];
  channelSamples: MiningChannelSampleLine[];
  mrmrRating: MiningMrmrRating;
  mathewsStability: MathewsStabilityIndex;
}
```

### Verification & Delivery Plan
1. **Lint & Build Verification**: `npm run lint` (`tsc --noEmit`) and `compile_applet`.
2. **Setup Flow Test**: Verify step-by-step wizard transitions (Project $\rightarrow$ Location $\rightarrow$ Profile $\rightarrow$ Mode).
3. **Canvas Drawing & Geometry Test**: Verify face boundary clipping, vein polygons, and channel sample true-width calculations.
4. **Export Validation**: Verify DXF file syntax for CAD software and PDF sheet generation.
