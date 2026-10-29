# Comprehensive Parameter Input, Physical Bound Clamping & Verified Reporting Workflow

A unified, end-to-end framework enabling geologists to explicitly feed and control every tunnel, geotechnical, and project parameter from initial setup to final engineering reports—enforcing strict real-time physical bounds clamping, eliminating autonomous assumptions, and cleanly badging unentered data as "Not Assessed".

## User Review & Critical Decisions

> [!IMPORTANT]
> The following architectural and user experience decisions have been aligned based on confirmed requirements:

- **Input Bound Enforcement**: All numeric entries (e.g., Drive Direction 0°–360°, Dip 0°–90°, UCS 0.5–500 MPa, RQD 0%–100%, Q parameters) will actively block out-of-bounds typing, immediately clamp values to validated scientific ranges, and present clear parameter range alerts.
- **Dedicated Project Configuration Console**: A centralized, structured Project & Geotechnical Configuration modal accessible across the workflow (header, ribbon, and setup screens) providing unified management of project metadata, drive orientation, excavation dimensions, chainage, RMR89, and Q-system inputs.
- **Reporting & Export Integrity**: Unentered optional parameters across final engineering sheets, PDF/Word exports, and summary logs will never default to synthetic numbers; they will render with a clear, authoritative "Not Assessed" status badge.

---

## 1. Overview & Core Concept

### What It Does
This feature establishes a continuous, transparent data pipeline where every single project variable—from project names, drive azimuth, face chainages, and cross-section spans, to Barton Q and Bieniawski RMR rock ratings—is directly supplied, reviewed, and validated by the geotechnical engineer. Impossible physical values (such as azimuths > 360°, negative pull lengths, or out-of-table friction ratings) are impossible to enter because of real-time range clamps and immediate validation feedback.

### Target Audience & Persona
- **Tunnel Geologists & Geotechnical Engineers**: Field and office engineers demanding uncompromised scientific precision and audit compliance where every reported figure is attributable to verified human inputs.
- **Quality & Supervision Consultants**: Inspectors reviewing final engineering sheets who require clear demarcation between measured geological structures and unassessed rock parameters.

### Key Value Delivered
- Eliminates any remaining autonomous guessing or placeholder data across the entire software suite.
- Enforces ISRM, Bieniawski, and Barton theoretical limits at the point of input.
- Provides a frictionless, dedicated project configuration console for fast parameter entry and updates.

---

## 2. User Experience & Visual Design

### Key User Flows

1. **Project & Drive Setup Flow**:
   - Geologist opens the dedicated **Project Configuration & Geotechnical Parameters Modal** from the top header or CAD ribbon.
   - User inputs tunnel drive azimuth (e.g., typing `375` immediately clamps to `360°` with an amber advisory note: `"Drive azimuth bounded to 0°–360°"`).
   - User inputs face chainage (e.g., `RD 1423.50m`) and round pull length (`3.50m`), with automatic chainage interval calculation (`RD 1420.00m – 1423.50m`).
2. **Rock Mass Ratings (RMR / Q-System) Entry Flow**:
   - Geologist enters intact rock strength (UCS in MPa), drillcore RQD %, joint spacing, joint conditions, and groundwater inflow.
   - Values outside physical bounds (e.g., RQD > 100% or negative UCS) are instantly clamped to their theoretical maxima/minima with clear unit labels (`MPa`, `m`, `%`, `L/min`).
   - If an optional parameter is left blank, it is retained as `null` with a clear "Pending Input" label.
3. **Report & Engineering Sheet Generation Flow**:
   - When generating Final Engineering Sheets, Continuous Strip Logs, or Executive Summaries, entered parameters render with tabular precision.
   - Any parameter without field measurements displays a crisp, neutral `"Not Assessed"` badge (`border border-slate-700 text-slate-400 bg-slate-900/60`), ensuring zero ambiguity for peer review and client sign-off.

### Visual Identity & Layout Architecture
Adhering to the Science, Space & Biotech Design Reference:
- **Palette Budget**: Deep obsidian lab base (`#07090E` / `#0B0E17`), slate card structural containers (`#111827`, `#1E293B`), laser cyan focus rings (`#06B6D4`), and telemetry amber indicators (`#F59E0B`).
- **Typographic Precision**: Technical neo-grotesque UI typography paired with tabular monospace numerals (`font-mono tabular-nums`) for all angles, coordinates, chainages, and physical ratings.
- **Zero-Pill Discipline**: Statuses and metadata render as clean unboxed text separated by subtle dividers (`·` or `/`); interactive switches use functional segmented buttons.
- **Clamped Input Primitive**: Reusable `ClampedNumericInput` component with integrated min/max indicators, active unit badges (`deg`, `m`, `MPa`, `kN`), and micro-warning banners.

---

## 3. Key Product Decisions & Trade-Offs

### Decision 1: Input Clamping vs. Silent Truncation vs. Soft Warnings
- **Chosen Approach**: Hard clamping with real-time feedback banner upon blur or overflow typing.
- **Why**: Hard clamping completely prevents impossible values from polluting downstream calculations, 3D kinematic viewports, and stereonet polar projections, while the feedback banner explains the physical constraint to the engineer.
- **Alternative Considered**: Soft red borders allowing invalid inputs were rejected because downstream mathematical modules could crash or produce physically impossible FoS values.

### Decision 2: Centralized Project Modal vs. Fragmented Screen Edits
- **Chosen Approach**: Dedicated, full-fidelity Project & Geotechnical Configuration Modal accessible from anywhere in the app, while keeping quick-edit properties synchronized.
- **Why**: Allows engineers in the field to update heading azimuth, chainage, or RMR sub-parameters in one cohesive place without losing canvas focus or navigating away from face tracing.
- **Alternative Considered**: Forcing users to return to initial wizard screens caused workflow disruption and state serialization headaches.

### Decision 3: "Not Assessed" Representation in Final Documents
- **Chosen Approach**: Explicit "Not Assessed" designation with unmapped status pill/text across tables, summary boxes, and PDF exports.
- **Why**: In tunnel engineering contracts, missing data must be explicitly reported as unassessed to avoid liability and false confidence during excavation sign-offs.

---

## 4. Technical Architecture & Data Strategy

### System Component Diagram

```
┌────────────────────────────────────────────────────────────────────────┐
│                   Top App Header / CAD Command Bar                     │
│  [Project Name]  ·  [Drive: 070°]  ·  [RD 1423.50m]  ·  [Configure ⚙]   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ opens
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│             ProjectConfigurationAndGeotechModal                        │
│ ┌───────────────────────┐  ┌─────────────────────────────────────────┐ │
│ │ 1. Project & Heading  │  │ ClampedNumericInput:                     │ │
│ │  - Project Name       │  │  Drive Azimuth [0° .. 360°]              │ │
│ │  - Structure / Tunnel │  │  Pull Length   [0.5m .. 12.0m]           │ │
│ │  - Heading / Location │  │  Span / Width  [1.0m .. 35.0m]           │ │
│ ├───────────────────────┤  ├─────────────────────────────────────────┤ │
│ │ 2. RMR89 Inputs       │  │ Clamped Ratings:                         │ │
│ │  - UCS / Point Load   │  │  UCS [0.5 .. 500 MPa]                    │ │
│ │  - RQD %              │  │  RQD [0% .. 100%]                        │ │
│ │  - Joint Spacing      │  │  Spacing [0.01m .. 10.0m]                │ │
│ ├───────────────────────┤  ├─────────────────────────────────────────┤ │
│ │ 3. Barton Q Inputs    │  │ Barton Factors:                          │ │
│ │  - RQD, Jn, Jr, Ja    │  │  Jn [0.5..20], Jr [0.5..4], Ja [0.75..20]│ │
│ │  - Jw, SRF, ESR       │  │  Jw [0.05..1.0], SRF [0.5..200]          │ │
│ └───────────────────────┘  └─────────────────────────────────────────┘ │
│                     [ Apply Validated Parameters ]                     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ syncs state
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      Central Tunnel State Store                        │
│  • TunnelSettings (driveDirection, chainage, roundLength, project)     │
│  • RmrParameters (UCS, RQD, spacing, condition, groundwater | null)    │
│  • QIndexParameters (RQD, Jn, Jr, Ja, Jw, SRF | null)                  │
└───────────────────────┬────────────────────────┬───────────────────────┘
                        │                        │
                        ▼                        ▼
        ┌───────────────────────────────┐ ┌──────────────────────────────┐
        │  Face Canvas & 3D Analytics   │ │  Final Engineering Reports   │
        │  - Traced Joints / Kinematics │ │  - Engineering Sheet Modal   │
        │  - Stereo / Wedge Stability   │ │  - Word / PDF Export Engine  │
        │  - Lockout if missing         │ │  - "Not Assessed" Badges     │
        └───────────────────────────────┘ └──────────────────────────────┘
```

### Data Validation Rules & Ranges

| Parameter | Valid Theoretical Range | Clamp Fallback | Scientific Reference |
| :--- | :--- | :--- | :--- |
| **Drive Direction / Azimuth** | $0^\circ \text{ to } 360^\circ$ | Clamped to $[0, 360]$ | Compass Azimuth |
| **Tunnel Span / Width** | $1.0\text{m to } 35.0\text{m}$ | Clamped to $[1.0, 35.0]$ | ISRM Excavation |
| **Tunnel Height** | $1.0\text{m to } 35.0\text{m}$ | Clamped to $[1.0, 35.0]$ | ISRM Excavation |
| **Round / Pull Length** | $0.5\text{m to } 12.0\text{m}$ | Clamped to $[0.5, 12.0]$ | Drill & Blast Pull |
| **Intact Rock UCS** | $0.5\text{ to } 500\text{ MPa}$ | Clamped to $[0.5, 500]$ | ISRM Rock Strength |
| **Rock Quality Designation (RQD)** | $0\% \text{ to } 100\%$ | Clamped to $[0, 100]$ | Deere et al. (1967) |
| **Discontinuity Spacing** | $0.01\text{m to } 10.0\text{m}$ | Clamped to $[0.01, 10.0]$ | ISRM Discontinuity |
| **Barton Jn (Set Number)** | $0.5\text{ to } 20.0$ | Clamped to $[0.5, 20.0]$ | Barton et al. (1974) |
| **Barton Jr (Roughness)** | $0.5\text{ to } 4.0$ | Clamped to $[0.5, 4.0]$ | Barton et al. (1974) |
| **Barton Ja (Alteration)** | $0.75\text{ to } 20.0$ | Clamped to $[0.75, 20.0]$ | Barton et al. (1974) |
| **Barton Jw (Water Factor)** | $0.05\text{ to } 1.0$ | Clamped to $[0.05, 1.0]$ | Barton et al. (1974) |
| **Barton SRF (Stress Factor)** | $0.5\text{ to } 200.0$ | Clamped to $[0.5, 200.0]$ | Barton et al. (1974) |

### Implementation Phases

1. **Phase 1: Validated Input Primitives & Engine Hooks**
   - Implement `ClampedNumericInput` component with range warnings, unit indicators, and keyboard-safe clamping.
   - Extend `rockMechanicsValidator.ts` with comprehensive clamping and formatting functions for all tunnel/geotech variables.
2. **Phase 2: Project & Geotechnical Configuration Console**
   - Create `ProjectConfigurationAndGeotechModal.tsx` consolidating Project Metadata, Drive Direction, Excavation Geometry, Chainage, RMR89, and Q-System inputs.
   - Wire the modal launcher into the App Header, CAD Ribbon, and Setup screens.
3. **Phase 3: Synchronized State & Screen Form Hardening**
   - Replace raw unvalidated inputs across `DriveAndPhotosScreen.tsx`, `GeometryManualScreen.tsx`, `SheetSettingsAndStorageEditor.tsx`, and `MappingWorkspace.tsx` with validated clamped controls.
4. **Phase 4: Final Report & Export Integrity**
   - Update `EngineeringSheetModal.tsx`, `pdfAndWordExportEngine.ts`, and summary cards to render verified values or clean `"Not Assessed"` badges for unentered fields.
5. **Phase 5: Verification & Compilation**
   - Verify zero compile/lint errors with `compile_applet` and test edge-case inputs (e.g., negative chainage, >360° azimuth, impossible rock ratings).
