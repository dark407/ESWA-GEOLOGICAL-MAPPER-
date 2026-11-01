// ============================================================================
// ESWA TUNNEL & VERTICAL SHAFT GEOTECHNICAL MONITORING ENGINE
// Supports: Load Cells, Inclinometers, Piezometers, MPBX, Crackmeters,
// Extensometers (Tape Convergence), and 3D Optical Prisms.
// ============================================================================

export type MonitoringStructureType = 'tunnel' | 'vertical_shaft';

export type InstrumentType =
  | 'loadcell'
  | 'inclinometer'
  | 'piezometer'
  | 'mpbx'
  | 'crackmeter'
  | 'extensometer'
  | 'optical_target';

export type InstrumentPosition =
  | 'crown'
  | 'left_shoulder'
  | 'right_shoulder'
  | 'left_wall'
  | 'right_wall'
  | 'invert'
  | 'collar'
  | 'shaft_wall'
  | 'borehole_depth';

export type TarpAlertLevel = 'NORMAL' | 'AMBER' | 'RED';

export interface InstrumentReading {
  id: string;
  readingDate: string; // ISO date YYYY-MM-DD
  readingTime?: string; // HH:MM
  daysSinceInstall: number;
  faceDistanceMeters?: number; // e.g. distance from excavation face
  value: number; // Primary measured value (mm, kN, kPa, etc.)
  secondaryValue?: number; // e.g. for crackmeter Y/Z or tangential stress
  mpbxAnchorValues?: {
    depthM: number;
    displacementMm: number;
  }[];
  deltaFromBaseline: number; // value - baseline
  ratePerDay: number; // velocity: change per day relative to previous reading
  recordedBy: string;
  notes: string;
  alertLevel: TarpAlertLevel;
}

export interface InstalledInstrument {
  id: string;
  instrumentId: string; // User tag, e.g. "LC-01", "INC-03", "PZ-02", "MPBX-01", "CRK-02", "EXT-A"
  type: InstrumentType;
  name: string; // Descriptive name
  structureType: MonitoringStructureType;
  project: string;
  location: string; // Tunnel heading or shaft section name
  chainageStation: string; // e.g. "Ch 14+240.00" or "Depth -45.0m"
  position: InstrumentPosition;
  installDate: string; // YYYY-MM-DD
  unit: string; // "kN", "mm", "kPa", "bar", "MPa"
  baselineZero: number; // Initial calibrated reading
  amberThreshold: number; // Warning limit
  redThreshold: number; // Critical / Action limit
  manufacturerOrModel?: string; // e.g. "Geokon 4420", "RST Instruments"
  readings: InstrumentReading[];
  status: 'ACTIVE' | 'MAINTENANCE' | 'DECOMMISSIONED';
}

export interface LocationMonitoringRecord {
  id: string;
  project: string;
  location: string;
  structureType: MonitoringStructureType;
  chainageStation: string;
  clientName?: string;
  contractorName?: string;
  consultantName?: string;
  lastUpdated: string;
  instruments: InstalledInstrument[];
}

export const INSTRUMENT_METADATA: Record<
  InstrumentType,
  {
    name: string;
    description: string;
    defaultUnit: string;
    icon: string;
    badgeColor: string;
    defaultAmber: number;
    defaultRed: number;
  }
> = {
  loadcell: {
    name: 'Rock Bolt / Anchor Load Cell',
    description: 'Vibrating wire load cell measuring tensile load on rockbolts/cable anchors or lining stress',
    defaultUnit: 'kN',
    icon: 'Gauge',
    badgeColor: 'bg-amber-100 text-amber-900 border-amber-400',
    defaultAmber: 180,
    defaultRed: 240,
  },
  inclinometer: {
    name: 'Borehole Inclinometer',
    description: 'Casing inclinometer measuring lateral ground deformation and shear displacement vs depth',
    defaultUnit: 'mm',
    icon: 'Sliders',
    badgeColor: 'bg-purple-100 text-purple-900 border-purple-400',
    defaultAmber: 12,
    defaultRed: 25,
  },
  piezometer: {
    name: 'Vibrating Wire Piezometer',
    description: 'Pore water pressure sensor measuring groundwater hydrostatic pressure and drawdown',
    defaultUnit: 'kPa',
    icon: 'Droplets',
    badgeColor: 'bg-blue-100 text-blue-900 border-blue-400',
    defaultAmber: 150,
    defaultRed: 300,
  },
  mpbx: {
    name: 'Multi-Point Borehole Extensometer (MPBX)',
    description: 'Multi-anchor extensometer measuring radial rock mass displacement at multiple depths',
    defaultUnit: 'mm',
    icon: 'Layers',
    badgeColor: 'bg-emerald-100 text-emerald-900 border-emerald-400',
    defaultAmber: 8,
    defaultRed: 18,
  },
  crackmeter: {
    name: 'Crackmeter / Jointmeter',
    description: 'Surface vibrating wire crackmeter measuring dilation/shear across lining cracks or joints',
    defaultUnit: 'mm',
    icon: 'Activity',
    badgeColor: 'bg-rose-100 text-rose-900 border-rose-400',
    defaultAmber: 3.5,
    defaultRed: 7.0,
  },
  extensometer: {
    name: 'Tape / Optical Convergence Extensometer',
    description: 'Radial tunnel convergence measurement between survey eye-pins (A-B crown/sidewall, B-C invert)',
    defaultUnit: 'mm',
    icon: 'TrendingUp',
    badgeColor: 'bg-cyan-100 text-cyan-900 border-cyan-400',
    defaultAmber: 25,
    defaultRed: 45,
  },
  optical_target: {
    name: '3D Optical Survey Target (Bi-Reflex Prism)',
    description: 'Total station prism target measuring spatial 3D displacement (ΔX sidewall, ΔZ crown settlement)',
    defaultUnit: 'mm',
    icon: 'Compass',
    badgeColor: 'bg-indigo-100 text-indigo-900 border-indigo-400',
    defaultAmber: 20,
    defaultRed: 35,
  },
};

export const SENSOR_POSITION_LABELS: Record<InstrumentPosition, string> = {
  crown: 'Crown (Top Center)',
  left_shoulder: 'Left Shoulder',
  right_shoulder: 'Right Shoulder',
  left_wall: 'Left Sidewall',
  right_wall: 'Right Sidewall',
  invert: 'Invert (Floor)',
  collar: 'Collar (Shaft Top)',
  shaft_wall: 'Shaft Perimeter Wall',
  borehole_depth: 'Deep Borehole Collar',
};

const MONITORING_STORAGE_KEY_PREFIX = 'eswa_tunnel_monitoring_v2';

export function getMonitoringStorageKey(project: string, location: string): string {
  const cleanP = (project || 'default_project').trim().toLowerCase().replace(/\s+/g, '_');
  const cleanL = (location || 'default_location').trim().toLowerCase().replace(/\s+/g, '_');
  return `${MONITORING_STORAGE_KEY_PREFIX}_${cleanP}_${cleanL}`;
}

export function getAllMonitoringKeys(): string[] {
  const keys: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(MONITORING_STORAGE_KEY_PREFIX)) {
        keys.push(k);
      }
    }
  } catch {
    // Ignore storage errors
  }
  return keys;
}

// Compute Alert Level based on value vs baseline and thresholds
export function computeAlertLevel(
  currentValue: number,
  baseline: number,
  amberLimit: number,
  redLimit: number
): TarpAlertLevel {
  const delta = Math.abs(currentValue - baseline);
  if (delta >= redLimit) return 'RED';
  if (delta >= amberLimit) return 'AMBER';
  return 'NORMAL';
}

// Compute rate of movement per day
export function computeRatePerDay(
  currentValue: number,
  currentDateIso: string,
  prevValue?: number,
  prevDateIso?: string
): number {
  if (prevValue === undefined || !prevDateIso) return 0;
  const t1 = new Date(prevDateIso).getTime();
  const t2 = new Date(currentDateIso).getTime();
  const diffDays = Math.max(0.25, (t2 - t1) / (1000 * 60 * 60 * 24));
  const diffVal = Math.abs(currentValue - prevValue);
  return Number((diffVal / diffDays).toFixed(2));
}

// Build realistic default instrumentation dataset for an initial location
export function createDefaultLocationDataset(
  project: string = 'Himalayan Hydro Tunnel Lot-1',
  location: string = 'Headrace Tunnel - Adit 2 Heading',
  structureType: MonitoringStructureType = 'tunnel',
  chainageStation: string = 'Ch 14+240.00 m'
): LocationMonitoringRecord {
  const isShaft = structureType === 'vertical_shaft';

  const defaultInstruments: InstalledInstrument[] = [
    {
      id: `inst-lc-01`,
      instrumentId: isShaft ? 'LC-SH-01' : 'LC-CRW-01',
      type: 'loadcell',
      name: isShaft ? 'Shaft Liner Pressure Cell' : 'Crown Rockbolt Load Cell #1',
      structureType,
      project,
      location,
      chainageStation,
      position: isShaft ? 'shaft_wall' : 'crown',
      installDate: '2026-10-18',
      unit: 'kN',
      baselineZero: 0.0,
      amberThreshold: 160.0,
      redThreshold: 220.0,
      manufacturerOrModel: 'Geokon 4900 VW Bolt Load Cell',
      status: 'ACTIVE',
      readings: [
        {
          id: 'r-lc-0',
          readingDate: '2026-10-18',
          readingTime: '08:30',
          daysSinceInstall: 0,
          faceDistanceMeters: 0.5,
          value: 0.0,
          deltaFromBaseline: 0.0,
          ratePerDay: 0.0,
          recordedBy: '',
          notes: 'Baseline installation after rock bolt tensioning',
          alertLevel: 'NORMAL',
        },
        {
          id: 'r-lc-1',
          readingDate: '2026-10-20',
          readingTime: '09:00',
          daysSinceInstall: 2,
          faceDistanceMeters: 4.2,
          value: 68.5,
          deltaFromBaseline: 68.5,
          ratePerDay: 34.25,
          recordedBy: '',
          notes: 'Bolt taking immediate load from face advance',
          alertLevel: 'NORMAL',
        },
        {
          id: 'r-lc-2',
          readingDate: '2026-10-23',
          readingTime: '08:45',
          daysSinceInstall: 5,
          faceDistanceMeters: 9.8,
          value: 112.4,
          deltaFromBaseline: 112.4,
          ratePerDay: 14.63,
          recordedBy: '',
          notes: 'Load rate attenuating; ground arching engaged',
          alertLevel: 'NORMAL',
        },
        {
          id: 'r-lc-3',
          readingDate: '2026-10-26',
          readingTime: '10:15',
          daysSinceInstall: 8,
          faceDistanceMeters: 15.6,
          value: 138.2,
          deltaFromBaseline: 138.2,
          ratePerDay: 8.6,
          recordedBy: '',
          notes: 'Stable equilibrium condition approaching',
          alertLevel: 'NORMAL',
        },
        {
          id: 'r-lc-4',
          readingDate: '2026-10-30',
          readingTime: '09:30',
          daysSinceInstall: 12,
          faceDistanceMeters: 22.4,
          value: 145.0,
          deltaFromBaseline: 145.0,
          ratePerDay: 1.7,
          recordedBy: '',
          notes: 'Steady load well below 160 kN amber alert',
          alertLevel: 'NORMAL',
        },
      ],
    },
    {
      id: `inst-mpbx-01`,
      instrumentId: isShaft ? 'MPBX-SH-01' : 'MPBX-14240',
      type: 'mpbx',
      name: isShaft ? 'Shaft Radial Extensometer (4-Anchor)' : 'Crown Radial MPBX Extensometer (4-Anchor)',
      structureType,
      project,
      location,
      chainageStation,
      position: isShaft ? 'shaft_wall' : 'crown',
      installDate: '2026-10-18',
      unit: 'mm',
      baselineZero: 0.0,
      amberThreshold: 10.0,
      redThreshold: 20.0,
      manufacturerOrModel: 'RST Instruments Multi-Point Rod Extensometer',
      status: 'ACTIVE',
      readings: [
        {
          id: 'r-mpbx-0',
          readingDate: '2026-10-18',
          readingTime: '09:00',
          daysSinceInstall: 0,
          value: 0.0,
          mpbxAnchorValues: [
            { depthM: 2.0, displacementMm: 0.0 },
            { depthM: 4.0, displacementMm: 0.0 },
            { depthM: 7.0, displacementMm: 0.0 },
            { depthM: 10.0, displacementMm: 0.0 },
          ],
          deltaFromBaseline: 0.0,
          ratePerDay: 0.0,
          recordedBy: '',
          notes: 'Zero datum set for all 4 anchors (2m, 4m, 7m, 10m)',
          alertLevel: 'NORMAL',
        },
        {
          id: 'r-mpbx-1',
          readingDate: '2026-10-21',
          readingTime: '11:00',
          daysSinceInstall: 3,
          value: 3.4,
          mpbxAnchorValues: [
            { depthM: 2.0, displacementMm: 3.4 },
            { depthM: 4.0, displacementMm: 1.8 },
            { depthM: 7.0, displacementMm: 0.6 },
            { depthM: 10.0, displacementMm: 0.1 },
          ],
          deltaFromBaseline: 3.4,
          ratePerDay: 1.13,
          recordedBy: '',
          notes: 'Deformation concentrated in plastic zone (0-3m depth)',
          alertLevel: 'NORMAL',
        },
        {
          id: 'r-mpbx-2',
          readingDate: '2026-10-25',
          readingTime: '09:30',
          daysSinceInstall: 7,
          value: 5.6,
          mpbxAnchorValues: [
            { depthM: 2.0, displacementMm: 5.6 },
            { depthM: 4.0, displacementMm: 2.9 },
            { depthM: 7.0, displacementMm: 1.0 },
            { depthM: 10.0, displacementMm: 0.2 },
          ],
          deltaFromBaseline: 5.6,
          ratePerDay: 0.55,
          recordedBy: '',
          notes: 'Deceleration observed; deep anchors (7m & 10m) firm and stable',
          alertLevel: 'NORMAL',
        },
        {
          id: 'r-mpbx-3',
          readingDate: '2026-10-30',
          readingTime: '10:00',
          daysSinceInstall: 12,
          value: 6.2,
          mpbxAnchorValues: [
            { depthM: 2.0, displacementMm: 6.2 },
            { depthM: 4.0, displacementMm: 3.2 },
            { depthM: 7.0, displacementMm: 1.1 },
            { depthM: 10.0, displacementMm: 0.2 },
          ],
          deltaFromBaseline: 6.2,
          ratePerDay: 0.12,
          recordedBy: '',
          notes: 'Stable ground condition (< 0.2 mm/day rate)',
          alertLevel: 'NORMAL',
        },
      ],
    },
    {
      id: `inst-inc-01`,
      instrumentId: isShaft ? 'INC-SH-01' : 'INC-LW-01',
      type: 'inclinometer',
      name: isShaft ? 'Shaft Periphery Borehole Inclinometer' : 'Left Sidewall Borehole Inclinometer',
      structureType,
      project,
      location,
      chainageStation,
      position: isShaft ? 'shaft_wall' : 'left_wall',
      installDate: '2026-10-18',
      unit: 'mm',
      baselineZero: 0.0,
      amberThreshold: 12.0,
      redThreshold: 22.0,
      manufacturerOrModel: 'Slope Indicator Digitilt AT System',
      status: 'ACTIVE',
      readings: [
        {
          id: 'r-inc-0',
          readingDate: '2026-10-18',
          readingTime: '10:00',
          daysSinceInstall: 0,
          value: 0.0,
          deltaFromBaseline: 0.0,
          ratePerDay: 0.0,
          recordedBy: '',
          notes: 'Initial verticality and profile survey completed',
          alertLevel: 'NORMAL',
        },
        {
          id: 'r-inc-1',
          readingDate: '2026-10-22',
          readingTime: '14:00',
          daysSinceInstall: 4,
          value: 4.2,
          deltaFromBaseline: 4.2,
          ratePerDay: 1.05,
          recordedBy: '',
          notes: 'Lateral deflection toward excavation opening',
          alertLevel: 'NORMAL',
        },
        {
          id: 'r-inc-2',
          readingDate: '2026-10-28',
          readingTime: '11:15',
          daysSinceInstall: 10,
          value: 7.8,
          deltaFromBaseline: 7.8,
          ratePerDay: 0.6,
          recordedBy: '',
          notes: 'Maximum deflection at depth 3.5m; velocity attenuating',
          alertLevel: 'NORMAL',
        },
      ],
    },
    {
      id: `inst-pz-01`,
      instrumentId: isShaft ? 'PZ-SH-01' : 'PZ-14240-RW',
      type: 'piezometer',
      name: isShaft ? 'Shaft Groundwater Piezometer' : 'Right Sidewall Pore Water Pressure Cell',
      structureType,
      project,
      location,
      chainageStation,
      position: isShaft ? 'shaft_wall' : 'right_wall',
      installDate: '2026-10-18',
      unit: 'kPa',
      baselineZero: 85.0,
      amberThreshold: 160.0,
      redThreshold: 250.0,
      manufacturerOrModel: 'Roctest PWS Vibrating Wire Piezometer',
      status: 'ACTIVE',
      readings: [
        {
          id: 'r-pz-0',
          readingDate: '2026-10-18',
          readingTime: '11:30',
          daysSinceInstall: 0,
          value: 85.0,
          deltaFromBaseline: 0.0,
          ratePerDay: 0.0,
          recordedBy: '',
          notes: 'Pre-excavation hydrostatic pressure recorded',
          alertLevel: 'NORMAL',
        },
        {
          id: 'r-pz-1',
          readingDate: '2026-10-22',
          readingTime: '15:20',
          daysSinceInstall: 4,
          value: 72.0,
          deltaFromBaseline: -13.0,
          ratePerDay: 3.25,
          recordedBy: '',
          notes: 'Drawdown due to tunnel drainage relief holes',
          alertLevel: 'NORMAL',
        },
        {
          id: 'r-pz-2',
          readingDate: '2026-10-29',
          readingTime: '10:45',
          daysSinceInstall: 11,
          value: 58.0,
          deltaFromBaseline: -27.0,
          ratePerDay: 2.0,
          recordedBy: '',
          notes: 'Pore pressure relieved successfully by weeping holes',
          alertLevel: 'NORMAL',
        },
      ],
    },
    {
      id: `inst-crk-01`,
      instrumentId: isShaft ? 'CRK-SH-01' : 'CRK-LW-01',
      type: 'crackmeter',
      name: isShaft ? 'Shaft Concrete Lining Crackmeter' : 'Left Wall Shotcrete Lining Joint Crackmeter',
      structureType,
      project,
      location,
      chainageStation,
      position: isShaft ? 'shaft_wall' : 'left_wall',
      installDate: '2026-10-19',
      unit: 'mm',
      baselineZero: 0.0,
      amberThreshold: 3.0,
      redThreshold: 6.0,
      manufacturerOrModel: 'Geokon 4420 Vibrating Wire Crackmeter',
      status: 'ACTIVE',
      readings: [
        {
          id: 'r-crk-0',
          readingDate: '2026-10-19',
          readingTime: '13:00',
          daysSinceInstall: 0,
          value: 0.0,
          deltaFromBaseline: 0.0,
          ratePerDay: 0.0,
          recordedBy: '',
          notes: 'Mounted across hairline shotcrete shrinkage crack',
          alertLevel: 'NORMAL',
        },
        {
          id: 'r-crk-1',
          readingDate: '2026-10-24',
          readingTime: '11:00',
          daysSinceInstall: 5,
          value: 0.8,
          deltaFromBaseline: 0.8,
          ratePerDay: 0.16,
          recordedBy: '',
          notes: 'Micro-opening under initial ground thrust',
          alertLevel: 'NORMAL',
        },
        {
          id: 'r-crk-2',
          readingDate: '2026-10-30',
          readingTime: '14:30',
          daysSinceInstall: 11,
          value: 1.1,
          deltaFromBaseline: 1.1,
          ratePerDay: 0.05,
          recordedBy: '',
          notes: 'Crack width stabilized under 1.2 mm; no structural shear',
          alertLevel: 'NORMAL',
        },
      ],
    },
    {
      id: `inst-ext-01`,
      instrumentId: isShaft ? 'CONV-SH-DIA' : 'CONV-A-B',
      type: 'extensometer',
      name: isShaft ? 'Shaft Diameter Convergence Pin Array' : 'Tunnel Tape Convergence (Chord A-B)',
      structureType,
      project,
      location,
      chainageStation,
      position: isShaft ? 'shaft_wall' : 'crown',
      installDate: '2026-10-18',
      unit: 'mm',
      baselineZero: 0.0,
      amberThreshold: 30.0,
      redThreshold: 50.0,
      manufacturerOrModel: 'Distometer / Optical Tape Eyebolt Array',
      status: 'ACTIVE',
      readings: [
        {
          id: 'r-ext-0',
          readingDate: '2026-10-18',
          readingTime: '14:00',
          daysSinceInstall: 0,
          value: 0.0,
          deltaFromBaseline: 0.0,
          ratePerDay: 0.0,
          recordedBy: '',
          notes: 'Baseline pin-to-pin distance calibrated immediately behind face',
          alertLevel: 'NORMAL',
        },
        {
          id: 'r-ext-1',
          readingDate: '2026-10-20',
          readingTime: '16:00',
          daysSinceInstall: 2,
          value: 7.5,
          deltaFromBaseline: 7.5,
          ratePerDay: 3.75,
          recordedBy: '',
          notes: 'Initial elastic and plastic closure on blast vibration',
          alertLevel: 'NORMAL',
        },
        {
          id: 'r-ext-2',
          readingDate: '2026-10-23',
          readingTime: '17:00',
          daysSinceInstall: 5,
          value: 14.8,
          deltaFromBaseline: 14.8,
          ratePerDay: 2.43,
          recordedBy: '',
          notes: 'Rate decreasing from 3.75 to 2.43 mm/day',
          alertLevel: 'NORMAL',
        },
        {
          id: 'r-ext-3',
          readingDate: '2026-10-27',
          readingTime: '15:30',
          daysSinceInstall: 9,
          value: 18.2,
          deltaFromBaseline: 18.2,
          ratePerDay: 0.85,
          recordedBy: '',
          notes: 'Velocity < 1.0 mm/day indicates ground arching established',
          alertLevel: 'NORMAL',
        },
        {
          id: 'r-ext-4',
          readingDate: '2026-10-31',
          readingTime: '11:00',
          daysSinceInstall: 13,
          value: 19.4,
          deltaFromBaseline: 19.4,
          ratePerDay: 0.3,
          recordedBy: '',
          notes: 'Safe stationary condition (< 0.5 mm/day)',
          alertLevel: 'NORMAL',
        },
      ],
    },
    {
      id: `inst-opt-01`,
      instrumentId: isShaft ? 'PRISM-SH-01' : 'PRISM-CRW-01',
      type: 'optical_target',
      name: isShaft ? 'Shaft 3D Optical Survey Prism (Top)' : 'Crown 3D Survey Target (Settlement ΔZ)',
      structureType,
      project,
      location,
      chainageStation,
      position: isShaft ? 'collar' : 'crown',
      installDate: '2026-10-18',
      unit: 'mm',
      baselineZero: 0.0,
      amberThreshold: 25.0,
      redThreshold: 40.0,
      manufacturerOrModel: 'Leica GMP104 Mini Prism Bi-Reflex',
      status: 'ACTIVE',
      readings: [
        {
          id: 'r-opt-0',
          readingDate: '2026-10-18',
          readingTime: '15:00',
          daysSinceInstall: 0,
          value: 0.0,
          deltaFromBaseline: 0.0,
          ratePerDay: 0.0,
          recordedBy: '',
          notes: 'Total station 3D coordinate datum established',
          alertLevel: 'NORMAL',
        },
        {
          id: 'r-opt-1',
          readingDate: '2026-10-21',
          readingTime: '10:00',
          daysSinceInstall: 3,
          value: 9.2,
          deltaFromBaseline: 9.2,
          ratePerDay: 3.06,
          recordedBy: '',
          notes: 'Crown settlement of 9.2 mm observed',
          alertLevel: 'NORMAL',
        },
        {
          id: 'r-opt-2',
          readingDate: '2026-10-26',
          readingTime: '14:00',
          daysSinceInstall: 8,
          value: 15.4,
          deltaFromBaseline: 15.4,
          ratePerDay: 1.24,
          recordedBy: '',
          notes: 'Settlement slowing down; total 15.4 mm vs 25 mm amber limit',
          alertLevel: 'NORMAL',
        },
        {
          id: 'r-opt-3',
          readingDate: '2026-10-31',
          readingTime: '09:00',
          daysSinceInstall: 13,
          value: 17.1,
          deltaFromBaseline: 17.1,
          ratePerDay: 0.34,
          recordedBy: '',
          notes: 'Settlement leveled off; ground support stable',
          alertLevel: 'NORMAL',
        },
      ],
    },
  ];

  return {
    id: `loc-rec-${Date.now()}`,
    project,
    location,
    structureType,
    chainageStation,
    clientName: 'National Railway & Hydro Power Authority',
    contractorName: 'JV Tunneling Contractors',
    consultantName: 'Geotechnical Engineering Consultants',
    lastUpdated: new Date().toISOString(),
    instruments: defaultInstruments,
  };
}

// Load data for a specific project + location (clean zero pre-fed state if not yet saved)
export function loadLocationMonitoringData(
  project: string,
  location: string,
  structureType: MonitoringStructureType = 'tunnel',
  chainageStation?: string
): LocationMonitoringRecord {
  const legacyNames = new Set([
    'Er. R. Sharma',
    'Er. A. Patel',
    'Surveyor M. Rao',
    'Field Geotechnical Engineer',
    'Er. Rajesh K. Sharma, M.Tech',
  ]);
  const key = getMonitoringStorageKey(project, location);
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed: LocationMonitoringRecord = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.instruments)) {
        return {
          ...parsed,
          instruments: parsed.instruments.map((inst) => ({
            ...inst,
            readings: (inst.readings || []).map((r) => ({
              ...r,
              recordedBy: legacyNames.has((r.recordedBy || '').trim()) ? '' : r.recordedBy || '',
            })),
          })),
        };
      }
    }
  } catch (err) {
    console.warn('Failed to parse monitoring data from localStorage:', err);
  }

  return {
    id: `mon-${Date.now()}`,
    project: project || '',
    location: location || '',
    structureType,
    chainageStation: chainageStation || '',
    clientName: '',
    contractorName: '',
    consultantName: '',
    lastUpdated: new Date().toISOString(),
    instruments: [],
  };
}

// Save monitoring data to storage
export function saveLocationMonitoringData(data: LocationMonitoringRecord): void {
  const key = getMonitoringStorageKey(data.project, data.location);
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (err) {
    console.error('Failed to save monitoring data to localStorage:', err);
  }
}

// Export monitoring data to CSV
export function exportMonitoringDataToCsv(record: LocationMonitoringRecord): string {
  const headers = [
    'Project',
    'Location',
    'Structure_Type',
    'Chainage_Station',
    'Instrument_ID',
    'Instrument_Type',
    'Position',
    'Reading_Date',
    'Reading_Time',
    'Days_Since_Install',
    'Value',
    'Unit',
    'Delta_From_Baseline',
    'Rate_Per_Day',
    'Alert_Level',
    'Recorded_By',
    'Notes',
  ];

  const rows: string[] = [headers.join(',')];

  record.instruments.forEach((inst) => {
    inst.readings.forEach((r) => {
      const escape = (val: string | number | undefined) =>
        `"${String(val ?? '').replace(/"/g, '""')}"`;

      rows.push(
        [
          escape(record.project),
          escape(record.location),
          escape(record.structureType),
          escape(record.chainageStation),
          escape(inst.instrumentId),
          escape(inst.type),
          escape(inst.position),
          escape(r.readingDate),
          escape(r.readingTime || ''),
          r.daysSinceInstall,
          r.value,
          escape(inst.unit),
          r.deltaFromBaseline,
          r.ratePerDay,
          escape(r.alertLevel),
          escape(r.recordedBy),
          escape(r.notes),
        ].join(',')
      );
    });
  });

  return rows.join('\n');
}
