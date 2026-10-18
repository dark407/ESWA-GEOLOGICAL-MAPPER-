# AI_HANDOFF.md — PERMANENT GITHUB ACCOUNT-SWITCH MEMORY
**PROJECT:** AKASH TUNNEL MAPPER (ESWA TUNNEL SUITE / ESWACAD)  
**PURPOSE:** When hitting an AI Studio account quota limit, committing to GitHub, and resuming in a new Google AI Studio session or account, this document provides instant, lossless project context, architectural invariants, and active task progress.

---

## 1. PERMANENT SYSTEM ARCHITECTURE & NON-NEGOTIABLE GUARDRAILS

### Project & Ecosystem Overview
- **Project Name:** AKASH TUNNEL MAPPER (ESWA TUNNEL SUITE / ESWACAD)
- **Author & Master Admin:** Akash Dhanush / Dhoni Akash (`dhoniakash407@gmail.com`)
- **Repository Scope:** Full-stack desktop, mobile & cloud tunnel engineering suite for underground geological joint tracing, photogrammetric reconstruction, kinematic rock wedge analysis, overbreak/undercut detection, 3D structural orientation, rock mass classification (Q-System, RMR89, GSI), and multi-pull continuous strip tunnel 3D modeling.

### Tech Stack Specifications
- **Frontend Framework:** React 19 SPA, TypeScript 5.7, Vite 6, Tailwind CSS v4 (`@tailwindcss/vite` with `@import "tailwindcss";`).
- **Backend API & Middleware:** Express (`server.ts`) running on `0.0.0.0:3000` with `vite.middlewares` mounted in development mode.
- **Database & Realtime Auth:** Firebase v11.4 Firestore with `experimentalForceLongPolling: true` (Database ID: `ai-studio-eswatunnelmapper-f9204c8f-e68c-461b-9014-9cb7c208d62c`, Project: `analog-bricolage-rf38q`).
- **Offline & Standalone Engine:** `src/engine/desktopBridge.ts` providing pre-mount storage hydration, SQLite/IndexedDB persistence, and local mock fallbacks for native Android APKs (`file:///android_asset/www/index.html`) and Windows offline PC installations (`file:///` or `.EXE`).

### Protected Core Modules (MUST REMAIN INTACT)
All proprietary engines in `src/engine/*` and specialized workspaces in `src/components/*` are mathematically validated and must never be stripped, replaced with generic stubs, or deleted:
1. `src/engine/orientationEngine.ts` — 3D geological planar vectors, true dip direction $\alpha_d$, true dip angle $\beta$, and strike calculations relative to tunnel drive axis $\alpha_{\text{drive}}$.
2. `src/engine/dipDirWarpEngine.ts` — Homography warping, orthorectification, and affine transforms for rock face photographs.
3. `src/engine/kinematicEngine.ts` — Stereonet stereographic projections, Markland kinematic test for planar, wedge, and toppling rock slope/tunnel failures.
4. `src/engine/overbreakUndercutEngine.ts` — Design vs. actual excavation perimeter delta, volume overbreak calculations, and underbreak clearance boq.
5. `src/engine/customProfileEngine.ts` — D-shaped, horseshoe, circular, elliptical, and freeform CAD segment geometry generation.
6. `src/engine/continuous3DStripEngine.ts` — Multi-round continuous tunnel drive progression, pull logging, and unrolled strip mapping.
7. `src/engine/pcPhotometric3DTwinEngine.ts` — Photogrammetry 3D mesh extrusion and texture projection mapping.
8. `src/engine/cadParser.ts` — DXF / DWG polyline and layer extraction.
9. `src/engine/cvPipeline.ts` — Computer vision ridge filters (Sobel + CLAHE) and hybrid Gemini AI discontinuity segmentation.
10. `src/engine/supportSpotBoltFailureEngine.ts` — Rock bolt density, shotcrete thickness, and Factor of Safety (FoS) calculations.
11. `src/engine/softwareLicensingEngine.ts` — Hardware-fingerprint AES/HMAC cryptographic tokens, runtime integrity checks, and anti-tamper lockouts.
12. `src/engine/windowsDesktopEngine.ts` — Native Windows PE32 launcher generator, offline installer builder, and release manager.
13. `src/engine/desktopBridge.ts` — Universal offline storage bridge and API interceptor.
14. Key Workspaces in `src/components/*`: `FieldMappingModeWorkspace.tsx`, `MappingWorkspace.tsx`, `Photogrammetry3DTunnelWorkspace.tsx`, `PcPhotometric3DTwinWorkspace.tsx`, `FreeformCustomProfileEditor.tsx`, `CoreLoggingWorkspace.tsx`, `MasterAdminPortalWebsite.tsx`, `SoftwareAccessGateAndUpdater.tsx`, `EswaAiExecutiveChatbot.tsx`, `KinematicAnalysisModal.tsx`.

### Strict Workflow Mode Separation
- **Mode 1: Field Mapping Workflow (`workflowMode === 'field_mapping'`):**
  - Uses ONLY the single tunnel geometry CAD canvas (`stage === 'field_canvas'`).
  - Completely bypasses photo upload, photo fitting/calibration, and photo distortion tabs.
  - Geologist traces joints, lithology contacts, and structural symbols directly onto the vector tunnel cross-section.
- **Mode 2: Photogrammetry Workflow (`workflowMode === 'photo_mapping'`):**
  - Follows the structured 4-step sequence:
    1. Photo Upload & Distortion Correction (`cameraCalibration.ts`).
    2. Tunnel Outline Fitting & Homography Calibration (`stage === 'photo_calibration'`).
    3. Dual-Synced Synced Canvas (`stage === 'field_canvas'`, right-hand photo viewport synced with left-hand CAD face).
    4. 3D Photogrammetric Mesh Generation & Texture Projection.

### Mathematical & Coordinate Invariants
- **Photo Coordinates:** Normalized coordinates $u, v \in [0.0, 1.0]$ where $(0,0)$ is top-left and $(1,1)$ is bottom-right.
- **Dip Angle ($\beta$):** Strictly clamped between $[00^\circ, 90^\circ]$.
- **Dip Direction ($\alpha_d$):** Strictly $[000^\circ, 360^\circ]$ referenced to True North, calculated using tunnel drive azimuth $\alpha_{\text{drive}}$.
- **Tunnel Space:** Stationing/Chainage (Ch. $0+000.00$ to $0+999.99$), Easting, Northing, Elevation in meters.

### Security, Licensing & Admin Guardrails
- **Server-Side AI SDK:** `@google/genai` is loaded strictly server-side in `server.ts`. Never import Google Gen AI SDK in client files.
- **Master Admin Lock:** The Master Admin account is locked exclusively to `dhoniakash407@gmail.com` (and `akashdhanusheswar@gmail.com`).
- **Hardware-Locked Client Licensing:** 1-PC 1-Time activation keyed to SHA-256 machine hardware fingerprint (`boundPcHardwareId`) with AES/HMAC obfuscated storage tokens.
- **Gateway Authentication:** `/api/ai/*`, `/api/geometry/*`, and `/api/ota/*` require `X-ESWA-Hardware-ID` and `X-ESWA-Signature` validated by `eswaProprietaryGatewayGuard` in `server.ts`.
- **Compiler Hardening:** `build.sourcemap: false` strictly in production, drop `console` & `debugger`, minify identifiers, strip comments/notices, and hash internal engine chunks into `assets/[hash].js`.

---

## 2. MANDATORY "CHECKPOINT-FIRST" RULE FOR ALL FUTURE UPDATES

Whenever a new user prompt is received:
1. **Step 1 (First Action):** Edit `/AI_HANDOFF.md` under the **"ACTIVE TASK CHECKPOINT"** section. Specify the objective and checklist of target files (`[ ] path/to/file`).
2. **Step 2 (Execution):** Apply the planned surgical modifications file by file without touching unrelated features.
3. **Step 3 (Checkpoint Updates):** Mark each file `[x]` as edits are verified.
4. **Step 4 (Completion):** Run `compile_applet` / `lint_applet` and clear the active task checkpoint upon success.

*Why this is mandatory:* If an AI Studio token quota or rate limit halts the conversation mid-stream, the next account that pulls the GitHub repository can immediately read `/AI_HANDOFF.md` and resume exactly where the previous turn left off without loss of context.

---

## 3. COMPLETED MILESTONES & ACTIVE TASK CHECKPOINT

### Completed Milestones
- [x] **Milestone 1:** High-accuracy rock mass classification core (Q-System, RMR89, GSI).
- [x] **Milestone 2:** 3D structural orientation engine & Markland kinematic stereonet wedge analysis.
- [x] **Milestone 3:** Hybrid Computer Vision (CLAHE/Sobel) + Gemini geological discontinuity segmentation.
- [x] **Milestone 4:** Freeform DXF/DWG custom tunnel cross-section parser and parametric CAD editor.
- [x] **Milestone 5:** Dual synced face mapping workspace with normalized coordinate calibration.
- [x] **Milestone 6:** Standalone offline Android 14 APK packaging (`ESWA-TUNNEL-MAPPER-User-Android.apk`).
- [x] **Milestone 7:** Standalone native Windows PE32 `.EXE` generator & offline `.BAT` desktop installer.
- [x] **Milestone 8:** 1-PC 1-Time hardware-bound licensing portal & Master Admin live control center.
- [x] **Milestone 9:** Phase 3 Enterprise IP protection, compiler sourcemap stripping, Anti-DevTools runtime shield, and HMAC hardware token integrity locks.
- [x] **Milestone 10:** Surgical Rebrand to "ESWA GEOLOGICAL MAPPER", authoritative Owner `akashdhanusheswar@gmail.com`, top-left high-contrast segmented Mode Switcher (`NATM` | `TBM` | `MINING`) with completely isolated domain states, and full Underground Mining Face Mapping & Grade Control Workspace (Laubscher MRMR, Mathews-Potvin open stope stability, mineralized veins, assay channel samples).

---

### ACTIVE TASK CHECKPOINT
<!-- FUTURE AI SESSIONS: Check this section first. If a task is active, resume from the first unchecked [ ] file. -->

- **Current Status:** COMPLETED (Milestone 10 verified)
- **Active Task:** None (All files for Rebrand to "ESWA GEOLOGICAL MAPPER", 3-Mode Switcher NATM|TBM|MINING, and Full Underground Mining Face Mapping Workspace are complete)
- **Target Files Checklist:**
  - [x] `index.html` (Rebranded browser title, meta description, and application name)
  - [x] `package.json` (Rebranded package name, build productName, and exe artifact name)
  - [x] `firestore.rules` (Authoritative Owner updated to `akashdhanusheswar@gmail.com`)
  - [x] `server.ts` (API gateway, automated welcome emails, and desktop installers updated to `akashdhanusheswar@gmail.com`)
  - [x] `src/engine/softwareLicensingEngine.ts` (Master Admin updated to `akashdhanusheswar@gmail.com`)
  - [x] `src/components/MasterAdminPortalWebsite.tsx` (Official GitHub updates & SMTP approval notifications)
  - [x] `src/RootApplicationRouter.tsx` (Master vs User desktop and Android APK router)
  - [x] `src/components/EswaAiExecutiveChatbot.tsx` (Branded as ESWA GEOLOGICAL MAPPER)
  - [x] `src/engine/windowsDesktopEngine.ts` (Standalone offline PC installer generator)
  - [x] `src/engine/sheetLayoutEngine.ts` (Dynamic title block: NATM / TBM / MINING)
  - [x] `src/engine/pdfAndWordExportEngine.ts` (PDF and Word exports branded as ESWA GEOLOGICAL MAPPER)
  - [x] `src/components/EngineeringSheetModal.tsx` (A3/A4 engineering title blocks)
  - [x] `src/components/A3ContinuousTunnelLogModal.tsx` (Continuous strip logs)
  - [x] `metadata.json` (ESWA Geological Mapper name & description)
  - [x] `src/types/tunnel.ts` (IndustryMode, MiningStopeSettings, TbmMachineParameters, LaubscherMrmrParameters, MathewsStabilityParameters)
  - [x] `src/engine/rockMassClassificationEngine.ts` (calculateLaubscherMrmr, calculateMathewsStability registered in classification registry)
  - [x] `src/engine/kinematicsSupportAndDxfEngine.ts` (Support recommendations and DXF exports)
  - [x] `src/engine/coreLoggingEngine.ts` (Mining assay grade and ore zone support for borehole core logging)
  - [x] `src/components/CoreLoggingWorkspace.tsx` (Geotechnical & exploration diamond core runs)
  - [x] `src/components/GeologyAndQIndexDrawer.tsx` (Interactive Laubscher MRMR and Mathews-Potvin open stope stability cards)
  - [x] `src/components/MappingWorkspace.tsx` (Main workspace compatibility)
  - [x] `src/components/FieldMappingModeWorkspace.tsx` (Top-left mode switcher, mining stope & TBM inspectors)
  - [x] `src/components/MiningStopeFaceInspectorModal.tsx` (Full mining stope setup, grade control, vein tracing, channel samples, Mathews-Potvin graph)
  - [x] `src/components/TbmShieldInspectorModal.tsx` (TBM shield thrust, torque, penetration, annulus grout pressure, cutter wear)
  - [x] `src/App.tsx` (Top-left mode switcher, isolated industryWorkspaces state management)
- **Notes / Last Known State:**
  - Full build and compilation verified with zero errors. Ready for production deployment and field operations.

