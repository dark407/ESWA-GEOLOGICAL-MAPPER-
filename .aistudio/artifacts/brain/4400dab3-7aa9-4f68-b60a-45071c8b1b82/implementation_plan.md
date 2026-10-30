# NMT — Norwegian Method of Tunnelling & Interactive NGI Q-System Support Chart

This update introduces a dedicated **NMT — Norwegian Method of Tunnelling (Advanced NGI Q-System)** mode at the top of the Classifications workspace and embeds an interactive, high-precision **NGI Q-System Rock Support Chart (Grimstad & Barton, 1993 / NGI, 2014)** into the Support System workspace that plots live Roof $(Q, D_e)$ and Wall $(Q_{\text{wall}}, D_{e,\text{wall}})$ coordinates and prescribes NMT support categories (Categories 1–9, Bolt Spacing, Sfr Thickness & Energy Absorption E500/E700/E1000, and RRS I–III Reinforced Ribs of Shotcrete).

### User Review & Critical Decisions

> [!IMPORTANT]
> Please review the design and engineering decisions below and click **Proceed** to build, or share any adjustments.

- **Exclusive NMT Mode Toggle in Classifications Window**: Clicking **NMT — Norwegian Method of Tunnelling** at the top of the Q/RMR/GSI window switches the workspace into an exclusive, focused **Advanced NGI Q-Index** view (hiding RMR89 and GSI tabs while active so the NGI Q-System serves as the single authoritative classification "bible"). Switching back to Standard Multi-Classification mode restores Q, RMR89, and GSI tabs with zero data loss.
- **Full NGI Table 1 & Table 2 Parameter Fidelity**: Implements all official Grimstad & Barton (1993) / NGI (2014) parameter sub-tables, including RQD (nominal 10 rule for $\text{RQD} < 10$), $J_n$ with Tunnel Intersection ($3.0 \times J_n$) and Portal ($2.0 \times J_n$) multipliers, $J_r$ categories (a/b/c + $+1.0$ spacing adjustment), $J_a$ categories (a: wall contact, b: thin filling $<5\text{ mm}$, c: thick filling no wall contact), $J_w$, SRF categories (a: weakness zones, b: competent rock stress $\sigma_c/\sigma_1$ & $\sigma_\theta/\sigma_c$, c: squeezing rock, d: swelling rock), and Table 2 Excavation Support Ratio ($\text{ESR}$).
- **Live NGI Rock Support Chart in Support System Window**: Renders the logarithmic NGI Q-Chart ($Q$ from $0.001$ to $1000$ on X-axis, $D_e = \text{Span or Height} / \text{ESR}$ from $1$ to $100$ on Y-axis, plus the dual $Q_{\text{wall}}$ axis), plotting both the **Roof/Crown Point** $(Q, D_e)$ and **Wall Point** $(Q_{\text{wall}}, D_{e,\text{wall}})$ and providing one-click auto-application of the chart-derived NMT Support Category (1–9), bolt spacing, fibre-reinforced shotcrete ($S_{fr}$), and RRS ribs to the tunnel support drawing.

---

### 1. Overview & Core Concept

- **What It Does**:
  1. **Top-Level NMT Mode Switcher**: Adds a prominent **NMT — Norwegian Method of Tunnelling** button in the top bar of the Classifications stage. When activated, the screen dedicates 100% of its viewport to the **Advanced NGI Q-Index Workbench**.
  2. **Complete NGI Q-System Parameter Matrix (Table 1 & Table 2)**:
     - **Quotient 1 — Rock Mass Geometry ($\text{RQD} / J_n$)**: Interactive RQD selector (0–100% in 5% intervals, enforcing nominal $\text{RQD}=10$ when $\le 10\%$) and $J_n$ selector (0.5 to 20) with explicit checkboxes for **Tunnel Intersection ($3.0 \times J_n$)** and **Portal ($2.0 \times J_n$)**.
     - **Quotient 2 — Inter-Block Shear Strength ($J_r / J_a$)**: Full categorized $J_r$ selector (Category *a*: Rock-wall contact; Category *b*: Rock-wall contact before 10 cm shear; Category *c*: No rock-wall contact when sheared; plus $+1.0$ if mean spacing $>3\text{ m}$) and categorized $J_a$ selector (Category *a*: Clean/coated wall contact $0.75\text{–}4.0$; Category *b*: Thin filling $<5\text{ mm}$ $4.0\text{–}12.0$; Category *c*: Thick filling no wall contact $5.0\text{–}20.0$).
     - **Quotient 3 — Active Stress ($J_w / \text{SRF}$)**: Full $J_w$ table ($1.0$ down to $0.05$) with inflow/pressure ratings ($p_w$ in $\text{kg/cm}^2$) and categorized SRF selector (Category *a*: Weakness zones; Category *b*: Competent rock stress $\sigma_c/\sigma_1$ and $\sigma_\theta/\sigma_c$; Category *c*: Squeezing rock; Category *d*: Swelling rock).
     - **Equivalent Dimension ($D_e$) & Wall Adjustment ($Q_{\text{wall}}$)**: Interactive Table 2 **ESR** selector ($0.8$ to $3.5$) paired with current tunnel span $W$ and wall height $H$ to compute $D_{e,\text{roof}} = W / \text{ESR}$, $D_{e,\text{wall}} = H / \text{ESR}$, and $Q_{\text{wall}}$ ($5Q$ for $Q > 10$; $2.5Q$ for $0.1 \le Q \le 10$; $1.0Q$ for $Q < 0.1$).
  3. **Interactive NGI Q-System Support Chart in Support System Stage**:
     - Displays the complete **Figure 1 NGI Rock Support Chart** with Rock Mass Classes **A through G**, Support Category regions **1 through 9**, bolt spacing contours inside and outside shotcrete areas ($1.0\text{ m}$ to $4.0\text{ m}$), fibrecrete thickness bands ($5\text{ cm}$, $6\text{ cm}$, $9\text{ cm}$, $12\text{ cm}$, $15\text{ cm}$, $25\text{ cm}$), energy absorption classes ($E=500\text{ J}$, $E=700\text{ J}$, $E=1000\text{ J}$), and **RRS (Reinforced Ribs of Shotcrete)** curves ($\text{RRS I}$, $\text{RRS II}$, $\text{RRS III}$ with $\text{Si30/6}$, $\text{Si35/6}$, $\text{D40/6}$, $\text{D45/6}$, $\text{D55/6}$ rebar configurations).
     - Plots live crosshairs for **Crown/Roof $(Q, D_e)$** and **Wall $(Q_{\text{wall}}, D_{e,\text{wall}})$** and includes an **"Apply NGI Chart Support to Tunnel"** button that populates the exact bolt spacing, bolt length ($L = 2 + 0.15 B / \text{ESR}$), Sfr shotcrete thickness, and RRS / rib parameters directly into the 2D/3D Support System.

---

### 2. User Experience & Visual Design

- **Aesthetic Direction**: High-precision Norwegian Geotechnical Institute (NGI) engineering instrumentation aesthetic with crisp logarithmic chart axes, high-contrast classification bands (Classes A–G), and tabular monospace numerals (`IBM Plex Mono`).
- **Color Palette & Hierarchy**:
  - **Primary Workspace**: Deep slate (`#020617` / `#0f172a`) with hairline structural borders (`#1e293b`).
  - **NGI Q-System Chart Canvas**: High-contrast engineering paper theme (`#ffffff` / `#f8fafc`) with clear logarithmic gridlines, distinct support category zone fills, and bold crimson/blue plotting markers for Roof $(Q, D_e)$ and Wall $(Q_{\text{wall}}, D_{e,\text{wall}})$ coordinates.
  - **NMT Mode Accent**: Calibrated Nordic Amber & Cyan badges highlighting the 3 quotients $(\text{RQD}/J_n)$, $(J_r/J_a)$, and $(J_w/\text{SRF})$, equivalent dimension $D_e$, and Support Category 1–9.

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: Dedicated NMT Mode Switch vs. Replacing Standard Tabs**
  - *Chosen Approach*: Add a prominent **NMT — Norwegian Method of Tunnelling** mode toggle at the top of the Classifications stage. When enabled, only the Advanced NGI Q-System workbench is displayed; when disabled, the standard Q / RMR89 / GSI multi-tab view remains available.
  - *Why*: Matches the user's request ("in that window top add ntm- norweign method of tunneling if we click that only advanced ngi q index only shows") while preserving 100% backward compatibility with existing RMR89 and GSI workflows.
- **Decision 2: Analytical Digitization of the NGI Support Chart (Figure 1)**
  - *Chosen Approach*: Digitally model the logarithmic boundaries of NGI Support Categories 1–9, Sfr thickness contours (5 cm to 25 cm), bolt spacing curves (1.0 m to 4.0 m), bolt length formula $L = 2 + 0.15 B / \text{ESR}$, and RRS I/II/III curves directly in SVG + TypeScript math.
  - *Why*: Enables exact real-time coordinate plotting of $(Q, D_e)$ and $(Q_{\text{wall}}, D_{e,\text{wall}})$ and deterministic computation of Crown and Wall support prescriptions for any tunnel span/height and ESR value.

---

### 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────────┐
│                     CLASSIFICATIONS STAGE (TOP BAR)                        │
│  [ Standard Mode (Q | RMR89 | GSI) ]  <══>  [ ★ NMT: Advanced NGI Q-Index ]│
└───────────────────────────────────────┬────────────────────────────────────┘
                                        │
                                        ▼
┌────────────────────────────────────────────────────────────────────────────┐
│               NMT — ADVANCED NGI Q-INDEX WORKBENCH (TABLE 1 & 2)           │
│  ┌──────────────────────┐ ┌──────────────────────┐ ┌────────────────────┐  │
│  │ Quotient 1: RQD / Jn │ │ Quotient 2: Jr / Ja  │ │ Quotient 3: Jw/SRF │  │
│  │ • RQD (min 10 rule)  │ │ • Jr Cat a, b, c     │ │ • Jw (1.0 to 0.05) │  │
│  │ • Jn (0.5 to 20)     │ │ • Ja Cat a, b, c     │ │ • SRF Cat a,b,c,d  │  │
│  │ • Intersection ×3.0  │ │   (Wall contact,     │ │   (Weakness, Stress│  │
│  │ • Portal ×2.0        │ │    Thin/Thick fill)  │ │    Squeezing/Swell)│  │
│  └──────────┬───────────┘ └──────────┬───────────┘ └─────────┬──────────┘  │
│             └────────────────────────┼───────────────────────┘             │
│                                      ▼                                     │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ NMT EQUIVALENT DIMENSION & WALL ADJUSTMENT (TABLE 2)                 │  │
│  │ • ESR Selector (0.8 to 3.5)   • De_roof = Span / ESR                 │  │
│  │ • Q_roof = (RQD/Jn)×(Jr/Ja)×(Jw/SRF)                                 │  │
│  │ • Q_wall = 5Q (Q>10) | 2.5Q (0.1≤Q≤10) | Q (Q<0.1)                   │  │
│  └───────────────────────────────────┬──────────────────────────────────┘  │
└──────────────────────────────────────┼─────────────────────────────────────┘
                                       │
                                       ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                        SUPPORT SYSTEM STAGE                                │
│  ┌───────────────────────────────────┬──────────────────────────────────┐  │
│  │ INTERACTIVE NGI Q-SUPPORT CHART   │ PRESCRIBED NMT SUPPORT SCHEDULE  │  │
│  │ • Log-Log SVG (Q: 0.001–1000,     │ • Support Category (1 to 9)      │  │
│  │   De: 1–100, Classes G to A)      │ • Roof vs Wall Support Breakdown │  │
│  │ • Plotted Crown Point (Q, De)     │ • Bolt Spacing & Length (m)      │  │
│  │ • Plotted Wall Point (Qwall, De)  │ • Sfr Thickness & Energy (E500+) │  │
│  │ • RRS I / II / III & Sfr Contours │ • RRS Rebar Spec (Si30–D55/6)    │  │
│  │                                   │ • [Apply NMT Support to Drawing] │  │
│  └───────────────────────────────────┴──────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────┘
```

- **State & Data Model**:
  - Extend `qSystem` on the excavation round state with optional NMT fields (`nmtModeEnabled`, `jnMultiplierMode: 'normal' | 'portal_2x' | 'intersection_3x'`, `jrCategory: 'a' | 'b' | 'c'`, `jrSpacingPlusOne: boolean`, `jaCategory: 'a' | 'b' | 'c'`, `srfCategory: 'a' | 'b' | 'c' | 'd'`, `esrValue: number`, `esrCategoryLabel: string`) while keeping `rqd`, `jn`, `jr`, `ja`, `jw`, `srf`, and `qValue` 100% synchronized with existing calculations, FEM/DEM analysis, and final reports.
- **Interactive Handlers**:
  - Clicking any NGI Table 1 or Table 2 row updates `qSystem`, recalculates effective $J_n$, $J_r$, $Q_{\text{roof}}$, $Q_{\text{wall}}$, $D_{e,\text{roof}}$, $D_{e,\text{wall}}$, and NGI Support Category (1–9).
  - In the Support System stage, the **NGI Q-System Rock Support Chart** plots the live $(Q, D_e)$ and $(Q_{\text{wall}}, D_{e,\text{wall}})$ markers and allows one-click syncing of the NMT support parameters directly into the 2D/3D Support System configuration.
