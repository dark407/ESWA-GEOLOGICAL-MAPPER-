# Application Architecture & Modular Isolation Implementation Plan

## Problem Diagnosis: Root Cause of AI Studio Slowness & Quota Consumption

1. **Monolithic File Size**: `App.tsx` contains **8,011 lines** (~343 KB of source code). Every single AI Studio interaction (even modifying a 2-word button label) forces the AI model to ingest ~45,000 input tokens and compute diffs across an 8,000-line syntax tree. This exhausts user quota at 10x normal rate and creates high latency.
2. **Coupled State Management**: All states (photogrammetry trace points, custom CAD profiles, 3D tunnel meshes, rock mechanics ratings, license intervals, modals) live in a single root component, causing unnecessary re-evaluations and requiring massive context windows.
3. **Zero UI Change Commitment**: As strictly requested, **no visible changes** will be made to the user interface, toolbars, canvases, trace tools, styling, colors, or workflows. Everything will look and operate identically.

---

## Architecture Blueprint

```
+-----------------------------------------------------------------------------------+
|                           RootApplicationRouter.tsx                              |
+-----------------------------------------+-----------------------------------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------+
|                        App.tsx (Slim Orchestrator < 600 lines)                    |
|  - Theme & Responsive Layout Provider                                            |
|  - Mode Switcher (Tunnel Photogrammetry | Field Mapping | Core Log | TBM | Mining)|
|  - High-Level Navigation Bar & Unified Top Header (Identical UI/Selectors)        |
+--------------------+--------------------+--------------------+--------------------+
                     |                    |                    |
        +------------+            +-------+-------+            +------------+
        v                         v               v                         v
+---------------+         +---------------+ +---------------+        +---------------+
| Tunnel Photo- |         | Field Mapping | | Core Logging  |        | TBM & Mining  |
| grammetry Hub |         | Mode Shell    | | Mode Shell    |        | Mode Shells   |
| (Workspace +  |         | (Existing     | | (Existing     |        | (Existing     |
| Canvas + 3D)  |         | Component)    | | Component)    |        | Components)   |
+-------+-------+         +---------------+ +---------------+        +---------------+
        |
        v
+-----------------------------------------------------------------------------------+
|                          Lazy Loaded On-Demand Modals                             |
|  - FreeformCustomProfileEditor       - SimpleFullPhotoAndAccuracyModal            |
|  - NatmRockMechanicsAndLookAheadHub  - OverbreakAndProjectMemoryPanel             |
|  - ContinuousTunnelLogSetupModal     - A3ContinuousTunnelLogModal                 |
|  - EngineeringSheetModal             - GlobalSettingsModal                        |
+-----------------------------------------------------------------------------------+
```

---

## User Review Required

> **Important**: This architectural restructuring is **100% transparent** to the user experience. All CSS selectors, IDs, button layouts, canvas interactions (mouse/pinch zoom, pan, joint editing, 3D inspector), and persistence mechanisms remain completely unchanged.

---

## Proposed Changes

### Phase 1: State Decomposition into Domain Custom Hooks (`/src/hooks/`)
Extract isolated state machines from `App.tsx` into dedicated, self-contained hooks:
1. **`useTunnelProjectState.ts`**:
   - Manages tunnel project geometry, chainage, profile type, excavation stage, and project metadata.
   - Synchronizes seamlessly with local IndexedDB (`fastAsyncStorageEngine`).
2. **`usePhotogrammetryTraceState.ts`**:
   - Manages joint traces, lithology boundaries, survey control points, and manual trace tool modes (`TRACE_FREEHAND`, `TRACE_BEZIER`, etc.).
   - Handles joint text editing, 3D joint inspection state, and canvas zoom/pan transforms.
3. **`useModalRegistryState.ts`**:
   - Manages active modal visibility flags (`isProfileEditorOpen`, `isNatmHubOpen`, `isSettingsOpen`, `isA3LogOpen`, etc.).

### Phase 2: Modular Modal Host (`/src/components/modals/AppModalHost.tsx`)
1. Create a dedicated container component that houses the 15+ engineering dialogs and drawers that currently bloat `App.tsx` by over 3,000 lines.
2. Use dynamic imports (`React.lazy` and `Suspense`) for heavy 3D viewers and PDF/DXF export dialogs so they load only when clicked.
3. Keep all modal trigger props, handlers, and pass-through parameters identical.

### Phase 3: Slim `App.tsx` Orchestrator Refactoring
1. Replace inline modal blocks and disjointed state declarations in `App.tsx` with clean hook consumers and the modular modal host.
2. Shrink `App.tsx` from **8,011 lines down to ~600 lines**.
3. Retain exact DOM layout: header controls, viewport containers, canvas wrappers, and floating toolbar widgets.

---

## Verification Plan

### Automated Build & Syntax Verification
1. Run `compile_applet` to verify zero TypeScript compilation errors or missing imports.
2. Run `lint_applet` to confirm strict code hygiene and syntax validity.

### Manual Verification Checklist
1. **Visual Parity**:
   - Header top bar layout, logos, mode toggle buttons, theme toggle, and status indicators match pixel-for-pixel.
2. **2D & 3D Canvas Functions**:
   - Mouse wheel zoom, pinch zoom, pan, and text editing on traced joints in the edit canvas.
   - 3D joint inspection canvas button launches the interactive 3D inspector.
3. **Mode Switching**:
   - Tunnel Photogrammetry, Field Mapping, Core Logging, TBM Shield, and Mining modes switch smoothly.
4. **Data Persistence**:
   - Verify photos and project records remain saved in local IndexedDB without 5MB quota errors.
5. **AI Studio Latency Test**:
   - Subsequent prompt turns will process in seconds instead of minutes with minimal quota usage.
