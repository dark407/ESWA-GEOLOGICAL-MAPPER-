# Continuous Tunnel Logging & A3 Engineering CAD Suite

This plan implements **Continuous Tunnel Logging** directly accessible from the main window below Underground Face Mapping. It provides a guided workflow: selecting from existing **Underground Face Mapping Projects & Locations**, specifying the **Chainage Range (From – To)**, generating an **A3-size Continuous Log Working Window** modeled on the standard *As-Built Power Tunnel Log*, providing a focused **ESWA CAD Strip Editor** to edit geology layers, joints, support, and annotations, and supporting **1-click High-Resolution A3 Landscape PDF Export** and **Send for Review** device sync.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The following core product decisions were confirmed during Phase 1 clarification and govern this implementation:

- **Confirmed Decision 1 — Existing Face Round Auto-Stitching**: The continuous log automatically aggregates and stitches all mapped excavation face rounds found between the chosen `From` and `To` chainages, interpolating unwrapped wall-crown-wall geology while leaving missing gaps clearly marked and editable.
- **Confirmed Decision 2 — Continuous CAD Editor Capabilities**: Clicking **Edit Log in CAD** opens a dedicated, streamlined CAD workspace focused on the continuous tunnel strip canvas with full toolsets for geology lithology layers/zones, joint traces (JS1 foliation, JS2, JS3, shear zones, faults with dip/dip direction), rock support symbols, groundwater points, and text callouts.
- **Confirmed Decision 3 — A3 Report Export & Peer Review**: The A3 working window provides both **high-resolution A3 Landscape PDF export** (true 420mm × 297mm vector/canvas print standard) and **Send for Review** device sync (via the existing 6-character Device ID review center), matching the Underground Face Mapping workflow.

---

## 1. Overview & Core Concept

- **What It Does**:
  1. **Launcher Integration**: Directly beneath the **Underground Face Mapping** button on the Main Welcome Window, adds a prominent **Continuous Tunnel Logging** button.
  2. **Filtered Project & Location Selector**: Clicking the button opens a modal that lists **only** projects and tunnel locations that currently exist in Underground Face Mapping (user constraint: locations cannot be arbitrarily created here; they come directly from existing face mapping records).
  3. **Chainage Range Specification**: After picking an existing location, the user specifies the chainage interval (`Chainage From` to `Chainage To`, with auto-detected minimum and maximum chainages from recorded rounds).
  4. **A3 Working Window (*As-Built Power Tunnel Log* Standard)**:
     - Header block with Client, Consultant, Contractor, Project, Drawing No, Scale 1:100, Revision, Dates, and Geologist signatures.
     - Drive Azimuth, Gradient, and Tunnel Axis telemetry.
     - **Unwrapped Continuous Tunnel Strip Canvas**:
       * Upper Zone: Left Wall to Crown (Spring Line)
       * Center Arch: Crown Arch Centerline
       * Lower Zone: Crown to Right Wall (Spring Line)
       * Chainage scale bar with 1-meter tick marks and 5-meter major labels
       * Geology strata bands / lithology hatchings
       * Joint traces (JS1, JS2, JS3, shear joints, faults) with dip direction / dip labels (`065°/45°`, `205°/75°`)
       * Groundwater seepage symbols (Dry, Moist, Dripping, Flowing)
     - **Geotechnical Parameters & Rock Support Table** (column-by-column per pull interval):
       * Rock Type, Description, Weathering (W1–W5), UCS Range (MPa)
       * RMR & RQD ratings and longitudinal trend lines
       * Q-System ratings & GSI
       * Seepage conditions & geological structural descriptions
       * Installed support details (Shotcrete, Wire Mesh, Rock Bolts, Steel Ribs, Forepoling)
       * Photo roll & negative reference numbers
  5. **ESWA CAD Strip Editor**:
     - Clicking **Edit Log in CAD** opens a full-screen, clean CAD workspace dedicated exclusively to the continuous strip canvas.
     - Tools for editing geology boundaries, joint traces, structural attributes, water seepage symbols, and annotations from A to Z.
     - One-click **Save & Update A3 Report** immediately updates the A3 working sheet.
  6. **A3 Export & Review Flow**:
     - **Save & Send for Review**: Packages the continuous log and sends it to a reviewer's Device ID just like Underground Face Mapping.
     - **Download High-Resolution A3 PDF**: Vector/canvas PDF output formatted for standard A3 landscape drafting sheets.
     - **Export DXF (AutoCAD)**: Clean layered DXF for civil/mining CAD engineering.
- **Target Audience**: Field engineering geologists, tunnel geotechnical engineers, and project managers logging linear underground excavations.
- **Key Value**: Bridges single-face mapping and linear tunnel chainage logging into one seamless workflow without complex external CAD software, producing standard compliance logs ready for submission.

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Launcher Flow**:
     - User lands on Welcome Window.
     - Directly below **Underground Face Mapping**, clicks **Continuous Tunnel Logging**.
  2. **Project & Location Selection Modal**:
     - Modal queries stored Underground Face Mapping records (`savedProjects` and `field_mapping_rounds`).
     - Displays selectable Project cards and associated Tunnel Locations with round counts and mapped chainage range (e.g. `Adani Rithwik Power Tunnel · Ch. 250m to 300m · 10 Rounds Mapped`).
     - Once location is chosen, prompts for `Chainage From (m)` and `Chainage To (m)`.
     - User clicks **Open A3 Continuous Log**.
  3. **A3 Working Window Flow**:
     - Opens a full-screen A3 Landscape engineering viewer (adaptive zoom, fit-to-width, pan).
     - Renders the complete drawing frame, title block, unwrapped 3D strip, and parameter table.
     - Top Action Bar:
       * **Edit Log in CAD**: Switches to CAD editing mode.
       * **Export A3 PDF**: Downloads publication-ready A3 Landscape PDF.
       * **Export DXF**: Downloads layered AutoCAD DXF file.
       * **Send for Review (`⏳`)**: Opens Device ID peer review modal.
       * **Close / Back to Main**: Returns to launcher.
  4. **ESWA Continuous CAD Editor Flow**:
     - Streamlined CAD interface with dark precision canvas (`#0F172A`), engineering coordinate grid, and zoom/pan controls.
     - Left Toolbar:
       * Select / Move / Inspect
       * Joint Trace Tool (JS1 Foliation, JS2 Main, JS3, Shear Zone, Fault) with auto-dip direction labeler
       * Lithology Zone Polygon Tool (Quartzite, Phyllite, Metasandstone, Schist, etc.)
       * Water Seepage Tool (Dry, Moist, Wet, Dripping, Flowing)
       * Support Symbol & Dimension Annotations
       * AI Trend Alignment Tool (smooths discontinuous traces across pull seams)
     - Right Inspector Panel:
       * Selected entity properties (Dip, Dip Direction, Thickness, Rock Type, Notes)
     - Top Bar: **Save & Update A3 Report** button returns to A3 window with real-time updates.

- **Visual Identity & Theme**:
  - *Aesthetic Direction*: Precision geotechnical drafting room aesthetic conforming to ESWA design standards.
  - *Color Palette*:
    * Dark Workspace Frame: Obsidian Slate (`#0B0F19`) and Deep Navy (`#0F172A`)
    * A3 Sheet Surface: Crisp Drafting White (`#FFFFFF`) with technical hairline borders (`#CBD5E1`)
    * Geological Strata Ramps: Realistic geological fills (Quartzite buff `#FDE68A`, Phyllite silvery green `#A7F3D0`, Metasandstone earthy `#FDBA74`, Schist slate `#CBD5E1`)
    * Structural Accents: Foliation JS1 cobalt (`#2563EB`), Shear Zone / Fault crimson (`#DC2626`), Water cyan (`#06B6D4`)
  - *Typography*:
    * Title Block & Section Titles: Clean technical display sans (`Plus Jakarta Sans`)
    * Chainages, Coordinates, RMR/Q Values: Strict monospace tabular numerals (`JetBrains Mono` / `tabular-nums`)

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Strict Sourcing from Underground Face Mapping**
  - *Chosen Approach*: Only list projects and tunnel locations that exist in Underground Face Mapping records. If a user hasn't mapped any underground rounds yet, provide pre-configured benchmark references (such as the *Power Tunnel Ch. 250–300m* from the uploaded PDF) so they can immediately test and explore without getting stuck.
  - *Why*: Directly aligns with user requirement: *"we cant create it only available based on underground face mapping"*.
- **Decision 2: Dedicated Continuous CAD Editor vs. Reusing Single-Face CAD**
  - *Chosen Approach*: Build a purpose-built `EswaContinuousCadEditor` component optimized specifically for multi-pull unwrapped tunnel strips (Left Wall, Crown, Right Wall) with longitudinal chainage coordinate math, rather than forcing the circular/horseshoe single-face editor.
  - *Why*: Single-face CAD operates in radial polar coordinates for one excavation face; continuous tunnel logging operates in Cartesian unrolled coordinates (`X = Chainage (m)`, `Y = Unwrapped Arc / Wall-Crown-Wall Height (m)`). A dedicated editor is cleaner, faster, and much easier for users to edit A-to-Z.
- **Decision 3: Synchronous Two-Way State Binding**
  - *Chosen Approach*: Edits made in the CAD editor or A3 sheet mutate the active `ContinuousTunnelStripDataset`, immediately saving to local storage and synchronizing with the A3 viewer.
  - *Why*: Guarantees instant reflection without confusing save dialogs or out-of-sync drafts.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

### System Architecture & Workflow Diagram

```
┌───────────────────────────────────────────────────────────────────────────────────┐
│                           MAIN WELCOME WINDOW (App.tsx)                           │
│  ┌───────────────────────────────┐     ┌───────────────────────────────────────┐  │
│  │ Underground Face Mapping      │     │ ⭐️ Continuous Tunnel Logging          │  │
│  │ (3-Step Hierarchy)            │     │ (Button below Underground Face)       │  │
│  └───────────────┬───────────────┘     └───────────────────┬───────────────────┘  │
└──────────────────┼─────────────────────────────────────────┼──────────────────────┘
                   │                                         │
                   ▼                                         ▼
 ┌───────────────────────────────────┐     ┌───────────────────────────────────────┐
 │ Saved Projects & Face Rounds      │◄────┤ Continuous Log Setup Modal            │
 │ (IndexedDB / Local / Firestore)   │     │ • Filter: Existing Projects/Locations │
 └─────────────────┬─────────────────┘     │ • Inputs: Chainage From & To (m)      │
                   │                       └───────────────────┬───────────────────┘
                   │ Auto-Stitch Rounds                        │
                   ▼                                           ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│             A3 CONTINUOUS TUNNEL LOG WORKING WINDOW (A3ContinuousTunnelLogModal) │
│                                                                                  │
│  ┌──────────────────┐  ┌───────────────────────────────────────────────────────┐ │
│  │ Title Block &    │  │ Unwrapped Tunnel Strip (Left Wall · Crown · Rt Wall)  │ │
│  │ Engineering Info │  │ • Chainage Ticks · Lithology Fills · Traces · Water   │ │
│  └──────────────────┘  └───────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────────────────────────┐ │
│  │ Geotechnical Parameters & Support Table (Per-Pull Aligned Summary)          │ │
│  └─────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                  │
│  [ Edit Log in CAD ]   [ Export A3 PDF ]   [ Export DXF ]   [ Send for Review ]  │
└────────────┬──────────────────────────────────────────────────────────┬──────────┘
             │                                                          │
             ▼                                                          ▼
┌──────────────────────────────────────────┐             ┌─────────────────────────┐
│ ESWA CONTINUOUS CAD EDITOR               │             │ PEER REVIEW SYSTEM      │
│ • Full Canvas Zoom/Pan/Grid              │             │ • Device ID Receiver    │
│ • Geology Layers, Joint Traces, Support  │             │ • In-App & OS Alerts    │
│ • Inspector & Layer Toggles              │             │ • Status Updates        │
│ • [ Save & Update A3 Report ]            │             └─────────────────────────┘
└──────────────────────────────────────────┘
```

### Core Components to Build & Wire

1. **`ContinuousLogProjectLocationModal.tsx`**:
   - Queries `savedProjects` and extracts unique projects & locations.
   - Shows existing projects and tunnel headings with round counts.
   - Fallback to pre-loaded reference datasets (*Power Tunnel Log* & *Adani Rithwik Log*) if no saved rounds exist yet.
   - Collects `Chainage From` and `Chainage To`.
   - On submit, builds/syncs the `ContinuousTunnelStripDataset` and launches the A3 window.

2. **`A3ContinuousTunnelLogModal.tsx`**:
   - Complete A3 landscape canvas & SVG rendering engine (dimensions: 420mm × 297mm aspect ratio).
   - Title block, unrolled 3-zone continuous strip (Left Wall, Crown, Right Wall), chainage ruler, joint lines, and geotechnical table.
   - Integrated tools:
     * **Edit Log in CAD**
     * **High-Resolution A3 PDF Export** (single-sheet vector rendering)
     * **DXF Export** (using `exportContinuousStripToDXF`)
     * **Send for Review** (integrating `sendMappingPackageForReview` with Device ID)

3. **`EswaContinuousCadEditor.tsx`**:
   - High-performance interactive HTML5 Canvas / SVG CAD workspace.
   - Tools: Select, Draw Joint Trace (JS1/JS2/JS3/Fault), Draw Lithology Polygon, Add Water Seepage Point, Add Text Annotation, Delete, AI Trend Alignment.
   - Coordinate transform between screen pixels and tunnel chainage/arc coordinates.
   - Inspector panel for real-time attribute editing.
   - Direct return to A3 report.

4. **Integration in `App.tsx`**:
   - Add **Continuous Tunnel Logging** button directly below **Underground Face Mapping** in the Welcome screen.
   - Manage state (`isContinuousLoggerSetupOpen`, `isA3ContinuousLogOpen`, `activeContinuousDataset`, `isContinuousCadEditorOpen`).
   - Wire Device ID review center notifications.

---

## 5. Verification Plan

1. **Launcher Verification**: Ensure the button appears cleanly beneath Underground Face Mapping with consistent styling and responsiveness.
2. **Project & Location Selection**: Verify that only existing face mapping projects/locations are listed, with valid chainage inputs.
3. **A3 Sheet Rendering**: Verify that the A3 landscape working window displays all title block fields, unwrapped strip, chainage ticks, geology layers, joint traces, and parameters table accurately.
4. **CAD Editing Loop**: Open CAD editor, draw/modify joint traces and geology boundaries, save, and confirm changes reflect instantly on the A3 sheet.
5. **PDF & DXF Export**: Test A3 Landscape PDF export and DXF download to confirm crisp output.
6. **Device ID Review**: Test sending the continuous log for review to ensure seamless peer review integration.
7. **Compilation & Linting**: Run `compile_applet` and `lint_applet` to confirm zero build errors or TypeScript issues.
