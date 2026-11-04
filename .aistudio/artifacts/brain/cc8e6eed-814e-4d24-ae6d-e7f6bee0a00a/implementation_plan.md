# 3D Joint Trace-Hinge Restoration, Main Screen Auto-Update Toggle & Permanent Google Drive Sync

This plan restores the exact geological trace-hinge rotation rules in the 3D Joint Inspection workbench across Underground Face, Sidewalls, Crown, and Surface Mapping (with confirmation warnings before altering trace-locked axes), adds a live Main Screen Update Notification Toggle with 1-click automatic in-app updates, and automates in-place Google Drive file overwrites so your LinkedIn and website download links never change.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> All three core product decisions have been confirmed and are locked into this plan:

- **Confirmed Decision 1 (3D Joint Inspection Hinge & Indication Warning Modal)**:
  - **Underground Face & Sidewalls**: The drawn joint trace acts as the **stationary hinge axis** (representing the visible inclination/dip trace on the vertical face). Rotating the 3D plane pivots strictly around that drawn trace hinge (updating Strike / Dip Direction while keeping the plane pinned to the drawn trace). If the user attempts to change **Dip Amount** directly on the Face, an **Indication Warning Modal** appears first explaining that changing Dip Amount will tilt the plane toward vertical (90°) or horizontal (0°) and alter the trace inclination on the face.
  - **Crown & Surface Mapping (Vice Versa)**: On the Crown and in Surface Mapping, the drawn trace represents the **horizontal Strike trace hinge**. Changing **Dip Amount (0°–90°)** tilts the 3D plane freely up/down around that fixed Strike trace hinge without moving or rotating the trace. If the user attempts to change **Strike / Dip Direction**, an **Indication Warning Modal** appears first explaining that changing Strike Direction will rotate the plane and its strike trace horizontally.
- **Confirmed Decision 2 (Main Screen Update Notification Toggle & 1-Click Auto-Update)**:
  - A dedicated **Update Notification Toggle & Badge** in the User Main Screen top header monitors published software versions in real time. When an update is pushed, a glowing badge and dropdown card appear; clicking **Update Now** automatically updates the user's app/software in-place and reloads into the new build without losing any field mapping data.
- **Confirmed Decision 3 (Permanent Google Drive Link Automation — GitHub Actions + Master Admin 1-Click Sync)**:
  - Both the **GitHub Actions CI/CD workflow** and a **Master Admin Portal 1-Click Drive Sync & Release Publisher** overwrite the **same existing Google Drive File IDs** (`PATCH /upload/drive/v3/files/{fileId}`) for the User APK, User EXE, Master APK, and Master EXE. Because Google Drive preserves the sharing URL when a file's binary content is updated by `fileId`, you never have to change your LinkedIn or website links again.

---

## 1. Overview & Core Concept

- **What It Does**:
  1. Enforces physically accurate 3D discontinuity plane rotation hinged strictly on the mapped 2D trace for both vertical exposures (Face/Walls) and horizontal/overhead exposures (Crown and Surface Mapping), with clear pre-change confirmation modals whenever an edit would detach or rotate the mapped trace.
  2. Eliminates manual release overhead by connecting a 1-click Master Release & Drive Sync pipeline directly to an in-app Main Screen Update Notification Toggle for all active field geologists.
- **Target Audience / Persona**:
  - Field Engineering Geologists and Rock Mechanics Engineers logging underground tunnels, shafts, and surface outcrops, plus the Master Software Owner managing releases across LinkedIn, web portals, Android APKs, and Windows Desktop EXEs.
- **Key Value**:
  - **Zero Geological Drift**: The 3D plane never unexpectedly detaches from the drawn joint trace.
  - **Zero Link Churn**: Updating code no longer requires re-sharing Google Drive links on LinkedIn or your website, or manually messaging users to reinstall.

---

## 2. User Experience & Visual Design

### Key User Flows

1. **Flow A — Underground Face & Wall 3D Joint Inspection (Trace = Inclination Hinge)**:
   - When opening 3D Joint Inspection for a Face or Sidewall joint, the 3D cutting plane is locked to the exact drawn 2D trace line as its hinge axis.
   - The primary slider rotates the plane around the drawn trace hinge (adjusting how steeply the plane cuts into the heading or collar, which derives Strike and Dip Direction).
   - If the user clicks or drags the **Dip Amount** control (or 3D Gizmo dip handle) on a Face joint, an **Indication Warning Modal** opens before applying the change:
     - *"Indication Notice: On the vertical Face, the 3D plane is hinged along your drawn joint trace. Changing Dip Amount directly will tilt the plane toward Vertical (90°) or Horizontal (0°) and change the trace inclination on the face. Do you want to proceed?"*
     - **Keep Locked to Drawn Trace Hinge (Cancel)** vs. **Proceed & Change Dip Amount**.

2. **Flow B — Crown & Surface Mapping 3D Joint Inspection (Vice Versa: Trace = Strike Hinge)**:
   - When opening 3D Joint Inspection for a **Crown** joint or in **Surface Mapping**, the drawn trace is locked as the **Strike Trace Hinge Axis**.
   - Changing **Dip Amount (0°–90°)** smoothly tilts the 3D plane from flat/horizontal to vertical (90°) strictly around the drawn Strike trace axis—the strike direction remains 100% locked to the drawn trace.
   - If the user clicks or drags **Strike Direction / Dip Direction** on a Crown or Surface joint, an **Indication Warning Modal** opens before applying the change:
     - *"Indication Notice: On Crown & Surface Mapping, the 3D plane dips around your drawn Strike trace hinge. Changing Strike / Dip Direction will rotate the entire plane and its strike trace horizontally. Do you want to rotate the plane?"*
     - **Keep Locked to Strike Trace (Cancel)** vs. **Proceed & Rotate Strike Direction**.

3. **Flow C — User Main Screen Update Notification Toggle & 1-Click Auto-Update**:
   - On the User Main Screen top navigation bar, a dedicated **Software Update Notification Toggle** displays the current version status (`v2.8.x`) and an animated badge (`Update Available`) whenever a newer release is published.
   - Users can toggle **Auto-Update Notifications ON/OFF** and click **1-Click Update Software Now** inside the notification popover.
   - Clicking **1-Click Update Software Now** clears stale Service Worker/cache assets, fetches the latest application bundle and release binary in-place, updates the local installed version stamp, and reloads seamlessly with all projects and logs preserved.

4. **Flow D — Permanent Google Drive File-ID Overwrite (GitHub Actions + Master Admin Portal)**:
   - **Master Admin Portal**: Adds a **Release & Google Drive Auto-Sync** bar where you configure your 4 permanent Google Drive File IDs once (User APK, User EXE, Master APK, Master EXE). Clicking **Publish Update & Overwrite Google Drive Files** pushes the live update notification to all users' Main Screens and updates the Google Drive files in-place via their File IDs.
   - **GitHub Actions CI/CD**: Adds an automated step to the build workflow that uses Google Drive API (`PATCH /upload/drive/v3/files/{fileId}?uploadType=media`) with repository secrets (`GDRIVE_SERVICE_ACCOUNT_JSON` or OAuth Refresh Token + the 4 `GDRIVE_*_FILE_ID` secrets) so every `git push` automatically overwrites the exact same Google Drive files and broadcasts the new build version to all connected apps.

### Visual Identity & Theme
- **Aesthetic Direction**: High-precision geotechnical CAD & rock mechanics instrumentation console.
- **Color Palette & Mood**: Deep slate surfaces (`#0F172A`, `#1E293B`) with high-contrast semantic accents:
  - Amber (`#F59E0B`) for Face Hinge & Pre-Change Indication Warning Modals
  - Electric Cyan (`#06B6D4`) for Crown/Surface Strike Hinge & 3D Orientation Controls
  - Emerald (`#10B981`) for Active Cloud/Drive Sync & Live Software Update Badges
- **Typography & Hierarchy**: Crisp sans-serif UI labels paired with tabular monospace numerals (`font-mono tabular-nums`) for all strike/dip angles (`045° / 65°`), trace lengths (`m`), and version numbers.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Strict Separation of Face Hinge Mode vs. Crown/Surface Strike-Hinge Mode**
  - *Chosen Approach*: Automatically detect whether the active inspection is on a vertical excavation wall/face (`panel === 'face' | 'left_wall' | 'right_wall'` in Underground mode) versus a horizontal/overhead exposure (`panel === 'crown'` or `mappingDomain === 'SURFACE'`). Lock the appropriate hinge invariant by default and gate the trace-altering parameter behind the Indication Warning Modal.
  - *Why*: Matches true structural geology principles—a trace on a vertical face constrains apparent dip along the face, whereas a trace on a horizontal crown/surface outcrop constrains the strike azimuth.
- **Decision 2: In-Place Google Drive File Overwrite (`files.update` by `fileId`)**
  - *Chosen Approach*: Overwrite the binary content of pre-existing Google Drive files using their permanent `fileId` rather than deleting and creating new files on each build.
  - *Why*: Creating a new file in Google Drive generates a new `fileId` and breaks every link posted on LinkedIn and websites. Updating an existing `fileId` via `PATCH` updates the file revision while keeping the exact same `https://drive.google.com/file/d/<FILE_ID>/view` link forever.

---

## 4. Technical Architecture & Data Strategy

### Architecture & Component Diagram

```
┌────────────────────────────────────────────────────────────────────────────┐
│                   3D JOINT INSPECTION WORKBENCH (THREE.JS)                 │
├─────────────────────────────────────┬──────────────────────────────────────┤
│   UNDERGROUND FACE & SIDEWALLS      │     CROWN & SURFACE MAPPING          │
│  • Drawn Trace = Stationary Hinge   │  • Drawn Trace = Strike Line Hinge   │
│  • Rotate around Trace Hinge freely │  • Change Dip Amount (0°–90°) freely │
│  • Change Dip Amount -> Shows       │  • Change Strike/Dip Dir -> Shows    │
│    Indication Warning Modal first   │    Indication Warning Modal first    │
└─────────────────────────────────────┴──────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────────┐
│            ZERO-TOUCH RELEASE, AUTO-UPDATE & GOOGLE DRIVE PIPELINE         │
├──────────────────────────┬───────────────────────────┬─────────────────────┤
│  GITHUB ACTIONS CI/CD    │   MASTER ADMIN PORTAL     │  USER MAIN SCREEN   │
│  • Builds 4 Installers   │  • 1-Click Publish Update │  • Top Header       │
│  • Overwrites same 4     │  • Overwrites Google      │    Notification     │
│    Google Drive File IDs │    Drive File IDs via API │    Toggle + Badge   │
│  • Publishes Release Doc │  • Broadcasts OTA Alert   │  • 1-Click In-App   │
│    to Firestore Relay    │    to All Active Users    │    Auto-Update      │
└──────────────────────────┴───────────────────────────┴─────────────────────┘
```

### Interactive Component & State Mapping

1. **3D Joint Inspection Hinge & Indication Modal Engine**:
   - Pass `mappingDomain` (`'TUNNEL' | 'SURFACE' | ...`) into `NatmJoint3DInspectorModal` and `TunnelSpatialGeometry`.
   - When `isFaceOrWallHinge` is active (`panel === 'face' | 'left_wall' | 'right_wall'` and `mappingDomain !== 'SURFACE'`):
     - Keep `isHingeRotationActive = true` by default.
     - Intercept any attempt to change Dip Amount directly (via the Dip Angle slider, +/- stepper, preset buttons, or 3D stereonet/gizmo) and open the **Face Dip Amount Indication Modal** before applying `pendingDipAmount`. Once confirmed, allow Dip Amount to tilt the plane toward vertical (90°) or horizontal (0°).
   - When `isCrownOrSurfaceStrikeHinge` is active (`panel === 'crown'` or `mappingDomain === 'SURFACE'`):
     - Lock `isStrikeLineHingeLocked = true` by default so the 3D plane is strictly hinged along the drawn Strike trace.
     - Changing **Dip Amount (0°–90°)** immediately tilts the 3D plane around the Strike trace axis without any warning and without shifting the strike line.
     - Intercept any attempt to change **Strike / Dip Direction** (via the Dip Direction slider, preset buttons, or stereonet/gizmo) and open the **Crown/Surface Strike Rotation Indication Modal** before rotating the plane's strike azimuth.

2. **User Main Screen Notification Toggle & 1-Click Auto-Update**:
   - Enhance the Main Screen Header (`DeviceIdAndNotificationHeaderWidget` and Main Screen Top Bar) with a dedicated **Software Update Notification Toggle** (`Auto-Update Alerts: ON/OFF`) and live update badge connected to `subscribeClientSoftwareUpdates`.
   - When a new release is detected (or clicked in the notification drawer), provide a prominent **Update App & Software Automatically** button that executes `performInAppOtaAutoUpdate`, updates service workers/caches, and refreshes into the latest version.

3. **Google Drive In-Place File Updater (CI/CD + Master Portal)**:
   - Add `scripts/update-google-drive-files.mjs` and a corresponding step in `.github/workflows/build-installer.yml` that authenticates with Google Drive API v3 and performs `PATCH https://www.googleapis.com/upload/drive/v3/files/{fileId}?uploadType=media` for all 4 installers (`GDRIVE_USER_APK_FILE_ID`, `GDRIVE_USER_EXE_FILE_ID`, `GDRIVE_MASTER_APK_FILE_ID`, `GDRIVE_MASTER_EXE_FILE_ID`), plus posts the new build version to Firestore `software_releases` so all users immediately see the update badge on their Main Screen.
   - Add a **1-Click Broadcast Update & Google Drive Sync** panel in the Master Admin Portal so you can also push instant over-the-air updates and overwrite Google Drive files directly from the browser without changing any LinkedIn or website links.
