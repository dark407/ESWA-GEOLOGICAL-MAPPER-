# Implementation Plan: NATM Probe Hole Drilling & Grouting Modules

## 1. Overview & Objectives
In conventional underground excavation and NATM (New Austrian Tunnelling Method), forward exploration and ground treatment are critical safety and engineering gates before advancing into unknown ground.

Based on your design choices, this plan adds **Probe Hole Drilling** and **Grouting** directly after **Tunnel Monitoring & Instrumentation** on the NATM Main Window:
1. **One row layout** housing two dedicated cards:
   - **Probe Hole Drilling**: Forward probing, penetration logs, face collar positioning, and look-ahead hazard analysis.
   - **Grouting**: Pre-excavation umbrella & consolidation rings, injection pressure/volume logging, Lugeon permeability tests, and GIN curves.
2. **Dedicated Separate Windows / Workspaces** for Probe Hole Drilling and Grouting, ensuring focused workflows without clutter.
3. **Dual Execution Mode**: Both Simple (quick field entries) and Advanced Analysis (interactive canvas, MWD energy curves, 3D fan look-ahead, Lugeon/GIN graphs, and PDF reports).
4. **Universal Edition Availability**: Fully accessible on both **User** and **Master** editions across **Android APK** and **Windows Desktop EXE**.

---

## 2. Proposed Architecture & Component Design

### 2.1 NATM Main Window Entry Points (`src/components/screens/WelcomeScreen.tsx` & `src/App.tsx`)
Directly after Item #3 (`Tunnel Monitoring & Instrumentation`), add a balanced side-by-side row containing two interactive cards:
- **Card A: Probe Hole Drilling (Forward Geotechnical Exploration)**
  - Icon: Drill / Borehole compass (`Crosshair` / `Compass` / `Milestone`)
  - Subtitle: *Forward probing, penetration rate, water inflow & look-ahead hazard prediction*
  - Action buttons: `Open` (Fresh setup/logging) and `Resume` (Active probe hole session)
- **Card B: Grouting & Ground Treatment (Pre-Excavation & Consolidation)**
  - Icon: Pressure / Grout fluid injector (`ShieldCheck` / `Layers` / `Activity`)
  - Subtitle: *Umbrella pipe arch, radial consolidation, Lugeon water test & GIN analysis*
  - Action buttons: `Open` (Fresh round setup) and `Resume` (Active grout take log)

Both buttons open their respective full-screen modal workspaces with complete offline persistence.

---

### 2.2 Probe Hole Drilling Workspace Modal (`src/components/ProbeHoleDrillingModal.tsx`)
A responsive, high-contrast geotechnical modal containing two distinct operational modes:

#### A. Simple & Effective Field Logging Mode
- **Quick Probe Hole Metadata**: Hole ID (e.g., `PH-01-Face-Center`), Face Station/Chainage, Collar Location $(X, Y)$ on face, Target Length (e.g., 25.0 m), Drilling Azimuth & Dip Angle.
- **Run Interval Data Grid**:
  - Depth From – To (m)
  - Rate of Penetration (ROP in m/min or min/m)
  - Drilling Feed Pressure (bar) & Flush Return Color/Turbidity
  - Water Inflow (L/min) with sudden ingress warning badge
  - Estimated RQD (%) & Rock Mass Class ahead of tunnel face
  - Cavity / Fault Encounter Log (depth, gap thickness, clay gouge description)
- **Immediate Look-Ahead Safety Indicator**: Green (Dry/Competent), Amber (Moderate Inflow/Fracturing), Red (Hazard Alert: High pressure water or cavity ahead).

#### B. Advanced Geotechnical & MWD Analysis Mode
- **Interactive Tunnel Face Collar Layout Canvas**:
  - Live 2D Tunnel Cross-Section showing collar points (Face Center, Crown Arch, Left Invert, Right Invert) with live mouse/touch repositioning.
  - Hole trajectory projection ahead of face (Plan view and Longitudinal cross-section).
- **MWD Specific Energy Profile vs. Depth**:
  - Real-time chart displaying Drilling Specific Energy (DSE in $\text{MJ/m}^3$) calculated from feed force, torque, ROP, and hole diameter.
  - Sudden drops highlight open joints, clay seams, or karstic cavities.
- **3D Look-Ahead Probe Fan Projection**:
  - 3D perspective visualization projecting the probe holes $15\text{m} - 30\text{m}$ beyond the active excavation face, showing overlap with the planned tunnel design profile.
- **Hazard Zone Predictor**:
  - Auto-calculated safe excavation distance ahead of current face before mandatory re-probing.

---

### 2.3 Grouting & Ground Treatment Workspace Modal (`src/components/GroutingAnalysisModal.tsx`)
A dedicated engineering modal equipped with:

#### A. Grout Hole Pattern & Layout
- **Grouting Type Selection**:
  - *Pre-Excavation Forepoling / Umbrella Grout Curtain* (ahead of face)
  - *Radial Consolidation / Annular Rock Mass Grouting* (surrounding perimeter)
  - *Water Ingress Cutoff Grouting* (localized fissures)
- **Interactive Ring Layout**: Fan of holes numbered #1 to #N with individual dip, collaring offset, and length.

#### B. Hole-by-Hole Injection Logging
- Real-time tabular logger for each hole:
  - Mix Ratio: Water-to-Cement ($W:C$ by weight: 0.5:1, 0.7:1, 1:1, etc.) or Microfine / Chemical / Polyurethane resin
  - Injection Stage / Depth interval (m)
  - Gauge Pressure ($P$ in bar) & Target Refusal Pressure
  - Grout Take ($Q$ in Liters or Bags of Cement)
  - Refusal Status: Target pressure reached, volume limit reached, or surface leakage detected

#### C. Lugeon Water Pressure Test & GIN Refusal Curves
- **Lugeon Test Calculator**: Automated calculation of Lugeon value ($1\text{ Lu} \approx 1\text{ L/min/m at } 10\text{ bar}$) with flow regime diagnosis (Laminar, Turbulent, Dilation, Washout, Void filling).
- **GIN (Grouting Intensity Number) Analysis**:
  - Dynamic $P \times V = \text{GIN}$ hyperbolic refusal curve plot.
  - Automatically flags over-grouting risk to prevent hydraulic fracturing of tunnel walls or arch.

#### D. Engineering Report & Data Storage
- High-resolution, multi-page printable engineering report containing ring diagrams, Lugeon tables, and GIN curves.
- Export as printable report and JSON/CSV backup stored in isolated NATM database storage.

---

### 2.4 Data Engine & Persistence (`src/engine/probeHoleAndGroutingEngine.ts`)
- TypeScript data models: `ProbeHoleRecord`, `ProbeRunInterval`, `GroutRingRecord`, `GroutHoleLog`, `LugeonTestRecord`.
- Offline storage routines syncing with `localStorage` and mode vault (`eswa_strict_vault_NATM`), preserving user drafts across app restarts and app updates.

---

## 3. Step-by-Step Implementation Strategy

1. **Step 1: Data Models & Geotechnical Calculators**
   - Create `/src/engine/probeHoleAndGroutingEngine.ts` with complete types, MWD specific energy formulas, Lugeon flow calculations, GIN hyperbolic curves, and sample datasets.
2. **Step 2: Probe Hole Drilling Component**
   - Build `/src/components/ProbeHoleDrillingModal.tsx` featuring Simple depth/water/ROP logging, interactive tunnel face canvas, MWD charts, and 3D look-ahead fan.
3. **Step 3: Grouting Component**
   - Build `/src/components/GroutingAnalysisModal.tsx` featuring Umbrella/Consolidation ring layouts, hole-by-hole injection records, Lugeon permeability tests, GIN curves, and printable report generator.
4. **Step 4: WelcomeScreen & App.tsx Integration**
   - In `/src/components/screens/WelcomeScreen.tsx`, render the side-by-side row for Probe Hole Drilling and Grouting directly after `Tunnel Monitoring & Instrumentation`.
   - Wire state, modal handlers, and keyboard/resume shortcuts in `/src/App.tsx`.
5. **Step 5: Multi-Platform Verification & Dual Installer Build**
   - Test compilation (`npm run build` / `tsc`).
   - Run verification tests to ensure flawless operation in both User and Master editions for Android APK and Windows Desktop.

---

## 4. Verification & Validation Plan
- **UI & Layout Verification**: Confirm that the NATM Main Window displays Probe Hole and Grouting side-by-side cleanly without breaking responsive constraints on mobile APK and desktop EXE.
- **Interactive Canvas Testing**: Test collar dragging on the tunnel face cross-section and trajectory rendering in probe fan view.
- **Geotechnical Calculation Accuracy**:
  - Verify MWD specific energy calculations ($E = \frac{F}{A} + \frac{2\pi \cdot N \cdot T}{A \cdot ROP}$).
  - Verify Lugeon calculation ($\text{Lu} = \frac{10 \cdot q}{p \cdot L}$).
  - Verify GIN curve limit checking ($P \cdot V \le \text{GIN}_{\text{target}}$).
- **Report & Print Validation**: Verify that the generated Grouting and Probe summary reports format cleanly for export/printing.
- **Build Verification**: Run `npm run build` to confirm zero lint/type errors.
