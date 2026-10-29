# Underground Face Mapping Strip Log: Advanced Lithology Fills & Interactive Joint Editing Window

Comprehensive architectural plan to transform the Unfolded Strip Log into a high-precision, interactive geological editing suite with true 2D canvas lithology fills, clutter-free selective joint handles, trace-joining capability, and direct text/parameter editing.

---

## 1. Problem Analysis & Core Requirements

1. **Lithology Fill Fidelity**:
   - *Current issue*: On the 2D Face/Wall canvas, rock units can fill or shade entire panels (e.g., covering the entire left wall). When transferred to the unfolded strip log, lithology strokes often appear as single outline paths or thin lines rather than rich, fully filled rock patterns and color tints.
   - *Requirement*: Strip log must render full surface fills, rock hatching patterns (monochrome and colored), and closed polygon regions identical in visual density and appearance to the 2D face canvas.
   - *Requirement*: Enable direct selection and editing of lithology units (rock type, pattern, custom color, band thickness) within the strip log.

2. **Dip Plane Surface Editing**:
   - *Current issue*: Dip plane surface patches cannot be inspected or altered in the strip log.
   - *Requirement*: Enable selecting dip surfaces on the strip log to adjust strike, dip direction, dip angle, and geotechnical properties.

3. **Clutter-Free Selective Joint Handle Discipline**:
   - *Current issue*: The strip log currently displays circular endpoints, control points, and '+' add buttons simultaneously on every joint, creating visual clutter.
   - *Requirement*: Unselected joints must remain clean, crisp geological line traces with only their text label. When a user clicks/selects a specific joint:
     - Render exactly two primary handles: Open (Start) point and End point.
     - Allow dragging either endpoint to extend, rotate, or reorient.
     - Allow dragging the line body to move/translate the entire trace.

4. **Dynamic Bend Point Addition**:
   - *Requirement*: When a joint is selected, the user can click to add bend points (intermediate vertices) along the trace to bend, curve, or articulate the joint path naturally across geological boundaries.

5. **Join / Connect Multiple Joint Traces**:
   - *Requirement*: Provide a dedicated **"Join Traces"** tool. The user activates Join mode, selects two or more joint traces across panel seams (e.g., Left Wall continuation into Crown), and merges them into a single continuous joint trace with unified properties and smooth point chaining.

6. **In-Place Joint Text & Parameter Editing**:
   - *Requirement*: Allow direct editing of joint labels (e.g. `J1`, `J2`, `F1`) and parameters (dip direction, dip angle, set, persistence, aperture) via an interactive floating/aside inspector window.

---

## 2. User Experience & Visual Interface Design

### 2.1 Workspace Layout
```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ STRIP LOG CAD WORKSPACE                         [Undo] [Redo] [Zoom: 100%] [Fit] [Save]│
├────────────────────────────────────────────────────────────────────────────────────────┤
│ TOOLBAR: [ Pointer / Move ] [ Extend ] [ Add Bend ] [ Join Traces ] [ Edit Text ]     │
├──────────────────────────────────────────────────────────┬─────────────────────────────┤
│                                                          │ SELECTED ITEM INSPECTOR     │
│  LEFT WALL (0..Pull) │ CROWN ARCH │ RIGHT WALL (0..Pull) │ ┌─────────────────────────┐ │
│  ┌───────────────────┬────────────┬───────────────────┐  │ │ JOINT TRACE J1          │ │
│  │ [Granite Fill]    │            │ [Sandstone Fill]  │  │ │ Set: [J1 ▼] Color: 🔴   │ │
│  │                   │            │                   │  │ │ Dip Dir: [ 135 ]°       │ │
│  │  o─────────────o  │            │                   │  │ │ Dip Amt: [  65 ]°       │ │
│  │ (Selected Joint)  │            │                   │  │ │ Label:   [ J1 135/65 ]  │ │
│  │ [Start]     [End] │            │                   │  │ ├─────────────────────────┤ │
│  │                   │            │                   │  │ │ [ Add Bend Point ]      │ │
│  │  ───────────────  │            │                   │  │ │ [ Reverse Direction ]   │ │
│  │ (Clean Unselected)│            │                   │  │ │ [ Delete Trace ]        │ │
│  └───────────────────┴────────────┴───────────────────┘  │ └─────────────────────────┘ │
└──────────────────────────────────────────────────────────┴─────────────────────────────┘
```

### 2.2 Handle & Selection States
- **Deselected Trace**: Crisp 2.2px styled line with oriented label text (`J1 135°/65°`). Zero circular dots, zero plus signs.
- **Selected Trace**:
  - 3.5px neon cyan accent halo around the path.
  - Start handle (amber circular badge `S`) at point 0.
  - End handle (emerald circular badge `E`) at the final point.
  - Intermediate bend handles (violet circular badges) if bend points exist.
  - Subtle mid-segment hover indicator for inserting a new bend point.
- **Join Mode Active**:
  - Canvas displays instructions: *"Select first joint, then select second joint to merge"*.
  - Candidate joinable endpoints highlight with pulsing magnetic connection rings.
  - Clicking two compatible traces combines their vertex chains into a single seamless trace record.

---

## 3. Technical Architecture & Component Changes

### 3.1 Strip Log Lithology Rendering Enhancement (`src/components/FieldMappingCompassAndPatterns.tsx`)
- In `FieldUnfoldedMonochromeSketchSvg`:
  - Update `renderPanelContent` lithology strokes mapping:
    - If `stroke.mode === 'region_fill'` or `stroke.isClosed` or `stroke.polygon && stroke.polygon.length >= 3`:
      - Map all polygon vertices to continuous strip CAD coordinates.
      - Render full SVG `<polygon>` or `<path>` with pattern fill `url(#srf-rep-pat-...)` and semi-transparent background color matching the rock type.
    - If user painted over the entire wall/panel, guarantee the polygon covers the entire panel bounding area (`[targetBoxX, targetBoxY, targetBoxW, targetBoxH]`).
  - Add pointer event handlers to lithology strokes so clicking a lithology zone selects it and highlights its boundary.

### 3.2 Clutter-Free Interactive Handle Overlay (`src/components/FieldMappingReportAndParamsStages.tsx`)
- Refactor `interactiveHandlesOverlay` in `FieldStripAlignmentStage`:
  - **Suppress Global Handles**: Only map and render handles for `selectedTraceItem`. Unselected items only render an invisible wide transparent polyline (`strokeWidth="16"`) for click selection.
  - **Selected Item Handles**:
    - `startPt`: Amber draggable circle with extend/rotate cursor.
    - `endPt`: Emerald draggable circle with extend/rotate cursor.
    - `lineBody`: Draggable line for full trace translation/movement.
    - `bendPoints`: Draggable intermediate vertices.
  - **Add Bend Point Mode**:
    - Clicking on the selected trace line inserts a new vertex at the clicked ratio into `activeRound.jointTraces.points`.
  - **Join Traces Mode**:
    - Implement `joinSelectedJointTraces(traceAId: string, traceBId: string)`:
      - Determines closest endpoints between trace A and trace B.
      - Chaining logic: reorders points of trace B if necessary and concatenates vertex arrays with distance tolerance check.
      - Prompts/preserves primary joint set and calculates weighted dip/dip-direction.
      - Replaces trace A and trace B with unified single trace in `activeRound.jointTraces`.
      - Adds action to `undoStack`.

### 3.3 Strip Inspector Drawer & In-Place Text Editing
- Add a dedicated slide-out or floating **Strip Item Inspector Panel**:
  - When a Joint is selected:
    - Text/Label editor input (allows custom label or auto-computed `[Set] [DipDir]/[Dip]`).
    - Dip Direction slider/stepper (0..360°) and Dip Amount slider/stepper (0..90°).
    - Joint Set dropdown (J1, J2, J3, Random, Bedding, Cleavage, Fault).
    - Quick actions: *Add Bend Point*, *Reverse Trace Direction*, *Join with Neighbor*, *Delete*.
  - When a Lithology Zone is selected:
    - Rock type selector (Granite, Sandstone, Basalt, Quartzite, Shale, Gneiss, etc.).
    - Pattern density and scale sliders.
    - Color shade picker.
    - Foliation/bedding angle and dip.
  - When a Dip Plane Surface is selected:
    - Strike/Dip direction inputs and roughness/aperture selectors.

---

## 4. Step-by-Step Implementation Sequence

1. **Step 1: Lithology Surface Fill Engine in Strip Log**
   - Update `FieldMappingCompassAndPatterns.tsx` (`FieldUnfoldedMonochromeSketchSvg`):
     - Ensure region-fill lithology strokes render closed filled paths with rock texture patterns and background colors across Left Wall, Crown, and Right Wall.
     - Enable click detection on lithology zones.

2. **Step 2: Clean Joint Selection & Endpoint Handle Isolation**
   - In `FieldStripAlignmentStage`:
     - Hide all endpoint and bend dots on unselected traces.
     - Render open and end handle circles only when a joint is actively selected.
     - Implement trace translation (move whole trace) when dragging the line.

3. **Step 3: Bend Point Addition & Vertex Dragging**
   - Add "Add Bend" button and click-on-line vertex insertion.
   - Support dragging intermediate bend points to curve the joint trace.

4. **Step 4: Join Traces Workflow**
   - Add "Join Traces" button to the strip toolbar.
   - Implement multi-trace selection and geometric concatenation into a single unified joint trace.

5. **Step 5: In-Place Text & Parameter Inspector**
   - Build floating/collapsible Strip Inspector panel for live editing of joint labels, strike/dip, set assignment, and lithology properties.

6. **Step 6: Verification & Build**
   - Verify TypeScript compilation with `lint_applet` (`tsc --noEmit`).
   - Run production compilation with `compile_applet`.
   - Test interaction flows in the browser runtime.

---

## 5. Verification Plan

1. **Lithology Visual Check**:
   - Paint a lithology zone covering the Left Wall in 2D Face Canvas.
   - Switch to Stage 6 (Wall & Crown Unfolded Strip Log).
   - Verify the Left Wall in the strip log displays the solid pattern fill and tint instead of a single thin line.
2. **Selective Handles Check**:
   - With multiple joints mapped, confirm the strip log displays zero circles or plus signs.
   - Click a joint trace: verify only its Start and End point handles appear.
3. **Bend & Extend Check**:
   - Add a bend point and drag it; confirm the trace bends smoothly.
   - Drag an endpoint; confirm the trace extends cleanly.
4. **Join Traces Check**:
   - Click "Join Traces", click two adjacent joints on wall and crown.
   - Confirm they merge into a single continuous joint trace with unified label.
5. **Direct Text/Parameter Edit Check**:
   - Change joint label and dip direction in the inspector panel; confirm instant visual update on the strip log.
