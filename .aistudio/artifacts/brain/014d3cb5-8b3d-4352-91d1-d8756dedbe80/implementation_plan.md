# Two-Channel Update Architecture: Master App Live Broadcast & Continuous Google Drive Sync

This plan separates software updates into two independent, non-interfering channels: **Master Application Live Broadcasts** for existing users and **Silent Continuous Google Drive Installer Updates** for new users downloading the app.

## User Review & Critical Decisions

> [!IMPORTANT]
> All three core workflow decisions have been confirmed and will govern the implementation with strict separation between existing live users and new Google Drive downloads.

- **Confirmed Decision 1 — Live User Updates Triggered Strictly by Master Application**: Existing users on Android phones and Windows PCs will **only** receive an in-app update notification when you explicitly click **Broadcast Live Update** inside your Master Application. Automatic CI/CD builds will never push popups to live users.
- **Confirmed Decision 2 — Continuous Silent Google Drive Updates for New Users**: Regular builds and Google Drive sync operations will automatically overwrite your permanent Google Drive `.APK` and `.EXE` files in-place for new users downloading from LinkedIn or your website, without triggering any update popup on existing live users.
- **Confirmed Decision 3 — 1-Click In-App Update + Optional "Later (Use Current Version)"**: When you broadcast a live update from the Master Application, existing users can either click **Update Now (Keep All Data)** for a 1-click in-place update or click **Later (Use Current Version)** / **✕** to immediately close the prompt and continue working on their current version.

---

## 1. Overview & Core Concept

- **What It Does**:
  1. **Channel 1 — Master Application Live Broadcast (For Existing Users)**: Gives the Master Owner full manual control over when live users see an update prompt. Clicking **Broadcast Update to Live Users** in the Master Application publishes a single active Master-signed release (`ESWA_MASTER_ADMIN_SIG_v1`), archives all older releases, and displays live adoption status across registered users. Also includes a 1-click **Stop / Recall Live Broadcast** button if you ever want to clear active update prompts for all users.
  2. **Channel 2 — Google Drive Continuous Installer Sync (For New Users)**: Keeps your permanent Google Drive `.APK` and `.EXE` links up to date on every build (`PATCH /upload/drive/v3/files/{fileId}?uploadType=media`) and via a dedicated **Sync Installers to Google Drive Only** action in the Master Application—without ever broadcasting a popup to existing users.
- **Target Audience / Persona**:
  - **Master Owner**: Controls live user update broadcasts and monitors each registered user's installed version from the Master Application (`ESWA Software Access Control`).
  - **Existing Field Geologists & Tunnel Engineers**: Work uninterrupted on their phones and PCs, receiving an update prompt only when the Master Owner explicitly broadcasts a new version, with the freedom to update in 1 click or continue using their current version.
  - **New Users**: Always download the latest `.APK` or `.EXE` directly from the permanent Google Drive share links.

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Continuous Background Update for New Users (Zero Live User Popups)**:
     - Whenever code is built or synced to Google Drive, the permanent Google Drive `.APK` and `.EXE` files are overwritten in-place.
     - No `software_releases` broadcast record is created by CI/CD, so live users in the field never get unexpected or out-of-order update popups.
  2. **Master Owner Broadcasting a Live Update**:
     - Open **ESWA Software Access Control → Auto-Update & Google Drive**.
     - In **Panel 1 (Live User Update Broadcast — Master Controlled)**, enter the target version (auto-suggested forward from the current version), headline, and release notes, then click **Broadcast Live Update to Existing Users**.
     - All previous releases are automatically archived so only this single version is active. A live counter shows how many registered users are on the broadcasted version, along with a **Stop / Recall Broadcast** button.
  3. **Existing User Receiving a Master Broadcast**:
     - Only users whose installed version is strictly older (`installedVersion < broadcastedVersion`) and who have not dismissed that version see the update prompt.
     - Clicking **Update Now (Keep All Data)** runs the 1-click in-place OTA update (preserving 100% of projects, photos, joint traces, and login session), updates the user's installed version in the Master Application, and closes the modal.
     - Clicking **Later (Use Current Version)** or **✕** immediately closes the modal and saves the dismissal in persistent storage so it never blocks the user.
- **Visual Identity & Theme**:
  - **Aesthetic Direction**: Utilitarian dark slate engineering console (`#0F172A` / `#020617` canvas, crisp `1px` structural borders, single-elevation cards).
  - **Color Palette & Accents**:
    - Neutral Slate (`slate-950` / `slate-900`) for primary workspace surfaces.
    - Emerald (`#10B981`) reserved for **Channel 1: Master Live User Broadcast** actions and active version indicators.
    - Cyan (`#06B6D4`) reserved for **Channel 2: Google Drive Continuous Installer Sync** for new users.
  - **Typography & Hierarchy**: Clean sans headings with `JetBrains Mono` / `font-mono tabular-nums` for version numbers (`v2.8.105`), timestamps, and user adoption counts.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Strict Source Filtering (`ESWA_MASTER_ADMIN_SIG_v1` Only) + Forward-Only Semver Check**
  - *Chosen Approach*: Client apps will only display update notifications for releases signed by the Master Application (`adminAuthSig === 'ESWA_MASTER_ADMIN_SIG_v1'`) whose semantic version is strictly greater than the user's installed version (`compareSoftwareVersions(release.version, installedVer) > 0`).
  - *Why*: Eliminates any possibility of automated CI/CD scripts (`ESWA-CI-AUTO-OTA`) or older cached releases triggering false or downgrade update prompts on live user devices.
- **Decision 2: Independent Controls for Live User Broadcast vs. Google Drive File Sync**
  - *Chosen Approach*: Decouple the **Sync Installers to Google Drive (New Users)** button from the **Broadcast Update to Live Users** button in the Master Application, and remove `publishCloudAutoUpdateNotification` from the automated Google Drive CI/CD script.
  - *Why*: Allows continuous regular updates to Google Drive for new downloads at any time without disturbing active field users until the Master Owner decides to push a live broadcast.

---

## 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────────┐
│                        TWO-CHANNEL UPDATE ARCHITECTURE                     │
└────────────────────────────────────────────────────────────────────────────┘

  CHANNEL 1: LIVE USERS (Master Application Controlled Only)
  ┌──────────────────────────────┐      Publish Master Release     ┌─────────────────────────┐
  │  Master Application Portal   │ ──────────────────────────────► │   Cloud Firestore       │
  │  • Broadcast Live Update     │  (status: PUBLISHED,            │   `software_releases`   │
  │  • Auto-Archive Old Releases │   sig: ESWA_MASTER_ADMIN_SIG)   │   (Single Active Ver)   │
  │  • Recall / Stop Broadcast   │                                 └────────────┬────────────┘
  └──────────────────────────────┘                                              │
                                                                                ▼
                                                                   ┌─────────────────────────┐
                                                                   │  Live User App / PC EXE │
                                                                   │  • Checks:              │
                                                                   │    1. Master Sig Only   │
                                                                   │    2. NewVer > InstVer  │
                                                                   │    3. Not Dismissed     │
                                                                   │  • Actions:             │
                                                                   │    - 1-Click Update Now │
                                                                   │    - Later (Use Current)│
                                                                   └─────────────────────────┘

  CHANNEL 2: NEW USERS (Continuous Google Drive Installer Sync — Zero Popups)
  ┌──────────────────────────────┐      PATCH Drive File IDs       ┌─────────────────────────┐
  │  CI/CD Build & Master Drive  │ ──────────────────────────────► │   Google Drive Links    │
  │  Sync Engine                 │  (Overwrites User .APK & .EXE   │   • User Android .APK   │
  │  • No Firestore Release Push │   in-place; links unchanged)    │   • User Windows .EXE   │
  └──────────────────────────────┘                                 └─────────────────────────┘
```

- **Data Model & State**:
  - `software_releases` (Firestore & Local Mirror):
    - Only one release with `status === 'PUBLISHED'` and `adminAuthSig === 'ESWA_MASTER_ADMIN_SIG_v1'` can be active at any time.
    - Automated CI/CD records (`adminAuthSig === 'ESWA-CI-AUTO-OTA'`) are archived and ignored by client update listeners.
    - `GDRIVE_PERMANENT_FILE_IDS_CONFIG` stores the permanent `userApkFileId` and `userExeFileId` in Firestore so continuous builds update Google Drive silently.
- **Interactive Component & State Mapping**:
  - **Master Application (`Auto-Update & Google Drive` Tab)**:
    - **Panel 1 — Broadcast to Live Users**: Version input, headline, release notes, **Broadcast Live Update to Existing Users** button, **Stop / Recall Active Broadcast** button (archives all published releases immediately), and live user version adoption summary.
    - **Panel 2 — Continuous Google Drive Sync for New Users**: Permanent `.APK` and `.EXE` File ID inputs, **Save Permanent Drive File IDs** button, and **Overwrite Google Drive Installers Now (New Users Only)** button with a confirmation dialog before overwriting Drive files.
  - **Live User Update Modal & Banner**:
    - Displays only when `release.adminAuthSig === 'ESWA_MASTER_ADMIN_SIG_v1'`, `compareSoftwareVersions(release.version, installedVer) > 0`, and `!isReleaseDismissedByUser(release.releaseId, release.version)`.
    - **Update Now (Keep All Data)** executes `performInAppOtaAutoUpdate`, records the new version in `software_licenses`, and closes the modal.
    - **Later (Use Current)** and **✕** persistently dismiss the release in `localStorage` and close the modal immediately.
