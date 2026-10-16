# Underground Face Mapping: Dual-Canvas Synced Photogrammetry & 3D Tunnel

Comprehensive architectural blueprint for synchronized dual-canvas face logging in Underground Face Mapping Photogrammetry. This design pairs an active rock photo canvas with a synced clean vector outline canvas, introduces instant OK confirmation modals with rock surface clearing, provides real-time duplicate trace detection with orange warnings, adds a collapsible bottom features drawer, and creates a photogrammetric 3D extruded tunnel based on profile geometry and photo textures.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The following user preferences were confirmed in Phase 1 and are fully incorporated into this blueprint:
> - **Dual-Canvas Visibility Rule**: Once a traced joint or geological feature is confirmed via **OK**, its stroke is **hidden on the Photo Canvas** to keep the excavation rock surface 100% clean and unobstructed, while remaining **fully rendered on the Clean Vector Outline Canvas**.
> - **Duplicate & Overlap Detection**: Tracing an existing or overlapping joint triggers a **real-time orange highlight** on the canvas and an **overlap distance warning banner** indicating spatial proximity (e.g., within 15 cm of an existing joint).
> - **Synchronized Navigation**: Both canvases operate in **strict lockstep**—panning and zooming (via mouse wheel, gesture pinch, or pan tool) synchronously update scale, center, and coordinate bounds on both canvases.
> - **Surface-Specific Dual Orientation**:
>   - **Face & Side Walls (Left Wall, Right Wall)**: Clean Outline Canvas on the **Left**, Photo with Outline Canvas on the **Right** (horizontal split).
>   - **Crown (Roof)**: Clean Outline Canvas on **Top**, Photo Canvas on the **Bottom** (vertical split, preserving horizontal 0m invert/SPL to pull length layout).
> - **Scope Guard**: All features are strictly isolated to **Underground Face Mapping Photogrammetry** (`MappingWorkspace.tsx`) and do **NOT** modify or impact the Field Mapping Mode (`FieldMappingModeWorkspace.tsx`), preventing code regressions.

---

## 1. Overview & Core Concept

### What It Does
Geological face mapping in underground tunneling requires precise identification of rock mass discontinuities (joints, shears, bedding planes, faults). Tracing discontinuities directly over rock photographs often clutters the visual field, making subsequent fractures difficult to see. 

This feature transforms the photogrammetric face logging workflow into a **Dual Synchronized Engineering Station**:
1. **Photo Tracing Canvas**: Displays the high-resolution, orthorectified rock photograph clipped to the tunnel outline. As the engineering geologist draws a joint, the live stroke displays with real-time cursor tracking.
2. **Clean Outline Canvas**: Displays the exact CAD tunnel profile geometry, coordinate meter ticks, and all previously mapped geological structures. The active stroke on the photo canvas mirrors here in real-time.
3. **OK Feature Confirmation & Rock Clear Workflow**: When a joint stroke finishes, an instant confirmation prompt requests "OK". Upon confirmation, the joint stroke disappears from the photo canvas (keeping rock textures pristine) and locks permanently into the clean outline canvas.
4. **Duplicate & Proximity Guard**: If a geologist accidentally begins retracing an already mapped joint, real-time spatial distance algorithms detect the overlap, illuminating the stroke in vibrant warning orange and displaying a proximity warning.
5. **Photogrammetric 3D Tunnel Model**: Seamlessly constructs a 3D procedural tunnel model extruded to the round pull length, applying photo textures to the face and unrolled profile, and mapping all 2D traces into true 3D spatial discontinuity planes.
6. **Bottom Traced Features Drawer**: A compact, floating button at the bottom of the screen displays the count of traced features and expands an interactive audit drawer with strike/dip telemetry, persistence, roughness, and quick-toggle inspection tools.

### Target Audience & Persona
- **Engineering Geologists & Tunnel Geotechnical Engineers**: Conducting face inspections, RMR/Q-system rock mass characterization, and kinematic wedge hazard identification at the excavation front.
- **Survey & Photogrammetry Specialists**: Ensuring 1:1 metric alignment between site photographs and CAD profile specifications.

### Key Value
- **Zero Visual Occlusion**: Geologists trace on clear, unoccluded rock photographs without old lines obscuring subtle fracture tips.
- **Error-Proof Mapping**: Automatic duplicate detection prevents double-counting joint frequencies for RQD and spacing indices.
- **Instant Geotechnical Verification**: Real-time mirror visualization provides immediate confidence that vector traces accurately represent the rock mass geometry.

---

## 2. User Experience & Visual Design

### Key User Flows

#### Flow A: Synchronized Dual-Canvas Tracing
1. The geologist enters **Face Mapping** or selects **Crown / Walls** in the Underground Face Mapping photogrammetry suite.
2. The workspace renders the dual-canvas split:
   - For **Face, Left Wall, Right Wall**: Dual side-by-side view (Clean CAD Outline Canvas on the left, Photo Canvas on the right).
   - For **Crown**: Top/Bottom split (Clean CAD Outline Canvas on top, Photo Canvas on the bottom, honoring 0m center/bottom reference).
3. Moving the cursor over the Photo Canvas shows crosshairs on both canvases. Panning or zooming either canvas synchronously updates the sibling canvas in real-time lockstep.

#### Flow B: Active Tracing, Live Reflection & OK Confirmation
1. Geologist clicks and drags (or clicks vertices) to trace a discontinuity on the Photo Canvas.
2. As points are drawn, the stroke mirrors in real-time on the Left/Top Clean Canvas.
3. Upon finishing the stroke, an ergonomic confirmation card appears adjacent to the cursor:
   - Displays: Feature label (e.g., `J-04`), calculated trace length (e.g., `2.34 m`), and orientation (Strike/Dip).
   - Action buttons: **Confirm (OK)** [Enter], **Retrace** [R], **Cancel** [Esc].
4. Clicking **OK**:
   - The trace locks into the project database.
   - The trace is cleared from the Photo Canvas (leaving the rock photo clean).
   - The trace is rendered with standard geological symbology on the Clean Outline Canvas.

#### Flow C: Real-Time Duplicate & Overlap Warning
1. If the user begins tracing along or near an already logged discontinuity:
   - Real-time Hausdorff and segment-distance monitoring detects the proximity (< 0.15 m).
   - The active stroke turns from the standard joint set color to glowing safety orange (`#F97316`).
   - A floating warning banner appears at the top center: *"Duplicate / Overlap Warning: Trace is within 8 cm of existing Joint J-02 (Dip 68° / 142°). Retrace or combine?"*

#### Flow D: Bottom Traced Features Drawer & "Peek Traces" Tool
1. A discreet, floating bottom badge reads: `Traced Features (6)` with a small geological layers icon.
2. Clicking it opens a horizontal glassmorphic drawer displaying:
   - Tabular list of traced joints with Set IDs (J1, J2, Random), trace lengths, dip/dip directions, and roughness.
   - **"Peek Traces on Photo" Button** (or hold `Shift`): Temporarily renders all confirmed traces semi-transparently on the Photo Canvas for instant visual auditing.
   - Delete, edit attributes, or reassign joint sets with one click.

#### Flow E: 3D Photogrammetric Tunnel Construction
1. Clicking the **3D Tunnel** button opens the interactive WebGL/Three.js spatial viewport.
2. The 3D engine generates the exact extruded tunnel shape (matching the CAD cross-section and pull length).
3. The photo textures are UV-mapped to the excavation face, crown, and sidewalls.
4. Traced discontinuities are projected onto the 3D rock surfaces as real 3D spatial polyline vectors and infinite fracture disc planes.

### Visual Identity & Theme
- **Color Palette**:
  - Deep Geological Obsidian Canvas: `#090C12` (Dark) / `#F1F5F9` (Light).
  - Clean Vector Surface: Slate background `#0F172A` with subtle 1.00m engineering grid `#1E293B`.
  - Photo Canvas Frame: Crisp hairline border `#334155` with active camera icon.
  - Active Trace Stroke: High-visibility cyan `#06B6D4` / set-colored vector.
  - Overlap Warning Accent: High-alert vivid safety orange `#F97316` with amber backing `#451A03`.
  - Confirmation Prompt: Slate `#0F172A` card with emerald `#10B981` OK button.
- **Typography**:
  - Headings & Controls: `Plus Jakarta Sans`, SemiBold 600.
  - Spatial Telemetry & Metrics: `IBM Plex Mono` / `tabular-nums` for precise dimensions, coordinates, and strike/dip readings.
- **Layout Rhythm**:
  - Zero-pill metadata design: Clean text separators (`·`), strict one-row header compliance, and bottom-anchored HUDs that never occlude rock faces.

---

## 3. Key Product Decisions & Trade-Offs

| Decision | Chosen Approach | Why | Alternatives Considered |
|---|---|---|---|
| **Dual-Canvas Synchronization** | Synchronized state hook driving identical viewBox / transform matrices | Prevents coordinate drift, keeps 1:1 scale between photo pixels and engineering meters | Independent viewport pans (rejected: causes cognitive disorientation) |
| **Trace Visibility after OK** | Hide trace on photo canvas; render permanently on clean canvas | Fulfills core user requirement to keep rock face pristine for detecting fine cracks | Leave ghost traces on photo (rejected: clutters rock surface over time) |
| **Duplicate Detection Algorithm** | Bidirectional point-to-polyline segment distance (< 0.15m threshold) | Extremely fast ($O(N \cdot M)$ for small segment counts), runs smoothly at 60fps during pointer moves | Raster pixel difference (rejected: heavy CPU overhead, fails with rotated photos) |
| **Crown Split Layout** | Vertical split (Clean Outline on Top, Photo on Bottom) | Matches geological tunnel unrolled convention (0m at bottom/invert to pull length at top) | Side-by-side on crown (rejected: squashes wide crown spans into narrow vertical slits) |
| **Features Drawer Placement** | Sleek collapsible bottom-center dock with count badge | Conforms to Three.js and spatial UI standards; leaves 100% of the canvas height unobstructed | Left/right sidebars (rejected: crowds horizontal split view) |

---

## 4. Technical Architecture & Data Strategy

### System Component Diagram

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                               MappingWorkspace.tsx                                     │
│  ┌──────────────────────────────────────────────────────────────────────────────────┐  │
│  │                              DualCanvasManager                                   │  │
│  │  ┌───────────────────────────┐           ┌────────────────────────────────────┐  │  │
│  │  │ Clean Outline Canvas      │           │ Photo with Outline Canvas          │  │  │
│  │  │ (Left for Face/Walls,     │ ◄───────► │ (Right for Face/Walls,             │  │  │
│  │  │  Top for Crown)           │ Synchron- │  Bottom for Crown)                 │  │  │
│  │  │                           │   ized    │                                    │  │  │
│  │  │ - CAD Profile Outline     │ Viewport  │ - Scaled Rock Photo                │  │  │
│  │  │ - Confirmed Traces (All)  │ Transform │ - Active Drawing Stroke            │  │  │
│  │  │ - Live Mirrored Stroke    │ (Zoom/Pan)│ - Proximity Orange Warning         │  │  │
│  │  │ - 1.0m Engineering Grid   │           │ - Confirmed Traces Hidden (Clean!) │  │  │
│  │  └───────────────────────────┘           └────────────────────────────────────┘  │  │
│  │                                 ▲                                                │  │
│  │                                 │ Tracing Events & Lockstep Transform            │  │
│  │  ┌──────────────────────────────┴─────────────────────────────────────────────┐  │  │
│  │  │ Trace Confirmation Modal: "Confirm Feature? [OK] / [Retrace] / [Cancel]"   │  │  │
│  │  │ Duplicate Distance Guard: detectOverlappingTraces(draftPoints, joints)     │  │  │
│  │  └────────────────────────────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                        │
│  ┌──────────────────────────────────────────────┐  ┌────────────────────────────────┐  │
│  │ Collapsible Bottom Drawer: Traced Features   │  │ 3D Photo-Textured Tunnel Model │  │
│  │ - Feature List & Strike/Dip Telemetry        │  │ - Procedural Extruded Geometry │  │
│  │ - [Peek All Traces on Photo] Hold/Toggle     │  │ - Mapped Photos (Face/Crown)   │  │
│  │ - Bulk Export (DXF / GeoJSON / CSV)          │  │ - 3D Discontinuity Plates     │  │
│  └──────────────────────────────────────────────┘  └────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### Data Structures & State Management

#### 1. Dual Viewport Sync State
```typescript
interface DualCanvasSyncState {
  scale: number;
  panX: number;
  panY: number;
  splitRatio: number; // default 0.50 (50/50 split)
  isPeekingPhotoTraces: boolean; // Shift key or toggle to peek all traces on photo
}
```

#### 2. Trace Confirmation & Duplicate Evaluation
```typescript
interface PendingTraceConfirmation {
  id: string;
  points: Point2D[];
  surface: SurfaceType;
  featureType: GeologicalFeatureType;
  lengthMeters: number;
  estimatedDip?: number;
  estimatedDipDir?: number;
  overlappingJointId?: string;
  overlapDistanceMeters?: number;
}
```

#### 3. Spatial Duplicate Detection Function
```typescript
function checkTraceOverlap(
  draftPoints: Point2D[],
  existingJoints: Joint[],
  activeSurface: SurfaceType,
  thresholdMeters: number = 0.15
): { isOverlap: boolean; closestJoint?: Joint; minDistanceMeters: number }
```

### Interactive State Transitions

```
[Start Drawing on Photo Canvas]
       │
       ▼
[Pointer Move] ──► Real-Time Mirroring on Clean Canvas
       │
       ├─► Distance Check: minDistance < 0.15m ?
       │     ├── YES: Stroke color = Orange (#F97316), Banner = "Duplicate Warning"
       │     └── NO:  Stroke color = Set/Feature Color
       │
[Pointer Up / Finish Trace]
       │
       ▼
[Show Confirmation Popover]
       │
       ├─► Click [Cancel / Esc]: Discard draft trace; restore clean state
       ├─► Click [Retrace / R]:  Clear points; keep tracing tool active
       │
       ▼ Click [OK / Enter]
[Commit to State & Storage]
       │
       ├── Add to joints[] array
       ├── Render on Clean Outline Canvas (permanent)
       ├── Hide from Photo Canvas (photo stays 100% clean rock)
       └── Update Traced Features Drawer count badge
```

---

## 5. Verification & Test Plan

1. **Dual Canvas Layout**:
   - Verify Face, Left Wall, and Right Wall render side-by-side (Clean left, Photo right).
   - Verify Crown renders vertically (Clean top, Photo bottom with 0m invert reference).
2. **Synchronized Navigation**:
   - Test wheel zoom on left canvas: right canvas zooms identically with identical center.
   - Test mouse drag pan on right canvas: left canvas pans in synchronized lockstep.
3. **Live Mirroring & OK Confirmation**:
   - Draw joint on photo canvas: confirm line draws concurrently on clean outline canvas.
   - Complete joint: confirm popover prompts "OK".
   - Click "OK": verify joint is hidden on photo canvas but visible on clean outline canvas.
4. **Duplicate Warning**:
   - Trace over an existing joint: verify immediate orange stroke and top proximity warning banner with distance in cm.
5. **Bottom Features Drawer**:
   - Verify count badge updates as features are confirmed.
   - Test "Peek Traces on Photo": verify all traces appear temporarily over rock photo.
6. **3D Tunnel View**:
   - Open 3D tunnel: verify geometry matches tunnel profile and length, with mapped photo textures and 3D joint planes.
7. **Regression Safety**:
   - Verify Field Mapping Mode (`FieldMappingModeWorkspace.tsx`) is completely untouched and functioning normally.
