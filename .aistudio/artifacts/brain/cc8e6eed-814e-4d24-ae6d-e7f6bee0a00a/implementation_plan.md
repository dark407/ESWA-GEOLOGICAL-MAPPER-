# ESWA Geological Mapper — Standalone Software Download Website & Master Release Portal

This plan outlines the architecture and user experience for a dedicated **Product Showcase & Software Distribution Website** that operates as an independent link (`/website` and standalone Netlify deployment) with **zero navigation or UI connection** into the live geological mapping software, while featuring a **Top Master Login** so the owner can upload and publish updated Windows `.exe` and Android `.apk` releases directly from the website.

---

## User Review & Critical Decisions

- **Strict Decoupling from the Mapper Application**: Visiting the website link (`/website`, `?site=website`, or a standalone Netlify deployment) renders **only** the public software showcase and download portal. There are no "Launch Web App" buttons, workspace sidebars, or back-links into the NATM/TBM/Mining mapping workspace.
- **Top Bar Master Login & Live Binary/Release Upload**: A **Master Login** button in the top navigation bar authenticates the Master Owner (`akashdhanusheswar@gmail.com`) via Google Sign-In or Master Passcode. Once logged in on the website, the owner can upload new Windows Desktop (`.exe`) and Android (`.apk`) release packages (or attach direct release URLs), automatically compute SHA-256 checksums and file sizes in-browser, edit version numbers and release notes, and publish updates immediately to all website visitors.
- **Free Netlify Ready + One-Click Standalone Bundle**: Includes a root `netlify.toml` configuration for free Netlify hosting, plus a built-in **"Export Standalone Netlify Website ZIP"** tool inside the Website Master Console so the website can also be dragged-and-dropped onto Netlify Drop as a 100% separate project at any time.

---

## 1. Overview & Core Concept

The **ESWA Geological Mapper Distribution Website** serves as the official public portal where engineering geologists, tunneling contractors, and mining teams can inspect software capabilities, verify package integrity, request software access licenses, and download the latest Windows Desktop (`.exe`) and Android Field Tablet (`.apk`) builds.

For the software owner, the website acts as a self-contained **Release Management & Distribution Hub**: logging in via the top-right **Master Login** button unlocks an inline release publisher to upload updated `.exe` and `.apk` installers, post version changelogs, and manage incoming software license requests without ever leaving the website.

---

## 2. User Experience & Visual Design

The interface follows a high-craft **Industrial Geotechnical & Precision Engineering** aesthetic designed for clarity, engineering trust, and fast binary downloads:

- **Color & Atmospheric Polarity (60-30-10 Rule)**:
  - **60% Primary Canvas**: Deep obsidian slate (`#0A0E17`) providing high-contrast legibility for technical specifications and release data.
  - **30% Secondary Surfaces**: Structured dark basalt cards (`#111827`) with subtle `1px solid` hairline borders (`rgba(148, 163, 184, 0.14)`) and zero heavy drop shadows.
  - **10% Focused Accent**: Survey safety amber (`#F59E0B`) for primary download actions and active version highlights, paired with emerald (`#10B981`) for verified SHA-256 integrity indicators.
- **Typography & Scannable Hierarchy**:
  - **Display & Headings**: `Plus Jakarta Sans` (`clamp(2.25rem, 4vw, 3.75rem)`, `tracking-tight`) for clear engineering propositions.
  - **Body Copy**: `Plus Jakarta Sans` (`16px`, `leading-relaxed`) constrained to `65ch` max width for effortless reading.
  - **Technical Metadata & Checksums**: `JetBrains Mono` with `tabular-nums` for version numbers (`v2.4.0`), file sizes (`84.6 MB`), release timestamps, and full 64-character SHA-256 hashes.
- **Top Navigation Bar (3-Zone Contract)**:
  - **Left**: Clean `ESWA GEOTECH` brand wordmark (no subtitle clutter or floating stat pills).
  - **Center**: 4 concise text navigation links (`Downloads`, `Capabilities`, `Release Notes`, `Installation & Access`).
  - **Right**: Single primary administrative action (`Master Login` button, which switches to `Master Release Console • Online` when the owner is authenticated).
- **Section Flow & Visual Storytelling**:
  1. **Hero & Direct Download Deck**: High-impact proposition paired with two side-by-side primary download cards:
     - **Windows Desktop Workstation (`.exe` — 64-bit Windows 10/11)** with one-click download, active version number, release date, file size, and copyable SHA-256 checksum.
     - **Android Field Tablet & Mobile Edition (`.apk` — Android 10+)** with one-click download, active version number, release date, file size, and copyable SHA-256 checksum.
  2. **Core Engineering Capabilities (Asymmetric Bento Grid)**: Numbered editorial breakdown (`01. NATM Underground Face Mapping`, `02. TBM Segmental & Cutterhead Logging`, `03. Exploration Core Logging & RQD Analytics`, `04. 3D Geotechnical Rib & Stereonet Engine`) with concrete technical specifications and zero generic buzzwords.
  3. **Release Notes & Version Checksum Ledger**: Structured tabular changelog showing current and historical releases, what changed in each build, and verifiable SHA-256 checksums.
  4. **Installation Guide & System Requirements**: Step-by-step instructions for Windows SmartScreen verification, Android APK sideload permissions, and offline field synchronization.
  5. **License & Software Access Request Form**: Validated lead capture form (Full Name, Organization/Project, Official Email, Target Platform, and Deployment Scope) that submits directly to the Master Portal's access request queue with instant confirmation feedback.

---

## 3. Key Product Decisions & Trade-Offs

- **Complete Isolation Between Website and Software**:
  - *Decision*: Route resolution checks `/website` (or `?site=website` or `VITE_WEBSITE_ONLY=true`) at the root router level and mounts only the standalone Website component tree.
  - *Rationale*: Ensures customers visiting the download link only experience the public marketing and download portal with no accidental entry into the mapping software UI.
- **Hybrid Binary Hosting (Direct Cloud/Local Upload + External High-Speed Release URL)**:
  - *Decision*: The Master Release Upload modal supports both **Direct File Upload** (selecting a `.exe` or `.apk` file from the owner's computer, automatically calculating its exact byte size and SHA-256 hash via Web Crypto API, and storing the package for immediate download) and **Direct Release Binary URL** (for large multi-hundred-megabyte installers hosted on GitHub Releases, Google Drive direct links, or CDN buckets while still auto-computing or recording the SHA-256 checksum).
  - *Rationale*: Gives the owner instant drag-and-drop file upload convenience for standard packages while supporting unlimited file sizes for heavy desktop installers on free Netlify hosting.
- **Persistent Real-Time Synchronization**:
  - *Decision*: All release publications, uploaded binary metadata, changelogs, and license requests are persisted in Firestore (`website_config/current_release`, `website_releases`, and `access_requests`) with local IndexedDB caching fallback.
  - *Rationale*: Whenever the Master Owner logs into the website and uploads a new `.exe` or `.apk` version, every visitor loading the website link immediately sees the updated version number, release notes, and download file in real time.

---

## 4. Technical Architecture & Data Strategy

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     PUBLIC VISITORS (/website Link)                     │
│  ┌───────────────────┐  ┌────────────────────┐  ┌────────────────────┐  │
│  │ Windows .EXE Card │  │ Android .APK Card  │  │ License Request UI │  │
│  │ (Direct Download) │  │ (Direct Download)  │  │ (Validated Form)   │  │
│  └─────────┬─────────┘  └─────────┬──────────┘  └─────────┬──────────┘  │
└────────────┼──────────────────────┼───────────────────────┼─────────────┘
             │                      │                       │
             ▼                      ▼                       ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                REAL-TIME RELEASE & DISTRIBUTION ENGINE                  │
│  • Firestore `website_releases` & Chunked Binary / URL Storage          │
│  • Web Crypto API (`crypto.subtle.digest('SHA-256')`) Checksum Verifier │
│  • Firestore `access_requests` Queue (Synced with Master Access Portal) │
└───────────────────────────────────▲─────────────────────────────────────┘
                                    │
┌───────────────────────────────────┴─────────────────────────────────────┐
│              TOP BAR MASTER LOGIN & RELEASE UPLOAD CONSOLE              │
│  • Authenticated Master Owner (`akashdhanusheswar@gmail.com`)           │
│  • Drag & Drop .EXE / .APK Uploader + Auto SHA-256 & Size Calculator    │
│  • Version Publisher, Changelog Editor & Standalone Netlify ZIP Export  │
└─────────────────────────────────────────────────────────────────────────┘
```

1. **Isolated Website Router & Netlify Configuration**:
   - Configure `RootApplicationRouter` so `/website` (and `?site=website`) renders the standalone `ProductDownloadWebsite` module with its own document title, SEO meta tags, and zero imports from the mapping workspace.
   - Add `netlify.toml` with SPA rewrite rules and cache headers so deploying to free Netlify serves the application cleanly.
2. **Master Authentication & Release Upload Console**:
   - Clicking **Master Login** in the website top bar opens a dedicated authentication modal supporting Master Google Sign-In (`akashdhanusheswar@gmail.com`) and Master Passcode verification.
   - Once authenticated, the owner accesses the **Master Release Publisher Drawer** right on the website to:
     - Upload a new `.exe` Windows installer or `.apk` Android package from disk (computing exact file size and SHA-256 hash automatically via `crypto.subtle.digest`) or bind a high-speed direct binary URL.
     - Set version tags (e.g., `v2.5.0`), release date, minimum OS requirements, and structured release notes.
     - View and approve/manage incoming License & Access Requests submitted through the website form.
     - Export a ready-to-deploy standalone Netlify website folder/ZIP for independent hosting.
3. **Firestore Schema & Security Rules**:
   - Public read access on `website_releases` so any visitor on the website link can view the latest version info and download the published `.exe` and `.apk` builds without logging in.
   - Master-only write permissions (`isAdmin()`) on `website_releases` so only the Master Owner can upload new software builds or modify download links.
   - Validated public create access on `website_license_requests` so prospective users can submit access requests from the website.
