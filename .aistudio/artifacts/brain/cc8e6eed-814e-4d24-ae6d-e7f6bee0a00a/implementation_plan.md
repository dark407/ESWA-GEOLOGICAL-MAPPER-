# Multi-Band Alternate Lithology Engine & Canvas Band Plotting

Transform the alternate lithology workflow into a multi-layered geological banding system: establish a configurable **Main Base Lithology** that covers the excavation face background, and empower geologists to add and plot **unlimited secondary, tertiary, and quaternary lithology bands** with independent rock types, angles (-90° to +90°), and thicknesses (5px to 100px / 0.1m to 2.5m), placed directly on the face canvas via tap/click positioning.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The following product behaviors were confirmed during the Turn 1 interactive clarification:
> - **Main Base Structure**: The main lithology acts as the base background, with separate, distinct overlay bands plotted over it.
> - **Band Placement UX**: The geologist configures the rock type, angle, and thickness in the panel controls, then taps/clicks on the face canvas to place the band precisely where desired.
> - **Band Capacity**: Unlimited bands with dynamic "+ Add Band" and delete controls, allowing secondary, tertiary, 4th, 5th, or any number of distinct lithology bands per round.

---

## 1. Overview & Core Concept

### 1.1 What It Delivers
In real-world tunneling and mining faces (e.g. interbedded flysch, turbidite sequences, quartz/pegmatite vein swarms, schist with quartzite intercalations), rock faces rarely consist of a single uniform rock or a single rigid alternating pair. 

This feature introduces a **Base & Layered Band Architecture**:
1. **Main Lithology Base**: The dominant rock mass (e.g. Quartzite, Granite, Sandstone) acts as the continuous backdrop.
2. **Dynamic Band Stack**: Users configure individual secondary/tertiary bands (e.g., Band 1: 15cm Mica Schist at -45°, Band 2: 40cm Quartz Vein at +30°, Band 3: 8cm Phyllite at 0°).
3. **Direct Canvas Plotting**: A dedicated "Plot Band on Canvas" mode allows tapping or dragging anywhere across the face canvas to anchor the band centerline, instantly rendering the band at its defined angle, thickness, and geological hatch pattern.
4. **Per-Band Customization**: Each band maintains its own rock code, angle (-90° to +90°), thickness slider, color, and hatch pattern.

---

## 2. User Experience & Visual Design

### 2.1 Workspace Control Panel (`FieldMappingModeWorkspace.tsx`)

Following the **Scientific Console & Telemetry Design Constitution** (dense technical layout, 60-30-10 palette with dark obsidian `#0F172A`, slate `#1E293B`, and laser cyan `#06B6D4` accents, with tabular numerals):

1. **Main Base Lithology Header**:
   - Prominently displays the active base rock (e.g., `BASE: Quartzite [Qtz]`) with rock color badge and pattern thumbnail.
   - Quick "Change Base Rock" dropdown/palette selector.
2. **Layered Lithology Bands Stack**:
   - Header with active band count (e.g., `3 Layered Bands`) and an "+ Add Lithology Band" button (`bg-cyan-500 text-slate-950 font-bold`).
   - Band card list with clear index badges (`#1`, `#2`, `#3`, ...).
   - Each band card provides:
     - **Rock Selector**: Compact chip grid or dropdown with quick search from the rock catalog.
     - **Angle Control**: Slider (-90° to +90°) with real-time rotating strata icon and quick presets (`-60°`, `-45°`, `-22° Nat`, `0° Flat`, `+30°`, `+45°`, `+60°`, `90° Vert`).
     - **Thickness Control**: Slider (5px to 100px) with numeric readout and presets (`Thin 10px`, `Med 25px`, `Wide 50px`, `Broad 80px`).
     - **Placement Action Button**: A high-visibility `"Tap on Canvas to Place"` toggle button (`cursor-crosshair`). When active, clicking on the face canvas places/anchors this band.
     - **Delete Band Button**: Compact trash button to remove a band.

### 2.2 Face Canvas Interaction & SVG Rendering

```
┌────────────────────────────────────────────────────────┐
│                   TUNNEL FACE CANVAS                   │
│                                                        │
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  │ <- Main Base Lithology
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  │    (e.g., Quartzite)
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  │
│  ───────/─────────────────────────────────────────────  │ <- Band #1 (Schist, 15px, -35°)
│  ░░░░░░/░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │
│  ─────/───────────────────────────────────────────────  │
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  │
│  ───────────────────────────────\───────────────────  │ <- Band #2 (Quartz Vein, 35px, +25°)
│  ████████████████████████████████\██████████████████  │
│  ─────────────────────────────────\─────────────────  │
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  │
└────────────────────────────────────────────────────────┘
```

- When `"Plot Band on Canvas"` is active, moving the cursor over the SVG canvas renders a translucent, real-time angled preview stripe following the cursor.
- Clicking commits the band anchor point `(x, y)` to the active excavation round's stroke data.
- The band renders with:
  - High-precision SVG polygon/path clipping constrained to the tunnel excavation perimeter.
  - Distinct hatched geological pattern (`fill="url(#pattern-rock)"`).
  - Boundary delimitation lines with customizable contrast.
  - Non-destructive placement: clicking an existing band highlights it in the panel for live adjustment.

---

## 3. Key Product Decisions & Technical Strategy

### 3.1 Data Model Expansion (`fieldMappingEngine.ts`)

Introduce a dedicated `FieldLithologyBandItem` structure while maintaining backwards compatibility with legacy `alternateLithologyConfig` and `FieldLithologyStroke`:

```typescript
export interface FieldLithologyBandItem {
  id: string;
  name?: string;
  rockType: string;
  rockCode?: string;
  rockName?: string;
  angleDeg: number;          // -90 to +90 degrees
  thicknessPx: number;       // Visual band thickness in SVG canvas px
  thicknessMeters?: number;  // True scaled thickness in meters
  anchorPoint?: { x: number; y: number }; // Centerline anchor on face
  color?: string;
  patternId?: string;
  enabled?: boolean;
}

export interface MultiBandAlternateLithologyConfig {
  enabled: boolean;
  baseRockType: string;
  bands: FieldLithologyBandItem[];
}
```

### 3.2 Canvas Rendering Pipeline

1. **Base Layer Pass**: Renders the complete perimeter filled with `baseRockType` (defaulting to the round's primary rock).
2. **Layered Bands Pass**: Loops through `bands`, calculating the geometric bounding polygon across the tunnel boundary using rotation angle $\theta$ and thickness $W$ around `anchorPoint`.
3. **Perimeter Clipping**: Clips each band polygon against the excavation crown, invert, and sidewalls via SVG `<clipPath id="panel-tunnel-boundary">` so bands never bleed outside the excavation profile.
4. **Export & Report Sync**: The 2-page Word/PDF sheet and photo reports will display the composite lithology description (e.g., *"Quartzite with intercalated Mica Schist (-35°, 15cm) and Quartz Vein (+25°, 35cm)"*).

---

## 4. Step-by-Step Implementation Sequence

### Phase 1: Engine & Types Update (`fieldMappingEngine.ts`)
- Define `FieldLithologyBandItem` and update `alternateLithologyConfig` on `FieldExcavationRound` to support both legacy format and the new `MultiBandAlternateLithologyConfig` with unlimited `bands`.
- Provide calculation helper `computeBandPolygonPoints(anchor, angleDeg, thicknessPx, bounds)` to generate exact oriented band boundary polygons.

### Phase 2: UI Panel Controls (`FieldMappingModeWorkspace.tsx`)
- Update the Alternate Lithology sidebar section:
  - Add Base Rock display & selector.
  - Implement the dynamic bands stack with "+ Add Lithology Band" button.
  - Provide Angle and Thickness sliders for each band with live numerical displays.
  - Add "Tap on Canvas to Place" toggle with active indicator.
  - Add individual Delete and Reorder buttons.

### Phase 3: Canvas Interaction & Hover HUD
- Wire `handleCanvasPointerDown` and `handleCanvasPointerMove` to track when band plotting is active.
- Display a dynamic preview guide stripe showing the exact angle and thickness before clicking.
- Upon click, commit the band's anchor point to the round state with auto-save.

### Phase 4: Full Multi-Band SVG Rendering
- Render layered SVG paths for each configured band inside the face canvas, clipped to the excavation boundary.
- Apply rock pattern fills, colors, and boundary lines.
- Enable direct selection of placed bands on the canvas to highlight and edit them in the side panel.

### Phase 5: Verification & Quality Pass
- Test compilation with `npx tsc --noEmit` and `compile_applet`.
- Verify adding 1, 2, 3, 4+ bands with varying angles and thicknesses.
- Verify that changing angles and thicknesses updates the canvas instantly.
- Verify canvas click-to-place functionality and boundary clipping.
