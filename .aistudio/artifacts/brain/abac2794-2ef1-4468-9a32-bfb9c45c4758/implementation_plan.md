# Vertical Shaft Face Mapping, Quadrant Wall & Half-Face Excavation Architecture Plan

## 1. Architectural Overview & Strict Tunnel Isolation
To guarantee **100% isolation** from the completed Horizontal Tunnel mode (`undergroundSubMode !== 'vertical_shaft'`), all Vertical Shaft geometry, circumference/quadrant calculations, Half-Face excavation boundary rules, 3D vertical cylinder coordinates, and FEM/DEM boundary conditions will be encapsulated inside `/src/engine/verticalShaftEngine.ts` and invoked strictly when `isVerticalShaftLocation(activeLocation)` is true. Horizontal Tunnel mode files and logic remain untouched.

---

## 2. Core Data Model & Excavation Geometry Rules

### A. Circular Circumference & 4 Quadrant Walls (No Crown)
For a Vertical Shaft of diameter $D$ (`location.widthM`), the total circular circumference is $C = \pi \times D$, divided into four $90^\circ$ compass quadrants of equal arc length $L_{\text{quad}} = \frac{\pi \times D}{4}$ and vertical pull depth $H_{\text{pull}} = \text{pullLengthMeters}$:

1. **Quadrant 1 (`left_wall` slot)**: **`NORTH-EAST (0°–90°)`** (`NE 0°–90°`) — Wall normal inward toward $225^\circ$ (SW), dip $90^\circ$.
2. **Quadrant 2 (`crown` slot)**: **`EAST-SOUTH (90°–180°)`** (`ES 90°–180°`) — Wall normal inward toward $315^\circ$ (NW), dip $90^\circ$. *(Never labeled or treated as Crown in Vertical Shaft mode).*
3. **Quadrant 3 (`right_wall` slot)**: **`SOUTH-WEST (180°–270°)`** (`SW 180°–270°`) — Wall normal inward toward $045^\circ$ (NE), dip $90^\circ$.
4. **Quadrant 4 (`shaft_sn` slot)**: **`WEST-NORTH (270°–360°)`** (`WN 270°–360°`) — Wall normal inward toward $135^\circ$ (SE), dip $90^\circ$.
5. **Shaft Bottom Face (`face` slot)**: **`SHAFT FACE`** — Horizontal/inclined sinking floor of diameter $D$ (Full Face) or semi-circular D-section of area $\frac{\pi D^2}{8}$ (Half Face).

### B. Full Face vs. Half Face Excavation Configuration
In `FieldExcavationRound` (`/src/engine/fieldMappingEngine.ts`), we add two optional Vertical Shaft fields:
- `shaftHalfSide?: 'left_half' | 'right_half'` (default `'left_half'` when `excavationApproach === 'Half Face'`)
- `shaftCenterMedianStatus?: 'closed' | 'open'` (derived from whether the opposite half is `'unexcavated'` -> **Closed** rock median wall, or `'excavated'` -> **Open** median boundary)

| Excavation Approach | Active Face Geometry | Active Quadrant Wall Panels | Inactive Quadrant Wall Panels (Hidden in Tabs/Strip) | Center Median Line ($0^\circ\text{–}180^\circ$ N–S Diameter) |
| :--- | :--- | :--- | :--- | :--- |
| **Full Face** | Full Circle ($\pi D^2 / 4$, $0^\circ\text{–}360^\circ$) | **Q1** `NORTH-EAST (0°–90°)`<br>**Q2** `EAST-SOUTH (90°–180°)`<br>**Q3** `SOUTH-WEST (180°–270°)`<br>**Q4** `WEST-NORTH (270°–360°)` | None (All 4 active) | None (Full circular section) |
| **Half Face — Left Half** | Left Semi-Circle ($180^\circ\text{–}360^\circ$ West half) + Hatched Right Half | **Q3** `SOUTH-WEST (180°–270°)`<br>**Q4** `WEST-NORTH (270°–360°)` | **Q1** `NE (0°–90°)` & **Q2** `ES (90°–180°)` hidden | **Closed** if Right Half is Unexcavated (solid rock wall along center median); **Open** if Right Half is Excavated |
| **Half Face — Right Half** | Right Semi-Circle ($0^\circ\text{–}180^\circ$ East half) + Hatched Left Half | **Q1** `NORTH-EAST (0°–90°)`<br>**Q2** `EAST-SOUTH (90°–180°)` | **Q3** `SW (180°–270°)` & **Q4** `WN (270°–360°)` hidden | **Closed** if Left Half is Unexcavated (solid rock wall along center median); **Open** if Left Half is Excavated |

---

## 3. UI & Design Direction

### Aesthetic & Layout Continuity
- **Existing Engineering Workbench Consistency**: Retains the exact layout, control density, typography (`Inter` UI + `JetBrains Mono` for azimuths, arc lengths, and coordinates), and high-contrast scientific CAD styling of the Underground Tunnel Face Mapping workspace.
- **Round & Pull Setup (`FieldMappingModeWorkspace.tsx`)**:
  - When `Vertical Shaft` + `Half Face` is selected, a clean 2-column sub-panel appears directly inside the Round & Pull form:
    1. **Excavated Shaft Half**: Segmented toggle between **Left Half (`SW 180°–270° & WN 270°–360°`)** and **Right Half (`NE 0°–90° & ES 90°–180°`)**.
    2. **Opposite Half / Center Median Status**: Segmented toggle between **Opposite Half Unexcavated (`Center Median CLOSED`)** and **Opposite Half Excavated (`Center Median OPEN`)**, with a live schematic preview badge showing active quadrants, arc length ($\frac{\pi D}{2}$), and median boundary condition.
- **2D Face Canvas & Quadrant Wall Tabs**:
  - **Panel Selector Tabs**: Dynamically display `Face` + all 4 quadrants (`NE (0°–90°)`, `ES (90°–180°)`, `SW (180°–270°)`, `WN (270°–360°)`) in Full Face mode, or `Half Face` + only the 2 active quadrants in Half Face mode (automatically switching to `'face'` if the user was previously on an inactive quadrant tab).
  - **2D Face Canvas Overlay**:
    - Renders compass degree ticks (`0° N`, `90° E`, `180° S`, `270° W`) and quadrant boundary arcs (`NORTH-EAST 0°–90°`, `EAST-SOUTH 90°–180°`, `SOUTH-WEST 180°–270°`, `WEST-NORTH 270°–360°`) around the circular perimeter.
    - In **Half Face** mode, clips active drawing/mapping to the active semi-circle, renders diagonal geotechnical rock hatching over the unexcavated half (or a subtle excavated ghost outline if the opposite half is already excavated), and draws the vertical **Center Median Line ($0^\circ\text{ N} \leftrightarrow 180^\circ\text{ S}$)** with a clear engineering annotation: **`CENTER MEDIAN: CLOSED (UNEXCAVATED ROCK BOUNDARY)`** (solid structural boundary line) or **`CENTER MEDIAN: OPEN (OPPOSITE HALF EXCAVATED)`** (dashed free-span boundary line).
- **Strip Align / T-Canvas & 3D Folding Net**:
  - Displays the circular (or semi-circular) Shaft Face centered above the unfolded row of active Quadrant Wall strips (`NE 0°–90°`, `ES 90°–180°`, `SW 180°–270°`, `WN 270°–360°`), with each wall's width equal to $\text{PullM}$ and height equal to $\frac{\pi D}{4}$.
  - In the 3D Folding Net (`Field3DTunnelCanvas.tsx`), folds the active quadrant walls vertically around the circular/semi-circular shaft perimeter.

---

## 4. Downstream Engineering Calculations & 3D Viewports

### A. 3D Joint Inspector (`NatmJoint3DInspectorModal.tsx` & `/src/engine/joint3DInspectorEngine.ts`)
- **True Vertical Cylinder Geometry**:
  - When `tunnelGeometry.isVerticalShaft` is true, renders a vertical cylindrical shaft sinking downward along the vertical axis with compass-oriented quadrant walls (`0° N`, `90° E`, `180° S`, `270° W`).
  - When **Half Face** is active, renders the D-shaped half-cylinder (Left Half $180^\circ\text{–}360^\circ$ or Right Half $0^\circ\text{–}180^\circ$) and visualizes the Center Median plane as either a solid rock wall (Closed) or open span (Open).
- **Apparent Dip & Surface Intersections**:
  - Replaces horizontal tunnel `Left Wall / Right Wall / Crown` intersection labels and surface normals with the vertical shaft's **Shaft Face** and active **Quadrant Walls (`NE 0°–90°`, `ES 90°–180°`, `SW 180°–270°`, `WN 270°–360°`)** so 3D joint planes, trace lengths, and apparent dip tables are mathematically exact for a vertical shaft.

### B. FEM & DEM Advanced Analysis (`/src/engine/femDemAnalysisEngine.ts` & `FieldFemDemAnalysisStage.tsx`)
- **2D Cross-Section Mesh & Excavation Profile**:
  - **Full Face**: Circular shaft cross-section in horizontal plan view ($0^\circ\text{–}360^\circ$) subjected to horizontal in-situ stresses ($\sigma_{H}, \sigma_{h}$) and overburden depth $z$, with radial/tangential stress $(\sigma_r, \sigma_\theta)$ and displacement contours around all 4 quadrants.
  - **Half Face (Left Half or Right Half)**:
    - Generates a D-shaped semi-circular excavation boundary ($180^\circ\text{–}360^\circ$ for Left Half, $0^\circ\text{–}180^\circ$ for Right Half).
    - **Center Median Closed (Opposite Half Unexcavated)**: Models the straight N–S diameter wall ($x = 0$, length $D$) as an active rock-support boundary subject to stress concentration at the $0^\circ$ and $180^\circ$ corners and potential planar/wedge sliding into the excavated half.
    - **Center Median Open (Opposite Half Excavated)**: Models the full-span stress redistribution across the opened median with relaxed radial confinement on the median line and full-diameter equivalent radius $R_{\text{eq}} = D / 2$.
- **DEM Key-Block & Wedge Stability**:
  - Evaluates key blocks specifically on the active Vertical Shaft quadrants (`NE (0°–90°)`, `ES (90°–180°)`, `SW (180°–270°)`, `WN (270°–360°)`) plus the **Center Median Rock Wall** when `shaftCenterMedianStatus === 'closed'`, using vertical wall sliding/rotation kinematics instead of horizontal crown gravity-fall equations.

---

## 5. Planned File Changes
1. **`/src/engine/verticalShaftEngine.ts`**:
   - Add quadrant metadata constants (`NE 0°–90°`, `ES 90°–180°`, `SW 180°–270°`, `WN 270°–360°`), active panel filtering for Full Face vs. Left/Right Half Face, Center Median status helpers, vertical shaft 3D coordinate/normal calculators, and shaft-specific FEM/DEM boundary geometry helpers.
2. **`/src/engine/fieldMappingEngine.ts`**:
   - Add `shaftHalfSide?: 'left_half' | 'right_half'` and `shaftCenterMedianStatus?: 'closed' | 'open'` to `FieldExcavationRound` and update `getVerticalShaftSurfaceConfig` / outline generators to delegate to `verticalShaftEngine.ts`.
3. **`/src/components/FieldMappingModeWorkspace.tsx`**:
   - Add Half Face (`Left Half` / `Right Half`) and Center Median (`Closed - Opposite Unexcavated` / `Open - Opposite Excavated`) controls in Round & Pull when Vertical Shaft mode is active.
   - Update 2D Face Canvas, Quadrant Panel tabs, and Strip Align / T-Canvas labels & active panel filtering for `NORTH-EAST (0°–90°)`, `EAST-SOUTH (90°–180°)`, `SOUTH-WEST (180°–270°)`, and `WEST-NORTH (270°–360°)`.
4. **`/src/components/Field3DTunnelCanvas.tsx`**:
   - Update Vertical Shaft 3D folding net to fold active quadrants (`NE`, `ES`, `SW`, `WN`) and render Half-Face semi-circle + Center Median boundary when Half Face is selected.
5. **`/src/engine/joint3DInspectorEngine.ts` & `/src/components/NatmJoint3DInspectorModal.tsx`**:
   - Add Vertical Shaft 3D cylinder / D-section rendering, compass quadrant signage (`NE 0°–90°`, `ES 90°–180°`, `SW 180°–270°`, `WN 270°–360°`), and 5-surface intersection calculations when `isVerticalShaft` is active.
6. **`/src/engine/femDemAnalysisEngine.ts` & `/src/components/FieldFemDemAnalysisStage.tsx`**:
   - Add Vertical Shaft Full-Face circular and Half-Face semi-circular (Left/Right Half + Center Median Open/Closed) mesh generation, stress/displacement boundary conditions, and quadrant wall DEM key-block stability calculations.
