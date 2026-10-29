# Strict Input Validation & Blank-State Form Engine

Eliminate pre-filled placeholder data across all industry modes (NATM Tunneling, Field APK Mapping, Underground Mining, and TBM Mechanized Tunneling). Enforce explicit user selection for all tunnel shapes, locations, and dimensions with unselected placeholders (`-- Select Shape / Option --`), visual validation states (red highlight borders upon attempted submission), and strict navigation guards that block advancing to subsequent windows until all mandatory fields are valid.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The following product behaviors were confirmed during Phase 1 interactive clarification:
> - **Pre-Filled Data Scope**: Completely removed across all modes (NATM, Field Mapping, Underground Mining, and TBM). All forms start clean/blank with no pre-loaded dummy measurements or pre-selected shapes.
> - **Demo Buttons**: Removed or disabled demo data generators/benchmark buttons across all modes to ensure clean production workflows.
> - **Select Box Initial State**: Dropdowns default to an unselected placeholder state (`-- Select Option / Shape --`). Upon validation failure, empty required inputs and unselected dropdowns receive a prominent red border highlight.
> - **Validation & Navigation Enforcement**: Clicking "Next" / "Proceed" / "Save & Continue" with empty mandatory fields will strictly **block window navigation**, automatically **focus the first invalid/empty input**, and trigger a high-visibility warning **toast alert** detailing the missing parameters.

---

## 1. Overview & Core Concept

### What It Delivers
Previously, opening a new session or location would automatically populate default geometric profiles (e.g., D-shaped 8.40m × 7.20m, round pull 3.5m, azimuth 000°), which could inadvertently lead field geologists and tunneling engineers to proceed with unintended default measurements.

This upgrade transforms the input lifecycle into a **strict, blank-state, self-validating system**:
1. **Zero Pre-Seeded Form State**: When starting a new project, location, or stope, no default dimensions or shapes are pre-selected.
2. **Explicit Selection Protocol**: Dropdowns explicitly require user action (starting at `-- Select Shape --` or `-- Select Option --`).
3. **Real-Time & Submission Validation**: Fields track "touched" and "submitted" validation states. Incomplete fields light up with a red border (`border-rose-500 ring-2 ring-rose-500/20`), red label accents, and assistive error notices.
4. **Navigation Interlock**: Step transitions (e.g. Project/Location → Tunnel Shape → Surface Pictures → Photogrammetry Canvas) are guarded. If required parameters are missing, navigation is halted, the viewport scrolls/focuses on the offending input, and a descriptive toast appears.

---

## 2. User Experience & Visual Design

### 2.1 Visual Hierarchy & Component States

| State | Visual Treatment | Helper / Placeholder Text |
| :--- | :--- | :--- |
| **Initial / Pristine** | Slate-300 / Slate-700 border, neutral background | `-- Select Excavation Shape --`, `0.00` placeholder |
| **Active / Focused** | Accent cyan / amber outline (`ring-2 ring-cyan-500`) | Standard active input typography |
| **Valid / Filled** | Clean border with optional subtle green check icon | Formatted value (e.g., `8.50 m`, `045°`) |
| **Validation Error (Blocked)** | Bold crimson border (`border-rose-500 ring-2 ring-rose-500/30 bg-rose-500/5`), shake animation | *"Tunnel width is required (min 0.5m)"* |

### 2.2 Error Feedback & Toast Alert Design
- **Floating Alert Toast**: Fixed top-center notification with smooth entrance animation, warning icon (`AlertTriangle`), and clear message:
  > *"Cannot advance: Please select a Tunnel Excavation Shape and enter Width, Height, and Chainage before proceeding."*
- **Focus Jumping**: The first empty required input is programmatically targeted with `.focus()` and smooth scrolling so the user immediately lands on what needs attention.

---

## 3. Key Product Decisions & Trade-Offs

### 3.1 Initial Geometry Representation
- **Problem**: In 3D canvases and SVG previews, rendering an empty geometry (`width = 0, height = 0, points = []`) can cause division-by-zero or broken SVG bounding boxes.
- **Decision**: Introduce a distinct `hasValidUserGeometry: boolean` flag. The preview canvas displays a dedicated *"No Shape Selected — Please select a profile shape and enter dimensions"* guidance graphic with dashed outline placeholder rather than crashing or showing arbitrary default geometry.

### 3.2 Granular Mode Enforcement
- **NATM Setup (Step 1 → Step 2 → Step 3)**:
  - Required Step 1: Project Name, Location Name, Chainage (`faceChainage` / `chainage`), Drive Azimuth, and Round Length.
  - Required Step 2 (Geometry): Excavation Shape (must not be unselected), Width (> 0.5m), Height (> 0.5m), Wall Height (> 0.2m).
- **Field Mapping APK Mode (`FieldMappingModeWorkspace`)**:
  - Project setup: Project Name & Location selection required before moving to round setup.
  - Round setup: Round Number, Chainage, and Profile Shape required before entering the drafting canvas.
- **Underground Mining Suite (`MiningFaceSetupWizard`)**:
  - Mine Level, Stope ID, Stope Shape, Width, and Height required before opening face mapping.
- **TBM Mechanized Suite (`TbmWorkflowShell`)**:
  - Ring number, key segment position, and excavation diameter required before recording telemetry.

---

## 4. Technical Architecture & Component Hierarchy

```
┌────────────────────────────────────────────────────────────────────────┐
│                        RootApplicationRouter                           │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│                                App.tsx                                 │
│  - isGeometryValid: boolean                                            │
│  - validationErrors: Record<string, string>                            │
│  - validateStartScreen() -> boolean (Blocks step transition on error)  │
│  - validateManualGeometry() -> boolean                                 │
│  - showValidationToast(msg)                                            │
└───────────────┬───────────────────┬───────────────────┬────────────────┘
                │                   │                   │
  ┌─────────────▼─────────┐ ┌───────▼───────────┐ ┌─────▼──────────────┐
  │   Step 1: Start       │ │ Step 2: Manual    │ │ Field Mode APK     │
  │   Project & Location  │ │ Geometry Screen   │ │ Workspace          │
  │   - Project Input     │ │ - Shape Selector  │ │ - Clean Projects   │
  │   - Chainage Input    │ │ - Width / Height  │ │ - Validation Guard │
  │   - Drive Direction   │ │ - Red Error Rings │ │ - No Auto-Fills    │
  └───────────────────────┘ └───────────────────┘ └────────────────────┘
```

---

## 5. Step-by-Step Implementation Sequence

### Phase 1: Reset Default States in `App.tsx`
1. **Geometry Initial State**:
   - Initialize `manWidth: ''`, `manHeight: ''`, `manWallHeight: ''`, `manCrownRadius: ''`.
   - Initialize `manProfileType: ''` (unselected string).
   - Set initial `geometry` dimensions to unselected / blank placeholders until explicitly configured.
2. **Settings Initial State**:
   - Set `settings.projectName: ''`, `settings.locationName: ''`, `settings.tunnelName: ''`.
   - Set `settings.driveDirectionInput: ''`, `settings.chainage: ''`, `settings.faceChainage: ''`.
   - Set `settings.roundLength: 0` (or `''` in form inputs).
3. **Demo Data Removal**:
   - Remove or deprecate automated sample injection triggers that automatically fill dummy values upon window open.

### Phase 2: Form Controls & Validation Hooks
1. **Dropdown Select Placeholders**:
   - Add `<option value="">-- Select Tunnel Excavation Shape --</option>` as the disabled/default initial selection across:
     - `GeometryManualScreen.tsx`
     - `App.tsx` (Step 1 quick shapes)
     - `FreeformCustomProfileEditor.tsx`
     - `FieldMappingModeWorkspace.tsx`
     - `MiningFaceSetupWizard.tsx`
2. **Visual Error Indicator Classes**:
   - Create unified utility classes for form inputs:
     ```ts
     const getInputClass = (hasError: boolean) =>
       hasError
         ? 'border-rose-500 ring-2 ring-rose-500/25 bg-rose-500/5 focus:border-rose-600 focus:ring-rose-600'
         : 'border-slate-300 dark:border-slate-700 focus:border-cyan-500 focus:ring-cyan-500';
     ```
   - Render inline error messages beneath flagged select boxes and numeric inputs.

### Phase 3: Navigation Interlocks & Guard Functions
1. **Step 1 (`screen === 'start'`)**:
   - Intercept `navigateScreen('drive_and_photos')` and `setScreen('geometry_manual')`.
   - Validate `projectName`, `locationName`, `chainage`, `driveDirectionInput`, and selected shape.
   - If invalid: update `validationErrors`, set `attemptedSubmit: true`, scroll to and focus the first invalid field, and display a warning toast.
2. **Step 2 (`screen === 'geometry_manual'`)**:
   - Intercept `handleApplyManualGeometry()`.
   - Ensure shape is chosen (`manProfileType !== ''`) and dimensions (`manWidth`, `manHeight`, `manWallHeight`) are positive numbers.
   - If missing: highlight select box and empty fields with red borders, block navigation, and display warning toast.
3. **Field Mapping Mode (`FieldMappingModeWorkspace.tsx`)**:
   - Intercept stage forward navigation (`nextStage`).
   - Guard each stage with mandatory parameter checks before allowing stage advancement.

### Phase 4: Empty Preview Fallback Display
- Update the SVG / 2D Cross-section preview cards:
  - When no shape or dimensions are selected, show a clear dashed silhouette with prompt text:
    *"Select shape & enter width/height to view cross-section"*.
  - Prevents rendering degenerate (0×0) geometries while maintaining UI responsiveness.

---

## 6. Verification & Quality Gates

- **Initial Load Check**: Verify that when the app opens fresh, Project, Location, Chainage, Shape, and Dimensions are completely empty.
- **Select Box Initial State**: Verify dropdowns show `-- Select Tunnel Shape --` with value `""`.
- **Validation Trigger**: Attempt to click "Next" / "Proceed" without selecting a shape or filling project details.
  - Verify that navigation does NOT proceed.
  - Verify that missing fields receive red borders and warning highlights.
  - Verify that the first empty input is automatically focused.
  - Verify that an alert toast pops up with clear instructions.
- **Successful Transition**: Fill valid data (e.g., Project "Project Alpha", Location "Heading 1", Shape "Horseshoe", Width "8.5", Height "7.2") and click "Next". Verify that the app transitions smoothly to the next window.
- **Compilation & Build**: Run `compile_applet` and `lint_applet` to ensure zero regressions or broken types.
