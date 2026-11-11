# Streamlined Custom Shape Builder (Manual + Simple CAD) & Pure Surface Mapping Geometry

This update simplifies the Custom Shape & Size workspace into two focused builders—the existing **Manual Design Builder** and a clean **Simple CAD Builder** where undrawn sides remain Open—while removing all unexcavated hatching overlays, unsolicited extra 3D surfaces, and underground tunnel terminology from Surface Mapping canvases and the 3D Joint Inspector.

## User Review & Critical Decisions

> [!IMPORTANT]
> The following design decisions incorporate your answers from the clarification prompt and address both the Custom Shape & Size builder and Surface Mapping / 3D Joint Inspector behavior.

- **Confirmed Decision 1 — Two Custom Shape Modes Only**: The Custom Shape & Size workspace is streamlined to display strictly two top-level modes:
  1. **Manual Design Builder**: The existing step-by-step manual design mode.
  2. **Simple CAD Builder**: A clean, distraction-free 1m CAD grid canvas without extra sidebars, sliders, or template clutter.
- **Confirmed Decision 2 — Direct Grid Drawing with Live Length, Angle & Snap**: In the Simple CAD Builder, users draw lines and arcs directly by clicking points on the 1m grid with real-time length ($m$), angle ($^\circ$), and grid/endpoint snap readouts at the cursor.
- **Confirmed Decision 3 — Automatic Portion Detection & Open Undrawn Sides**: Drawn segments in the Simple CAD Builder are automatically classified into **Left Wall**, **Crown**, **Right Wall**, or **Invert** from their spatial coordinates, and any side where no line/arc is drawn automatically remains **Open**.
- **Confirmed Decision 4 — Pure Input-Only Surface Mapping & Domain Terminology in 3D Inspector**: Surface Mapping (`BENCH`, `TRENCH`, `SLOPE`, `ROCK_SURFACE`) strictly propagates `mappingDomain` to all active locations and rounds so bench/heading "unexcavated" hatching never triggers, only user-input portions are rendered in 2D/3D, and all underground tunnel labels in the 3D Joint Inspector are replaced with surface-specific terminology.

---

## 1. Overview & Core Concept

- **What It Does**:
  1. **Custom Shape & Size Workspace**: Replaces the multi-tab clutter with a clean 2-tab switcher (**1. Manual Design Builder** and **2. Simple CAD Builder**). In Simple CAD Builder, engineers draw straight lines or 3-point/sagitta arcs directly on a 1m CAD coordinate grid; drawn segments auto-assign to tunnel portions and any omitted side stays Open.
  2. **Surface Mapping Canvas & 3D Joint Inspector**: Ensures Surface Mapping canvases never show hatched "Unexcavated" or "Top Heading" lock zones, renders only the exact surfaces and dimensions entered by the user in both 2D and 3D, and converts all remaining underground tunnel terminology in the 3D Joint Inspector (such as *"Tunnel Cavity"*, *"Tunnel Heading"*, *"Tunnel Drive"*, *"Crown Arch"*, and *"Portal"*) to domain-native surface terms.
- **Target Audience / Persona**: Engineering geologists and tunnel/slope designers configuring custom excavation profiles or inspecting mapped surface discontinuities in 3D.
- **Key Value**: Fast, zero-clutter CAD profile creation where open excavation boundaries require zero extra configuration, paired with clean, domain-accurate Surface Mapping canvases and 3D inspection.

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Opening Custom Shape & Size**:
     - The header presents a 2-option segmented toggle: **1. Manual Design Builder** and **2. Simple CAD Builder**.
  2. **Drawing in Simple CAD Builder**:
     - A full-viewport 1m engineering CAD grid with a minimal top bar containing only essential CAD tools: **Line**, **Arc**, **Select / Move Vertex**, **Delete Segment**, **Snap Toggle (0.1m / 0.5m / Endpoint)**, **Undo**, **Clear**, and **Apply Shape**.
     - Clicking on the grid places vertices with a live floating cursor readout showing exact segment length ($m$), angle ($^\circ$), and snapped $(X, Y)$ coordinates.
     - As segments are placed, each segment displays a clean on-canvas label (`LEFT WALL · 4.20m`, `CROWN ARC · 8.65m`, `RIGHT WALL · 4.20m`). Any side without a drawn line or arc is automatically marked **OPEN** in the live status strip and applied directly to the Face Canvas and 3D Inspector without fake closing lines.
  3. **Surface Mapping Canvas & 3D Joint Inspector**:
     - The 2D Face and Portion canvases show only the exact rectangular or multi-panel dimensions entered by the user—never split or hatched with "Unexcavated" or "Top Heading" overlays.
     - In the 3D Joint Inspector, the 3D viewport renders only the user's configured surface portion(s) without adding extra unrequested aprons or unexcavated rock blocks, and every control label, table header, and tooltip uses surface terminology (*"Into Slope / Rock Mass"* vs. *"Daylighting / Out of Face"*, *"Face Azimuth"*, *"Surface Portion"*, *"Section Span"*).
- **Visual Identity & Theme**:
  - **Aesthetic Direction**: High-precision engineering CAD instrumentation—flat obsidian/slate structural panels (`#0B0E17` / `#0F172A`), crisp 1px hairline grid lines, and high-contrast tabular monospace readouts (`IBM Plex Mono` / `JetBrains Mono` with `tabular-nums`).
  - **Color Palette & Mood**: 60% neutral CAD canvas, 30% slate toolbar chrome, 10% semantic portion accents (Emerald `#10B981` for Left Wall, Cyan `#38BDF8` for Crown, Purple `#A855F7` for Right Wall, Amber `#F59E0B` for Invert/Base).

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Two-Mode Custom Shape Architecture**
  - *Chosen Approach*: Consolidate the Custom Shape & Size editor into strictly **1. Manual Design Builder** and **2. Simple CAD Builder**, removing extra tabs, sidebars, sliders, and text boxes from the Simple CAD view.
  - *Why*: Eliminates cognitive overhead and gives engineers a pure CAD drawing window alongside the structured manual builder.
- **Decision 2: Implicit Open Boundaries When No Line Is Drawn**
  - *Chosen Approach*: Evaluate the drawn CAD segments spatially relative to the profile bounding box and centerline; assign present segments to `leftWall`, `crown`, `rightWall`, or `invert`, and mark any unassigned boundary role as `hasLeftWall: false`, `hasCrown: false`, `hasRightWall: false`, or `hasInvert: false` (`isClosed: false`).
  - *Why*: Matches standard CAD convention—if a boundary line is not drawn, that side of the excavation is open.
- **Decision 3: Strict Domain Propagation & Terminology Adaptation in Surface Mapping**
  - *Chosen Approach*: Attach `mappingDomain` directly onto `activeLocation` and `activeRound` objects and use a domain-aware terminology helper across `NatmJoint3DInspectorModal`.
  - *Why*: Prevents underground bench-hatching logic from ever activating in Surface Mapping and ensures all 3D Joint Inspector panels speak native surface geology language.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

- **Architecture & Component Diagram**:

```
┌───────────────────────────────────────────────────────────────────────────┐
│                    Custom Shape & Size Editor Workspace                   │
├─────────────────────────────────────┬─────────────────────────────────────┤
│      1. Manual Design Builder       │        2. Simple CAD Builder        │
│  (Existing Step-by-Step Builder)    │  • Full-Viewport 1m CAD Grid        │
│                                     │  • Tools: Line | Arc | Move | Erase │
│                                     │  • Live Cursor (L, Angle, Snap X,Y) │
│                                     │  • Auto Portion Role + Missing=Open │
└──────────────────┬──────────────────┴──────────────────┬──────────────────┘
                   └──────────────────┬──────────────────┘
                                      ▼
┌───────────────────────────────────────────────────────────────────────────┐
│            Authoritative Custom Geometry & Domain State Store             │
│  • Preserves Open Sides (hasLeftWall / hasCrown / hasRightWall / Invert)  │
│  • Stamps mappingDomain onto activeLocation & activeRound                 │
└──────────────────┬─────────────────────────────────────┬──────────────────┘
                   ▼                                     ▼
┌─────────────────────────────────────┐ ┌───────────────────────────────────┐
│   2D Field & Surface Canvas Engine  │ │     3D Joint Inspector Modal      │
│  • Zero "Unexcavated" Hatching in   │ │  • Renders Only Input Portions    │
│    Surface Mapping                  │ │  • Pure Surface Terminology       │
│  • Exact Input Dimensions Only      │ │  • Portion-Adaptive Trace Hinge   │
└─────────────────────────────────────┘ └───────────────────────────────────┘
```

- **Interactive Component & State Mapping**:
  - **Simple CAD Canvas Interaction**:
    - `LINE` tool: Click start point $P_1 \to$ move cursor with live length $L = \sqrt{\Delta x^2 + \Delta y^2}$ and angle $\theta = \text{atan2}(\Delta y, \Delta x) \to$ click end point $P_2$ to commit segment and chain from $P_2$ (`Esc` or double-click ends chain).
    - `ARC` tool: Click start point $P_1 \to$ click end point $P_2 \to$ move cursor to set arc apex/sagitta height with live arc length readout $\to$ click to commit circular arc segment.
    - `MOVE` / `ERASE` tools: Drag any vertex to adjust coordinates with live snap, or click any segment to remove it (immediately reopening that portion if no other segment occupies that boundary).
    - Auto-role classifier: Computes each segment's centroid and orientation relative to the overall profile bounds $(X_{\min}, X_{\max}, Y_{\min}, Y_{\max})$ to classify into `leftWall`, `crown`, `rightWall`, or `invert`, setting missing roles to Open (`false`).
  - **Surface Mapping Clean Canvas & 3D Inspector**:
    - Stamp `mappingDomain` onto `activeLocation` and `activeRound` so `getExcavationBenchConfig` and `getPanelActiveExcavationBounds` always return `hasBenchDivision: false` and `hatchZone: 'none'` in Surface Mapping.
    - Remove the extra unsolicited `toeApronDepth` floor mesh in Surface Mapping 3D view when not mapped, rendering strictly the user-configured portion plane(s).
    - Replace all remaining underground tunnel strings in `NatmJoint3DInspectorModal` with domain-aware labels when `isSurfaceMapping` is active.
