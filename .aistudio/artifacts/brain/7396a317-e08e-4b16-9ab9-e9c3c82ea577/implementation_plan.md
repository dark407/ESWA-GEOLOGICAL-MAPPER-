# Zero-Default Strict Parameter Input & "Not Selected" Verification Plan

Comprehensive architectural and user-experience plan to eliminate synthetic pre-selected defaults across the entire application lifecycle (Project Setup, Tunnel Geometry, Lithology, Barton Q, Bieniawski RMR89, and Hoek-Brown GSI), enforcing high-contrast amber "Not Selected" indicators and strict "Not Assessed" classification gates.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The following decisions were explicitly confirmed by the user in Phase 1 clarification:
> - **Scope of Zero Defaults**: Applied universally across **All workflows** (Project Setup, Heading / Tunnel Geometry, Field Excavation Rounds, Lithology / Discontinuity parameters, and Geotechnical Classifications).
> - **Unselected State Representation**: Whenever an option or field is unchosen, render a high-contrast amber status badge: `Not Selected · Tap to Choose / Enter`, with an active prompt banner indicating completion is required.
> - **Classification Evaluation Invariant**: When any mandatory classification parameter is unselected, Barton Q, Bieniawski RMR, and Hoek-Brown GSI strictly evaluate to `Not Assessed` (never defaulting to partial synthetic scores or dummy fallback values).

- **Confirmed Decision 1**: Fields will no longer initialize with synthetic boilerplate values (e.g., no default 135° drive azimuth, no auto-selected "Quartzite", no pre-checked "Dripping" water condition, and no pre-filled Barton Q numbers).
- **Confirmed Decision 2**: Interactive controls (segmented buttons, dropdown pickers, and numeric fields) will support an explicit empty/unselected initial state `null | undefined` with amber `Not Selected` visual indicators.

---

## 1. Overview & Core Concept

Underground tunnel and mine mapping requires absolute engineering accountability. If software automatically pre-populates default rock mass parameters (such as $RQD = 75\%$, $J_n = 9$, or D-shaped 8.5m geometry), an engineer might unknowingly export reports with synthetic data rather than site-verified physical measurements.

This update transitions the entire application to an **Explicit Field Assessment Architecture**:
1. **Zero Pre-Selected Defaults**: All new projects, heading locations, excavation rounds, geometric cross-sections, and geotechnical matrices start in an unselected, clean state.
2. **Prominent "Not Selected" Visual Cues**: Any unchosen option displays a high-visibility amber badge (`bg-amber-950/40 border border-amber-500/50 text-amber-300 font-mono text-xs`) prompting the user to feed authentic data.
3. **Calculated Gating & Audit Readiness**: Rock mass classification ratings (Barton Q, RMR89, GSI) remain strictly flagged as `Not Assessed` until 100% of required parameters are explicitly entered by the geologist.

---

## 2. User Experience & Visual Design

### Key User Flows

```
┌────────────────────────────────┐
│  New Project / Round Launch    │ ──> All parameters blank / unselected
└───────────────┬────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────┐
│ Visual State: "Not Selected" Amber Indicators                │
│ • Tunnel Shape: [Not Selected ⚠️]                           │
│ • Drive Azimuth: [___° · Required]                          │
│ • Lithology: [Not Selected · Tap to Assign]                 │
│ • Q-System: [Not Assessed — 6 Parameters Missing]           │
└───────────────┬─────────────────────────────────────────────┘
                │
                ▼ (User feeds real data)
┌─────────────────────────────────────────────────────────────┐
│ Real-Time Verification & Bound Clamping                     │
│ • Verified Azimuth [000°–360°]                              │
│ • Validated ISRM / Barton Param [Jn, Jr, Ja, Jw, SRF]       │
│ • Status updates to [Verified ✓ Emerald]                    │
└───────────────┬─────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────┐
│ Final Classification & Verified Export                      │
│ • Barton Q & RMR89 calculate only when complete             │
│ • Data Sheets & Reports export 100% authentic site records  │
└─────────────────────────────────────────────────────────────┘
```

### Visual Identity & Theme Tokens
- **"Not Selected" Badge**: High-contrast amber warning badge adhering to the anti-slop guidelines:
  ```css
  bg-amber-950/40 border border-amber-500/60 text-amber-300 font-mono text-xs px-2.5 py-1 rounded
  ```
- **"Not Assessed" Indicator**: Quiet slate badge for incomplete ratings:
  ```css
  bg-slate-900/60 border border-slate-700 text-slate-400 font-mono text-xs px-2.5 py-1 rounded
  ```
- **Prompt Banner**: Warning toast / banner above action buttons if the user attempts to proceed without selecting required fields:
  ```css
  bg-amber-500/10 border-l-4 border-amber-500 p-3 text-amber-200 text-xs font-mono
  ```

---

## 3. Key Product Decisions & Trade-Offs

### Decision 1: Nullable Parameter Types vs. Zero Sentinel Values
- **Chosen Approach**: Transition `RmrParameters`, `QIndexParameters`, and `TunnelSettings` to strictly support nullable fields (`null | undefined`) rather than using `0` as an unassigned sentinel.
- **Why**: In rock mechanics, `0` is a valid mathematical value (e.g., $0^\circ$ True North drive azimuth, $0\text{ MPa}$ UCS lower bound, or $0\text{ mm}$ shotcrete). Using `0` creates dangerous ambiguity between "user entered zero" and "unassigned default". `null` guarantees intentionality.

### Decision 2: Clear "Tap to Select" Segmented Controls
- **Chosen Approach**: Segmented button groups (such as Shape selection: D-Shaped, Horseshoe, Circular, or Excavation Approach: Full Face, Heading & Bench) will initialize with none active if unchosen, displaying an amber `Not Selected` prompt above the group until the user makes an explicit selection.
- **Why**: Eliminates passive acceptance of whichever button was first in the DOM list.

### Decision 3: Non-Blocking Mapping vs. Strict Classification Gating
- **Chosen Approach**: Allow geologists to freely trace joint lines and sketch on the CAD canvas even if geotechnical classification parameters are still pending; but strictly gate the Q-System, RMR, and GSI classification results as `Not Assessed` on all canvases, inspection sheets, and exports.
- **Why**: Respects rapid field workflows where joint geometry is traced at the face first, and laboratory UCS or joint surface roughness index is assessed later at the site office.

---

## 4. Technical Architecture & Data Strategy

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             Global State Store                              │
│  • TunnelSettings: { driveDirection: number | null, ... }                   │
│  • TunnelGeometry: { width: number | null, height: number | null, ... }     │
│  • QIndexParameters: { rqd: number | null, jn: number | null, ... }        │
│  • ParameterInputStatus: Record<ParamKey, 'assessed' | 'not_assessed'>      │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                   ┌───────────────────┴───────────────────┐
                   ▼                                       ▼
┌──────────────────────────────────────┐  ┌───────────────────────────────────┐
│     Project & Geotech Modal UI       │  │   Field Mapping Mode Workspace    │
│ • ClampedNumericInput (empty state)  │  │ • Empty-state segmented controls  │
│ • Amber "Not Selected" badges        │  │ • Unassigned Lithology / Water    │
│ • Real-time field prompts            │  │ • Explicit selection triggers     │
└──────────────────┬───────────────────┘  └─────────────────┬─────────────────┘
                   │                                        │
                   └───────────────────┬────────────────────┘
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                   Rock Mass Classification Engine Check                     │
│   evaluateQSystemWithValidation() / calculateBieniawskiRmr()                │
│   • If ANY required field is null/unassessed -> isComplete = false          │
│   • Returns: qValue = null, label = "Not Assessed"                          │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                   ┌───────────────────┴───────────────────┐
                   ▼                                       ▼
┌──────────────────────────────────────┐  ┌───────────────────────────────────┐
│    Engineering Sheet (SVG / Canvas)  │  │    PDF & Word Export Engine       │
│ • Amber / Slate "Not Assessed" box   │  │ • Clean ISO tables:               │
│ • Zero synthetic default values      │  │   "Not Assessed" across all rows  │
└──────────────────────────────────────┘  └───────────────────────────────────┘
```

### Components to Update in Execution Phase:
1. `src/types/tunnel.ts`: Allow nullable parameter values in `TunnelSettings`, `TunnelGeometry`, `RmrParameters`, and `QIndexParameters`.
2. `src/engine/rockMassClassificationEngine.ts`: Update default parameter initializers to return unassessed (`null`) states, with validation checks ensuring no calculation occurs until all mandatory parameters are populated.
3. `src/components/ClampedNumericInput.tsx`: Enhance support for empty/null states with an amber `Not Selected · Tap to Enter` badge and clear input placeholder.
4. `src/components/ProjectConfigurationAndGeotechModal.tsx`: Render amber `Not Selected` indicators for unselected dropdowns and segmented controls; display prompt banners for missing data.
5. `src/components/FieldMappingModeWorkspace.tsx`: Initialize new projects, locations, and rounds with zero defaults, showing `Not Selected` indicators across form fields.
6. `src/engine/pdfAndWordExportEngine.ts` & `src/components/EngineeringSheetModal.tsx`: Maintain the strict `Not Assessed` status across all export channels.
