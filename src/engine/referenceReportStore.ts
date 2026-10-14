export interface UploadedReferenceReport {
  id: string;
  fileName: string;
  fileType: 'pdf' | 'image';
  fileSizeFormatted: string;
  dataUrl: string; // Base64 data URL for instant rendering in iframe or img tag
  uploadedAt: string;
  notes?: string;
  dimensions?: { width: number; height: number };
}

const STORAGE_KEY = 'eswa_continuous_uploaded_reference_report_v1';

/**
 * Creates a high-fidelity SVG data URL of the official NHPC Power Tunnel
 * As-Built continuous geological log template as a built-in benchmark reference.
 */
export function createBenchmarkSampleReportDataUrl(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1400 990" width="1400" height="990">
  <defs>
    <style>
      .title { font-family: Arial, sans-serif; font-size: 14px; font-weight: bold; fill: #1c1917; }
      .sub { font-family: Arial, sans-serif; font-size: 10px; fill: #44403c; }
      .bold { font-family: Arial, sans-serif; font-size: 9px; font-weight: bold; fill: #1c1917; }
      .mono { font-family: monospace; font-size: 9px; fill: #000; }
      .grid { stroke: #d6d3d1; stroke-width: 0.7; }
      .border { stroke: #1c1917; stroke-width: 2; fill: none; }
      .header-box { fill: #f5f5f4; }
    </style>
  </defs>

  <!-- Sheet Outer Border -->
  <rect x="15" y="15" width="1370" height="960" class="border" />
  <rect x="20" y="20" width="1360" height="950" stroke="#1c1917" stroke-width="1" fill="#fff" />

  <!-- Title Block Header -->
  <rect x="25" y="25" width="1350" height="85" fill="#fafaf9" stroke="#1c1917" stroke-width="1.5" />
  <line x1="900" y1="25" x2="900" y2="110" stroke="#1c1917" stroke-width="1.5" />
  
  <text x="45" y="52" class="title">NHPC LIMITED (A GOVT. OF INDIA ENTERPRISE) — TEESTA HE PROJECT STAGE-VI</text>
  <text x="45" y="70" class="sub">AS-BUILT CONTINUOUS 3D GEOLOGICAL TUNNEL LOG &amp; EXCAVATION RECORD</text>
  <text x="45" y="92" class="bold">LOCATION: POWER TUNNEL HEAD-1 (RD 250.00m TO RD 280.00m) • TUNNEL DIA: 8.50m (MODIFIED HORSESHOE)</text>

  <text x="915" y="48" class="bold">DRAWING NO: NHPC/TST-VI/HRT/GEO-2024-084</text>
  <text x="915" y="65" class="bold">SCALE: 1:100 (H) • 1:100 (V) | SHEET SIZE: A3 LANDSCAPE</text>
  <text x="915" y="82" class="bold">LOGGED BY: S. Sharma (Geologist) | CHECKED BY: Dr. R. K. Verma (Res. Geologist)</text>
  <text x="915" y="99" class="bold">CONTRACTOR: M/s Patel - Gammon JV | CONSULTANT: NHPC Design Division</text>

  <!-- Geological Profile Section -->
  <rect x="25" y="120" width="1350" height="280" fill="#fcfbf9" stroke="#1c1917" stroke-width="1.5" />
  <rect x="25" y="120" width="1350" height="24" fill="#e7e5e4" stroke="#1c1917" stroke-width="1" />
  <text x="45" y="136" class="bold">UNWRAPPED 3D GEOLOGICAL CANVASES (DEVELOPED PERIMETER: LEFT WALL 3.75m → CROWN ARCH 7.50m → RIGHT WALL 3.75m)</text>

  <!-- Wall Divisions -->
  <line x1="25" y1="210" x2="1375" y2="210" stroke="#78716c" stroke-dasharray="6,4" stroke-width="1.2" />
  <line x1="25" y1="310" x2="1375" y2="310" stroke="#78716c" stroke-dasharray="6,4" stroke-width="1.2" />
  <text x="35" y="180" class="bold" fill="#78716c">LEFT WALL</text>
  <text x="35" y="265" class="bold" fill="#78716c">CROWN ARCH</text>
  <text x="35" y="360" class="bold" fill="#78716c">RIGHT WALL</text>

  <!-- Geological Structures / Discontinuities Demonstration -->
  <path d="M 120 150 Q 240 230 320 380" stroke="#dc2626" stroke-width="2.5" fill="none" />
  <text x="210" y="215" class="mono" fill="#dc2626">JS1: 205°/75° (Shear Zone 2-5cm)</text>

  <path d="M 380 145 Q 490 270 560 390" stroke="#2563eb" stroke-width="2" fill="none" />
  <text x="470" y="250" class="mono" fill="#2563eb">JS2: 110°/60° (Main Joint)</text>

  <path d="M 680 160 Q 820 260 920 375" stroke="#16a34a" stroke-width="2" fill="none" />
  <text x="790" y="240" class="mono" fill="#16a34a">JS3: 340°/80° (Bedding Plane)</text>

  <path d="M 1020 150 Q 1150 280 1260 390" stroke="#9333ea" stroke-width="2.5" stroke-dasharray="4,2" fill="none" />
  <text x="1130" y="255" class="mono" fill="#9333ea">FAULT TRACE F-1 (Gouge 10cm)</text>

  <!-- Tabular Technical Bands (Pulls & Geotechnical Parameters) -->
  <rect x="25" y="410" width="1350" height="460" fill="#fff" stroke="#1c1917" stroke-width="1.5" />
  
  <!-- Row Lines -->
  <line x1="25" y1="440" x2="1375" y2="440" stroke="#1c1917" stroke-width="1.2" />
  <line x1="25" y1="475" x2="1375" y2="475" stroke="#a8a29e" stroke-width="0.8" />
  <line x1="25" y1="515" x2="1375" y2="515" stroke="#a8a29e" stroke-width="0.8" />
  <line x1="25" y1="560" x2="1375" y2="560" stroke="#a8a29e" stroke-width="0.8" />
  <line x1="25" y1="605" x2="1375" y2="605" stroke="#a8a29e" stroke-width="0.8" />
  <line x1="25" y1="655" x2="1375" y2="655" stroke="#a8a29e" stroke-width="0.8" />
  <line x1="25" y1="710" x2="1375" y2="710" stroke="#a8a29e" stroke-width="0.8" />
  <line x1="25" y1="770" x2="1375" y2="770" stroke="#a8a29e" stroke-width="0.8" />
  <line x1="25" y1="820" x2="1375" y2="820" stroke="#a8a29e" stroke-width="0.8" />

  <!-- Column Dividing Lines -->
  <line x1="220" y1="410" x2="220" y2="870" stroke="#1c1917" stroke-width="1.5" />
  <line x1="450" y1="410" x2="450" y2="870" stroke="#1c1917" stroke-width="1" />
  <line x1="680" y1="410" x2="680" y2="870" stroke="#1c1917" stroke-width="1" />
  <line x1="910" y1="410" x2="910" y2="870" stroke="#1c1917" stroke-width="1" />
  <line x1="1140" y1="410" x2="1140" y2="870" stroke="#1c1917" stroke-width="1" />

  <!-- Parameter Labels -->
  <text x="35" y="430" class="bold">CHAINAGE / ADVANCE (m)</text>
  <text x="35" y="462" class="bold">EXCAVATION DATE &amp; ROUND</text>
  <text x="35" y="500" class="bold">LITHOLOGY &amp; ROCK TYPE</text>
  <text x="35" y="542" class="bold">WEATHERING / STRENGTH (UCS)</text>
  <text x="35" y="588" class="bold">JOINT SETS &amp; SPACING (J1, J2, J3)</text>
  <text x="35" y="635" class="bold">GROUNDWATER / SEEPAGE</text>
  <text x="35" y="690" class="bold">RMR / BARTON Q / ROCK CLASS</text>
  <text x="35" y="748" class="bold">SUPPORT INSTALLED (SFRCS, BOLTS)</text>
  <text x="35" y="800" class="bold">OVERBREAK VOLUME (m³)</text>
  <text x="35" y="850" class="bold">ENGINEERING REMARKS</text>

  <!-- Pull 1 Column -->
  <text x="235" y="430" class="mono" font-weight="bold">RD 250.00m - 253.00m (3.0m)</text>
  <text x="235" y="462" class="mono">18/03/2024 • Round #84</text>
  <text x="235" y="495" class="bold">Quartzite (Medium Grained)</text>
  <text x="235" y="510" class="sub">Hard, compact, reddish brown</text>
  <text x="235" y="542" class="mono">W2 (Slight) • UCS: 145 MPa</text>
  <text x="235" y="580" class="sub">J1: 20-40cm, J2: 30-50cm</text>
  <text x="235" y="635" class="mono">Damp (0.1 L/s)</text>
  <text x="235" y="680" class="bold" fill="#047857">RMR: 63 • Q: 7.8</text>
  <text x="235" y="698" class="bold" fill="#047857">CLASS II (GOOD ROCK)</text>
  <text x="235" y="738" class="sub">100mm SFRCS + Swellex Bolts</text>
  <text x="235" y="755" class="mono">3.0m length @ 1.5m c/c</text>
  <text x="235" y="800" class="mono">0.45 m³ (Negligible)</text>
  <text x="235" y="850" class="sub">Crown arch stable, minimal scale</text>

  <!-- Pull 2 Column -->
  <text x="465" y="430" class="mono" font-weight="bold">RD 253.00m - 256.00m (3.0m)</text>
  <text x="465" y="462" class="mono">19/03/2024 • Round #85</text>
  <text x="465" y="495" class="bold">Quartzitic Phyllite</text>
  <text x="465" y="510" class="sub">Foliated, silvery sheen</text>
  <text x="465" y="542" class="mono">W2-W3 • UCS: 110 MPa</text>
  <text x="465" y="580" class="sub">J1 (Foliation): 5-15cm, J2: 25cm</text>
  <text x="465" y="635" class="mono">Dripping at Crown</text>
  <text x="465" y="680" class="bold" fill="#d97706">RMR: 52 • Q: 4.1</text>
  <text x="465" y="698" class="bold" fill="#d97706">CLASS III (FAIR ROCK)</text>
  <text x="465" y="738" class="sub">120mm SFRCS + Swellex Bolts</text>
  <text x="465" y="755" class="mono">Wire Mesh 100x100x4mm</text>
  <text x="465" y="800" class="mono">1.20 m³ (Left shoulder)</text>
  <text x="465" y="850" class="sub">Minor block fallout along JS1</text>

  <!-- Pull 3 Column -->
  <text x="695" y="430" class="mono" font-weight="bold">RD 256.00m - 259.00m (3.0m)</text>
  <text x="695" y="462" class="mono">20/03/2024 • Round #86</text>
  <text x="695" y="495" class="bold">Phyllite with Shear Zone</text>
  <text x="695" y="510" class="sub">Fractured with clay gouge</text>
  <text x="695" y="542" class="mono">W3 (Moderate) • UCS: 65 MPa</text>
  <text x="695" y="580" class="sub">Intensely fractured, 2-10cm</text>
  <text x="695" y="635" class="mono">Wet / Continuous Seep</text>
  <text x="695" y="680" class="bold" fill="#dc2626">RMR: 38 • Q: 1.2</text>
  <text x="695" y="698" class="bold" fill="#dc2626">CLASS IV (POOR ROCK)</text>
  <text x="695" y="738" class="sub">150mm SFRCS + ISMB 150 Ribs</text>
  <text x="695" y="755" class="mono">Steel Ribs @ 1.0m spacing</text>
  <text x="695" y="800" class="mono">2.85 m³ (Crown arch overbreak)</text>
  <text x="695" y="850" class="sub">Installed forepoling before blast</text>

  <!-- Pull 4 Column -->
  <text x="925" y="430" class="mono" font-weight="bold">RD 259.00m - 262.00m (3.0m)</text>
  <text x="925" y="462" class="mono">21/03/2024 • Round #87</text>
  <text x="925" y="495" class="bold">Quartzite (Massive)</text>
  <text x="925" y="510" class="sub">Fine to medium grained</text>
  <text x="925" y="542" class="mono">W1-W2 • UCS: 160 MPa</text>
  <text x="925" y="580" class="sub">J1: 40-70cm, J2: 60-100cm</text>
  <text x="925" y="635" class="mono">Dry / Occasional damp</text>
  <text x="925" y="680" class="bold" fill="#047857">RMR: 68 • Q: 9.4</text>
  <text x="925" y="698" class="bold" fill="#047857">CLASS II (GOOD ROCK)</text>
  <text x="925" y="738" class="sub">100mm SFRCS + Spot Bolting</text>
  <text x="925" y="755" class="mono">3.0m length @ 1.8m c/c</text>
  <text x="925" y="800" class="mono">0.30 m³ (Within tolerance)</text>
  <text x="925" y="850" class="sub">Excellent face stability</text>

  <!-- Pull 5 Column -->
  <text x="1155" y="430" class="mono" font-weight="bold">RD 262.00m - 265.00m (3.0m)</text>
  <text x="1155" y="462" class="mono">22/03/2024 • Round #88</text>
  <text x="1155" y="495" class="bold">Quartzite with Quartz Veins</text>
  <text x="1155" y="510" class="sub">Hard, brittle, massive</text>
  <text x="1155" y="542" class="mono">W1 (Fresh) • UCS: 175 MPa</text>
  <text x="1155" y="580" class="sub">J1: 50-80cm, J2: 80-120cm</text>
  <text x="1155" y="635" class="mono">Completely Dry</text>
  <text x="1155" y="680" class="bold" fill="#047857">RMR: 74 • Q: 12.0</text>
  <text x="1155" y="698" class="bold" fill="#047857">CLASS I (VERY GOOD ROCK)</text>
  <text x="1155" y="738" class="sub">75mm SFRCS + Pattern Bolts</text>
  <text x="1155" y="755" class="mono">3.0m length @ 2.0m c/c</text>
  <text x="1155" y="800" class="mono">0.15 m³ (Negligible)</text>
  <text x="1155" y="850" class="sub">Very good profile cut, smooth</text>

  <!-- Footer Signatures & QA Block -->
  <rect x="25" y="880" width="1350" height="85" fill="#fafaf9" stroke="#1c1917" stroke-width="1.5" />
  <line x1="360" y1="880" x2="360" y2="965" stroke="#1c1917" stroke-width="1" />
  <line x1="700" y1="880" x2="700" y2="965" stroke="#1c1917" stroke-width="1" />
  <line x1="1040" y1="880" x2="1040" y2="965" stroke="#1c1917" stroke-width="1" />

  <text x="45" y="902" class="bold">CONTRACTOR GEOLOGIST:</text>
  <text x="45" y="922" class="sub">Sign: ___________________ Date: 22/03/24</text>
  <text x="45" y="942" class="bold">Er. A. K. Sharma (Field Geologist)</text>

  <text x="380" y="902" class="bold">CHECKED &amp; VERIFIED BY:</text>
  <text x="380" y="922" class="sub">Sign: ___________________ Date: 23/03/24</text>
  <text x="380" y="942" class="bold">Er. M. P. Singh (Senior Geologist, NHPC)</text>

  <text x="720" y="902" class="bold">RESIDENT GEOTECHNICAL ENGINEER:</text>
  <text x="720" y="922" class="sub">Sign: ___________________ Date: 24/03/24</text>
  <text x="720" y="942" class="bold">Dr. R. K. Verma (Chief Geologist, NHPC)</text>

  <text x="1060" y="902" class="bold">PROJECT MANAGER / EIC:</text>
  <text x="1060" y="922" class="sub">Sign: ___________________ Date: 25/03/24</text>
  <text x="1060" y="942" class="bold">Er. V. K. Patel (General Manager, NHPC)</text>
</svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/**
 * Returns default benchmark report
 */
export function getSampleBenchmarkReport(): UploadedReferenceReport {
  return {
    id: 'benchmark-nhpc-power-tunnel-sample',
    fileName: 'NHPC_Power_Tunnel_As_Built_A3_Log_Sample.pdf',
    fileType: 'image', // Rendered as SVG data image for instant crisp display
    fileSizeFormatted: '1.4 MB',
    dataUrl: createBenchmarkSampleReportDataUrl(),
    uploadedAt: 'Official Hydroelectric Standard',
    notes: 'Reference A3 continuous geological log template from NHPC Teesta-VI Power Tunnel.',
  };
}

/**
 * Loads user's uploaded reference report from storage, or fallback to null
 */
export function loadUploadedReferenceReport(): UploadedReferenceReport | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as UploadedReferenceReport;
    if (parsed && parsed.dataUrl) return parsed;
    return null;
  } catch (err) {
    console.warn('Failed to load uploaded reference report:', err);
    return null;
  }
}

/**
 * Saves user's uploaded reference report into localStorage
 */
export function saveUploadedReferenceReport(report: UploadedReferenceReport): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(report));
  } catch (err) {
    console.warn('Failed to save uploaded reference report to storage:', err);
  }
}

/**
 * Clears uploaded reference report
 */
export function clearUploadedReferenceReport(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
