/**
 * Geotechnical Core Logging Engine
 * Standardized borehole diamond core run logging, automated TCR/RQD calculation,
 * lithological & weathering profiling, core box photo cataloging, and sign-off verification.
 */

export interface CoreRunRecord {
  id: string;
  runNumber: number;
  depthFrom: number; // in meters
  depthTo: number; // in meters
  runLength: number; // in meters (depthTo - depthFrom)
  coreRecovered: number; // in meters (total length of core recovered)
  solidCoreRecovered?: number; // in meters (length of cylindrical core pieces > full diameter)
  soundPiecesOver10cm: number; // in meters (sum of sound core pieces >= 10cm / 100mm)
  tcrPercent: number; // Total Core Recovery %: (coreRecovered / runLength) * 100
  scrPercent?: number; // Solid Core Recovery %
  rqdPercent: number; // Rock Quality Designation %: (soundPiecesOver10cm / runLength) * 100
  rqdRating: 'Very Poor' | 'Poor' | 'Fair' | 'Good' | 'Excellent';
  lithology: string; // Rock type e.g. Granite, Quartzite, Sandstone, Basalt, Schist
  lithologyColor?: string; // Optional hex display color
  weathering: 'W1' | 'W2' | 'W3' | 'W4' | 'W5' | 'W6';
  strengthGrade: 'R0' | 'R1' | 'R2' | 'R3' | 'R4' | 'R5' | 'R6';
  fractureFrequency?: number; // fractures / meter
  assayGrade?: string; // Mining grade e.g. "3.2 g/t Au" or "1.45% Cu"
  oreZone?: 'High Grade' | 'Medium Grade' | 'Low Grade' | 'Waste' | 'Dilution';
  coreBoxNumber: string | number;
  discontinuitiesDescription?: string;
  remarks?: string;
}

export interface CoreBoxPhotoRecord {
  id: string;
  boxNumber: string | number;
  depthFrom: number;
  depthTo: number;
  photoUrl: string; // Base64 data URI or image URL
  photoTitle?: string;
  takenAt: string;
  condition: 'Dry' | 'Wet' | 'Natural';
  notes?: string;
}

export interface CoreLogSignOff {
  contractorName: string;
  contractorSignature?: string; // PNG Base64 Data URL
  contractorDate: string;
  contractorDesignation: string;

  pmcName: string;
  pmcSignature?: string;
  pmcDate: string;
  pmcDesignation: string;

  clientName: string;
  clientSignature?: string;
  clientDate: string;
  clientDesignation: string;
}

export interface BoreholeRecord {
  id: string;
  boreholeId: string;
  projectName: string;
  tunnelName?: string;
  chainageLabel?: string;
  collarElevation?: number;
  coordinates?: {
    northing?: string;
    easting?: string;
    elevation?: string;
  };
  inclinationDeg: number; // -90 = Vertical
  azimuthDeg: number; // 0 - 360 (for inclined holes)
  drillingMethod: string;
  coreDiameter: string; // e.g. HQ3 (61.1mm), NQ (47.6mm), PQ (85mm)
  drillingContractor: string;
  pmcConsultant: string;
  clientEmployer: string;
  loggedBy: string;
  reviewedBy: string;
  startDate: string;
  completionDate: string;
  waterTableDepth?: number;
  runs: CoreRunRecord[];
  photos: CoreBoxPhotoRecord[];
  signOff: CoreLogSignOff;
  createdAt: string;
  updatedAt: string;
}

export interface BoreholeSummaryMetrics {
  totalDrilledDepth: number;
  totalCoreRecovered: number;
  totalSoundPieces: number;
  averageTcr: number;
  averageRqd: number;
  overallRqdRating: 'Very Poor' | 'Poor' | 'Fair' | 'Good' | 'Excellent';
  dominantLithology: string;
  dominantWeathering: string;
  runCount: number;
  boxCount: number;
}

export const WEATHERING_GRADES: {
  code: 'W1' | 'W2' | 'W3' | 'W4' | 'W5' | 'W6';
  name: string;
  shortDesc: string;
  color: string;
}[] = [
  { code: 'W1', name: 'Fresh (W1)', shortDesc: 'No visible signs of rock material weathering.', color: '#10B981' },
  { code: 'W2', name: 'Slightly Weathered (W2)', shortDesc: 'Discoloration on discontinuity surfaces and rock.', color: '#34D399' },
  { code: 'W3', name: 'Moderately Weathered (W3)', shortDesc: 'Less than half of rock material decomposed / disintegrated.', color: '#FBBF24' },
  { code: 'W4', name: 'Highly Weathered (W4)', shortDesc: 'More than half of rock decomposed to soil/friable rock.', color: '#F97316' },
  { code: 'W5', name: 'Completely Weathered (W5)', shortDesc: 'All rock decomposed to soil; structural fabric preserved.', color: '#EF4444' },
  { code: 'W6', name: 'Residual Soil (W6)', shortDesc: 'All rock transformed to soil; structure completely destroyed.', color: '#991B1B' },
];

export const STRENGTH_GRADES: {
  code: 'R0' | 'R1' | 'R2' | 'R3' | 'R4' | 'R5' | 'R6';
  name: string;
  ucsRange: string;
  fieldIdentification: string;
}[] = [
  { code: 'R0', name: 'Extremely Weak (R0)', ucsRange: '< 1.0 MPa', fieldIdentification: 'Indented by thumbnail' },
  { code: 'R1', name: 'Very Weak (R1)', ucsRange: '1.0 - 5.0 MPa', fieldIdentification: 'Crumbles under firm blows with pick of hammer' },
  { code: 'R2', name: 'Weak (R2)', ucsRange: '5.0 - 25 MPa', fieldIdentification: 'Shallow indentations by firm hammer blow' },
  { code: 'R3', name: 'Medium Strong (R3)', ucsRange: '25 - 50 MPa', fieldIdentification: 'Cannot be scraped with knife; firm blow fractures' },
  { code: 'R4', name: 'Strong (R4)', ucsRange: '50 - 100 MPa', fieldIdentification: 'Requires more than one firm blow to fracture' },
  { code: 'R5', name: 'Very Strong (R5)', ucsRange: '100 - 250 MPa', fieldIdentification: 'Many heavy hammer blows required to chip' },
  { code: 'R6', name: 'Extremely Strong (R6)', ucsRange: '> 250 MPa', fieldIdentification: 'Can only be chipped with hammer' },
];

export const CORE_DIAMETERS = [
  'HQ3 (61.1 mm)',
  'HQ (63.5 mm)',
  'NQ (47.6 mm)',
  'NQ3 (45.0 mm)',
  'PQ (85.0 mm)',
  'PQ3 (83.0 mm)',
  'BQ (36.4 mm)',
];

export const DRILLING_METHODS = [
  'Wireline Diamond Core (Triple Tube HQ3)',
  'Wireline Diamond Core (Standard HQ)',
  'Wireline Diamond Core (NQ)',
  'Rotary Conventional Core Barrel',
  'Percussive Rotary Coring',
];

export const COMMON_LITHOLOGIES: { name: string; color: string; group: 'Igneous' | 'Sedimentary' | 'Metamorphic' }[] = [
  { name: 'Granite', color: '#FB7185', group: 'Igneous' },
  { name: 'Granodiorite', color: '#F43F5E', group: 'Igneous' },
  { name: 'Basalt', color: '#64748B', group: 'Igneous' },
  { name: 'Gabbro', color: '#6366F1', group: 'Igneous' },
  { name: 'Dolerite', color: '#475569', group: 'Igneous' },
  { name: 'Andesite', color: '#78716C', group: 'Igneous' },
  { name: 'Sandstone', color: '#F59E0B', group: 'Sedimentary' },
  { name: 'Quartzite', color: '#EAB308', group: 'Metamorphic' },
  { name: 'Limestone', color: '#38BDF8', group: 'Sedimentary' },
  { name: 'Dolomite', color: '#0EA5E9', group: 'Sedimentary' },
  { name: 'Shale', color: '#A8A29E', group: 'Sedimentary' },
  { name: 'Siltstone', color: '#D97706', group: 'Sedimentary' },
  { name: 'Conglomerate', color: '#D946EF', group: 'Sedimentary' },
  { name: 'Gneiss', color: '#8B5CF6', group: 'Metamorphic' },
  { name: 'Schist', color: '#A78BFA', group: 'Metamorphic' },
  { name: 'Phyllite', color: '#14B8A6', group: 'Metamorphic' },
  { name: 'Slate', color: '#6B7280', group: 'Metamorphic' },
  { name: 'Marble', color: '#F1F5F9', group: 'Metamorphic' },
  { name: 'Breccia (Fault / Tectonic)', color: '#DC2626', group: 'Metamorphic' },
];

export function getRqdRating(rqd: number): 'Very Poor' | 'Poor' | 'Fair' | 'Good' | 'Excellent' {
  if (rqd >= 90) return 'Excellent';
  if (rqd >= 75) return 'Good';
  if (rqd >= 50) return 'Fair';
  if (rqd >= 25) return 'Poor';
  return 'Very Poor';
}

export function getRqdBadgeColor(rating: 'Very Poor' | 'Poor' | 'Fair' | 'Good' | 'Excellent'): {
  bg: string;
  text: string;
  border: string;
} {
  switch (rating) {
    case 'Excellent':
      return { bg: 'bg-emerald-100 dark:bg-emerald-950/60', text: 'text-emerald-800 dark:text-emerald-300', border: 'border-emerald-300 dark:border-emerald-800' };
    case 'Good':
      return { bg: 'bg-teal-100 dark:bg-teal-950/60', text: 'text-teal-800 dark:text-teal-300', border: 'border-teal-300 dark:border-teal-800' };
    case 'Fair':
      return { bg: 'bg-amber-100 dark:bg-amber-950/60', text: 'text-amber-800 dark:text-amber-300', border: 'border-amber-300 dark:border-amber-800' };
    case 'Poor':
      return { bg: 'bg-orange-100 dark:bg-orange-950/60', text: 'text-orange-800 dark:text-orange-300', border: 'border-orange-300 dark:border-orange-800' };
    case 'Very Poor':
      return { bg: 'bg-rose-100 dark:bg-rose-950/60', text: 'text-rose-800 dark:text-rose-300', border: 'border-rose-300 dark:border-rose-800' };
  }
}

export function calculateRunMetrics(depthFrom: number, depthTo: number, coreRecovered: number, soundPiecesOver10cm: number) {
  const runLength = Math.max(0.01, parseFloat((depthTo - depthFrom).toFixed(3)));
  const recoveredClamped = Math.min(runLength * 1.5, Math.max(0, coreRecovered));
  const soundClamped = Math.min(recoveredClamped, Math.max(0, soundPiecesOver10cm));

  const tcrPercent = parseFloat(Math.min(100, Math.max(0, (recoveredClamped / runLength) * 100)).toFixed(1));
  const rqdPercent = parseFloat(Math.min(100, Math.max(0, (soundClamped / runLength) * 100)).toFixed(1));
  const rqdRating = getRqdRating(rqdPercent);

  return {
    runLength,
    coreRecovered: recoveredClamped,
    soundPiecesOver10cm: soundClamped,
    tcrPercent,
    rqdPercent,
    rqdRating,
  };
}

export function calculateBoreholeSummary(borehole: BoreholeRecord): BoreholeSummaryMetrics {
  const runs = borehole.runs || [];
  if (runs.length === 0) {
    return {
      totalDrilledDepth: 0,
      totalCoreRecovered: 0,
      totalSoundPieces: 0,
      averageTcr: 0,
      averageRqd: 0,
      overallRqdRating: 'Very Poor',
      dominantLithology: 'None',
      dominantWeathering: 'W1',
      runCount: 0,
      boxCount: borehole.photos?.length || 0,
    };
  }

  let totalDrilledDepth = 0;
  let totalCoreRecovered = 0;
  let totalSoundPieces = 0;
  const lithoDist: Record<string, number> = {};
  const weathDist: Record<string, number> = {};

  for (const r of runs) {
    const len = r.runLength > 0 ? r.runLength : Math.max(0.01, r.depthTo - r.depthFrom);
    totalDrilledDepth += len;
    totalCoreRecovered += r.coreRecovered || 0;
    totalSoundPieces += r.soundPiecesOver10cm || 0;

    const lit = r.lithology || 'Unknown';
    lithoDist[lit] = (lithoDist[lit] || 0) + len;

    const wth = r.weathering || 'W1';
    weathDist[wth] = (weathDist[wth] || 0) + len;
  }

  const averageTcr = totalDrilledDepth > 0
    ? parseFloat(Math.min(100, (totalCoreRecovered / totalDrilledDepth) * 100).toFixed(1))
    : 0;

  const averageRqd = totalDrilledDepth > 0
    ? parseFloat(Math.min(100, (totalSoundPieces / totalDrilledDepth) * 100).toFixed(1))
    : 0;

  let dominantLithology = 'Granite';
  let maxLitLen = -1;
  for (const [k, v] of Object.entries(lithoDist)) {
    if (v > maxLitLen) {
      maxLitLen = v;
      dominantLithology = k;
    }
  }

  let dominantWeathering = 'W1';
  let maxWthLen = -1;
  for (const [k, v] of Object.entries(weathDist)) {
    if (v > maxWthLen) {
      maxWthLen = v;
      dominantWeathering = k;
    }
  }

  const uniqueBoxes = new Set(runs.map((r) => String(r.coreBoxNumber).trim()).filter(Boolean));
  const boxCount = Math.max(uniqueBoxes.size, borehole.photos?.length || 0);

  return {
    totalDrilledDepth: parseFloat(totalDrilledDepth.toFixed(2)),
    totalCoreRecovered: parseFloat(totalCoreRecovered.toFixed(2)),
    totalSoundPieces: parseFloat(totalSoundPieces.toFixed(2)),
    averageTcr,
    averageRqd,
    overallRqdRating: getRqdRating(averageRqd),
    dominantLithology,
    dominantWeathering,
    runCount: runs.length,
    boxCount,
  };
}

const STORAGE_KEY = 'eswa_geotechnical_borehole_records_v1';
const ACTIVE_BOREHOLE_KEY = 'eswa_active_borehole_id_v1';

export function createDefaultBorehole(): BoreholeRecord {
  const nowStr = new Date().toISOString().split('T')[0];
  return {
    id: 'bh-tunnel-portal-01',
    boreholeId: 'BH-01',
    projectName: 'Infrastructure Tunnel Package-02',
    tunnelName: 'Main Drive (Southbound)',
    chainageLabel: 'Ch. 120+450',
    collarElevation: 1420.5,
    coordinates: {
      northing: '2,845,612.35 m N',
      easting: '412,890.12 m E',
      elevation: '1,420.50 m a.s.l.',
    },
    inclinationDeg: -90,
    azimuthDeg: 0,
    drillingMethod: 'Wireline Diamond Core (Triple Tube HQ3)',
    coreDiameter: 'HQ3 (61.1 mm)',
    drillingContractor: 'Alpha Geotechnical Drilling Consortium',
    pmcConsultant: 'Arup & Partners International Geotechnics',
    clientEmployer: 'National Highway & Infrastructure Authority',
    loggedBy: 'Dr. Akash D. (Lead Engineering Geologist)',
    reviewedBy: 'Chief Geotechnical PMC Engineer',
    startDate: nowStr,
    completionDate: nowStr,
    waterTableDepth: 6.8,
    runs: [
      {
        id: 'run-1',
        runNumber: 1,
        depthFrom: 0.0,
        depthTo: 3.0,
        runLength: 3.0,
        coreRecovered: 2.2,
        soundPiecesOver10cm: 0.9,
        tcrPercent: 73.3,
        rqdPercent: 30.0,
        rqdRating: 'Poor',
        lithology: 'Granite',
        lithologyColor: '#FB7185',
        weathering: 'W4',
        strengthGrade: 'R2',
        fractureFrequency: 14,
        coreBoxNumber: 1,
        discontinuitiesDescription: 'Sub-horizontal jointing, iron oxide staining, clay-silt infill up to 2mm',
        remarks: 'Overburden soil-rock interface transition; core moderately fragmented',
      },
      {
        id: 'run-2',
        runNumber: 2,
        depthFrom: 3.0,
        depthTo: 6.0,
        runLength: 3.0,
        coreRecovered: 2.85,
        soundPiecesOver10cm: 1.95,
        tcrPercent: 95.0,
        rqdPercent: 65.0,
        rqdRating: 'Fair',
        lithology: 'Granite',
        lithologyColor: '#FB7185',
        weathering: 'W3',
        strengthGrade: 'R3',
        fractureFrequency: 6,
        coreBoxNumber: 1,
        discontinuitiesDescription: 'J1: Dip 62°, rough planar, tight contact; J2: Dip 28°, undulating',
        remarks: 'Entering moderately weathered bedrock block; core recovery improved significantly',
      },
      {
        id: 'run-3',
        runNumber: 3,
        depthFrom: 6.0,
        depthTo: 9.0,
        runLength: 3.0,
        coreRecovered: 2.98,
        soundPiecesOver10cm: 2.65,
        tcrPercent: 99.3,
        rqdPercent: 88.3,
        rqdRating: 'Good',
        lithology: 'Granite',
        lithologyColor: '#FB7185',
        weathering: 'W2',
        strengthGrade: 'R4',
        fractureFrequency: 3,
        coreBoxNumber: 2,
        discontinuitiesDescription: 'J1: Dip 70°, rough stepped, calcite healed; Joint walls unweathered',
        remarks: 'Solid cylindrical core sticks >35cm length. Minor drill induced breaks',
      },
      {
        id: 'run-4',
        runNumber: 4,
        depthFrom: 9.0,
        depthTo: 12.0,
        runLength: 3.0,
        coreRecovered: 3.0,
        soundPiecesOver10cm: 2.88,
        tcrPercent: 100.0,
        rqdPercent: 96.0,
        rqdRating: 'Excellent',
        lithology: 'Granite',
        lithologyColor: '#FB7185',
        weathering: 'W1',
        strengthGrade: 'R5',
        fractureFrequency: 1,
        coreBoxNumber: 2,
        discontinuitiesDescription: 'Fresh competent granitic gneiss, very tight pristine joints',
        remarks: 'Excellent tunnel crown benchmark horizon. Water ingress recorded nil.',
      },
      {
        id: 'run-5',
        runNumber: 5,
        depthFrom: 12.0,
        depthTo: 15.0,
        runLength: 3.0,
        coreRecovered: 3.0,
        soundPiecesOver10cm: 2.92,
        tcrPercent: 100.0,
        rqdPercent: 97.3,
        rqdRating: 'Excellent',
        lithology: 'Quartzite',
        lithologyColor: '#EAB308',
        weathering: 'W1',
        strengthGrade: 'R5',
        fractureFrequency: 1,
        coreBoxNumber: 3,
        discontinuitiesDescription: 'Quartz vein intrusion contact at 13.4m, hard and intact',
        remarks: 'Target excavation invert rock grade verified; highly competent rock mass',
      },
    ],
    photos: [
      {
        id: 'photo-box-1',
        boxNumber: 1,
        depthFrom: 0.0,
        depthTo: 6.0,
        photoUrl: '',
        photoTitle: 'Core Box #01 (0.00m to 6.00m) - Runs 1 & 2',
        takenAt: nowStr,
        condition: 'Wet',
        notes: 'High-clarity core tray record under natural daylight. Showing transition from W4 to W3 granite.',
      },
      {
        id: 'photo-box-2',
        boxNumber: 2,
        depthFrom: 6.0,
        depthTo: 12.0,
        photoUrl: '',
        photoTitle: 'Core Box #02 (6.00m to 12.00m) - Runs 3 & 4',
        takenAt: nowStr,
        condition: 'Wet',
        notes: 'Competent sound core cylinders with continuous RQD > 88%. Fresh granitic bedrock.',
      },
    ],
    signOff: {
      contractorName: 'Er. Rajesh Kumar',
      contractorDate: nowStr,
      contractorDesignation: 'Senior Drilling Geologist (Contractor)',
      pmcName: 'Dr. Michael Chen',
      pmcDate: nowStr,
      pmcDesignation: 'Chief Tunnel Geotechnical Consultant (PMC)',
      clientName: 'Er. S. Narayanan',
      clientDate: nowStr,
      clientDesignation: 'Executive Engineer / Project Director (Client)',
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function createEmptyBorehole(boreholeId = 'BH-02'): BoreholeRecord {
  const nowStr = new Date().toISOString().split('T')[0];
  return {
    id: `bh-${Date.now()}`,
    boreholeId,
    projectName: 'Tunnel Project',
    tunnelName: 'Tunnel 01',
    chainageLabel: 'Ch. 0+000',
    collarElevation: 1000.0,
    coordinates: {
      northing: '0.00 m N',
      easting: '0.00 m E',
      elevation: '1000.00 m',
    },
    inclinationDeg: -90,
    azimuthDeg: 0,
    drillingMethod: 'Wireline Diamond Core (Triple Tube HQ3)',
    coreDiameter: 'HQ3 (61.1 mm)',
    drillingContractor: 'Contractor Name',
    pmcConsultant: 'PMC Consultant Name',
    clientEmployer: 'Client / Employer',
    loggedBy: 'Site Geologist',
    reviewedBy: 'Lead Consultant',
    startDate: nowStr,
    completionDate: nowStr,
    waterTableDepth: 5.0,
    runs: [
      {
        id: `run-${Date.now()}-1`,
        runNumber: 1,
        depthFrom: 0.0,
        depthTo: 3.0,
        runLength: 3.0,
        coreRecovered: 2.7,
        soundPiecesOver10cm: 2.2,
        tcrPercent: 90.0,
        rqdPercent: 73.3,
        rqdRating: 'Fair',
        lithology: 'Granite',
        lithologyColor: '#FB7185',
        weathering: 'W2',
        strengthGrade: 'R4',
        fractureFrequency: 4,
        coreBoxNumber: 1,
        discontinuitiesDescription: 'Sub-vertical joints, rough clean surfaces',
        remarks: 'Initial core run',
      },
    ],
    photos: [],
    signOff: {
      contractorName: '',
      contractorDate: nowStr,
      contractorDesignation: 'Contractor Geologist',
      pmcName: '',
      pmcDate: nowStr,
      pmcDesignation: 'PMC Geotechnical Engineer',
      clientName: '',
      clientDate: nowStr,
      clientDesignation: 'Client Representative',
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function loadBoreholeRecordsFromStorage(): BoreholeRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const def = createDefaultBorehole();
      localStorage.setItem(STORAGE_KEY, JSON.stringify([def]));
      return [def];
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      // Clean legacy names if any contain ESWA
      const cleaned = parsed.map((bh: BoreholeRecord) => {
        if (bh.boreholeId && bh.boreholeId.includes('ESWA')) {
          return {
            ...bh,
            boreholeId: bh.boreholeId.replace(/[-_]?ESWA[-_]?/gi, '-').replace(/--+/g, '-').replace(/^-|-$/g, '') || 'BH-01',
          };
        }
        return bh;
      });
      return cleaned;
    }
    const def = createDefaultBorehole();
    localStorage.setItem(STORAGE_KEY, JSON.stringify([def]));
    return [def];
  } catch (e) {
    console.warn('Failed to load borehole records from storage, using default', e);
    return [createDefaultBorehole()];
  }
}

export function saveBoreholeRecordsToStorage(records: BoreholeRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch (e) {
    console.error('Failed to save borehole records to storage', e);
  }
}

export function getActiveBoreholeId(): string | null {
  return localStorage.getItem(ACTIVE_BOREHOLE_KEY);
}

export function setActiveBoreholeId(id: string): void {
  localStorage.setItem(ACTIVE_BOREHOLE_KEY, id);
}

/**
 * Split continuous core runs into paginated batches for standard A4 report sheets.
 * Default 7 to 8 runs per sheet ensures full typography, header title block, and footer fit without overflow.
 */
export function chunkRunsForReport(runs: CoreRunRecord[], runsPerPage = 7): CoreRunRecord[][] {
  if (!runs || runs.length === 0) return [[]];
  const pages: CoreRunRecord[][] = [];
  for (let i = 0; i < runs.length; i += runsPerPage) {
    pages.push(runs.slice(i, i + runsPerPage));
  }
  return pages;
}

/**
 * Split core box photographic records into paginated plates for standard A4 appendix sheets.
 * 2 photographic plates per A4 page ensures high image fidelity and legible text.
 */
export function chunkPhotosForReport(photos: CoreBoxPhotoRecord[], photosPerPage = 2): CoreBoxPhotoRecord[][] {
  if (!photos || photos.length === 0) return [];
  const pages: CoreBoxPhotoRecord[][] = [];
  for (let i = 0; i < photos.length; i += photosPerPage) {
    pages.push(photos.slice(i, i + photosPerPage));
  }
  return pages;
}

/**
 * Benchmark Borehole #2: Crown Fault & Shear Zone (Sandstone & Siltstone)
 */
export function createBenchmarkFaultZoneBorehole(): BoreholeRecord {
  const nowStr = new Date().toISOString().split('T')[0];
  return {
    id: 'bh-tunnel-faultzone-02',
    boreholeId: 'BH-02',
    projectName: 'Infrastructure Tunnel Package-02',
    tunnelName: 'Main Drive (Southbound)',
    chainageLabel: 'Ch. 121+120',
    collarElevation: 1395.2,
    coordinates: {
      northing: '2,846,050.15 m N',
      easting: '413,210.80 m E',
      elevation: '1,395.20 m a.s.l.',
    },
    inclinationDeg: -75,
    azimuthDeg: 145,
    drillingMethod: 'Wireline Diamond Core (Triple Tube HQ3)',
    coreDiameter: 'HQ3 (61.1 mm)',
    drillingContractor: 'Alpha Geotechnical Drilling Consortium',
    pmcConsultant: 'Arup & Partners International Geotechnics',
    clientEmployer: 'National Highway & Infrastructure Authority',
    loggedBy: 'Dr. Akash D. (Lead Engineering Geologist)',
    reviewedBy: 'Chief Geotechnical PMC Engineer',
    startDate: nowStr,
    completionDate: nowStr,
    waterTableDepth: 4.2,
    runs: [
      {
        id: 'bh2-run-1',
        runNumber: 1,
        depthFrom: 0.0,
        depthTo: 3.0,
        runLength: 3.0,
        coreRecovered: 2.1,
        soundPiecesOver10cm: 0.6,
        tcrPercent: 70.0,
        rqdPercent: 20.0,
        rqdRating: 'Very Poor',
        lithology: 'Sandstone',
        lithologyColor: '#F59E0B',
        weathering: 'W4',
        strengthGrade: 'R2',
        fractureFrequency: 12,
        coreBoxNumber: 1,
        discontinuitiesDescription: 'Highly fractured colluvium & weathered sandstone, clay infill',
        remarks: 'Overburden / bedrock transition zone',
      },
      {
        id: 'bh2-run-2',
        runNumber: 2,
        depthFrom: 3.0,
        depthTo: 6.0,
        runLength: 3.0,
        coreRecovered: 2.45,
        soundPiecesOver10cm: 1.15,
        tcrPercent: 81.7,
        rqdPercent: 38.3,
        rqdRating: 'Poor',
        lithology: 'Sandstone',
        lithologyColor: '#F59E0B',
        weathering: 'W3',
        strengthGrade: 'R3',
        fractureFrequency: 8,
        coreBoxNumber: 1,
        discontinuitiesDescription: 'Bedding planes dipping 35°, iron stained slickensides',
        remarks: 'Moderately weathered sandstone unit',
      },
      {
        id: 'bh2-run-3',
        runNumber: 3,
        depthFrom: 6.0,
        depthTo: 9.0,
        runLength: 3.0,
        coreRecovered: 1.85,
        soundPiecesOver10cm: 0.45,
        tcrPercent: 61.7,
        rqdPercent: 15.0,
        rqdRating: 'Very Poor',
        lithology: 'Siltstone',
        lithologyColor: '#94A3B8',
        weathering: 'W4',
        strengthGrade: 'R1',
        fractureFrequency: 16,
        coreBoxNumber: 2,
        discontinuitiesDescription: 'Major shear zone, fault breccia and clay gouge matrix (150mm thick)',
        remarks: 'Intersected Crown Fault F-2; continuous water ingress recorded (15 L/min)',
      },
      {
        id: 'bh2-run-4',
        runNumber: 4,
        depthFrom: 9.0,
        depthTo: 12.0,
        runLength: 3.0,
        coreRecovered: 2.7,
        soundPiecesOver10cm: 1.6,
        tcrPercent: 90.0,
        rqdPercent: 53.3,
        rqdRating: 'Fair',
        lithology: 'Sandstone',
        lithologyColor: '#F59E0B',
        weathering: 'W2',
        strengthGrade: 'R4',
        fractureFrequency: 5,
        coreBoxNumber: 2,
        discontinuitiesDescription: 'Footwall block, moderately spaced joints dipping 50°',
        remarks: 'Exiting shear zone into sound footwall sandstone',
      },
      {
        id: 'bh2-run-5',
        runNumber: 5,
        depthFrom: 12.0,
        depthTo: 15.0,
        runLength: 3.0,
        coreRecovered: 2.9,
        soundPiecesOver10cm: 2.25,
        tcrPercent: 96.7,
        rqdPercent: 75.0,
        rqdRating: 'Good',
        lithology: 'Sandstone',
        lithologyColor: '#F59E0B',
        weathering: 'W2',
        strengthGrade: 'R4',
        fractureFrequency: 3,
        coreBoxNumber: 3,
        discontinuitiesDescription: 'Tight rough planar joints, calcite healing',
        remarks: 'Competent tunnel crown zone',
      },
      {
        id: 'bh2-run-6',
        runNumber: 6,
        depthFrom: 15.0,
        depthTo: 18.0,
        runLength: 3.0,
        coreRecovered: 3.0,
        soundPiecesOver10cm: 2.75,
        tcrPercent: 100.0,
        rqdPercent: 91.7,
        rqdRating: 'Excellent',
        lithology: 'Quartzite',
        lithologyColor: '#EAB308',
        weathering: 'W1',
        strengthGrade: 'R5',
        fractureFrequency: 1,
        coreBoxNumber: 3,
        discontinuitiesDescription: 'Very hard, fresh quartzite, pristine closed joints',
        remarks: 'Tunnel invert exploration completed',
      },
    ],
    photos: [
      {
        id: 'bh2-photo-1',
        boxNumber: 1,
        depthFrom: 0.0,
        depthTo: 6.0,
        photoUrl: '',
        photoTitle: 'Core Box #01 (0.00m to 6.00m) - Overburden & Bedrock',
        takenAt: nowStr,
        condition: 'Wet',
        notes: 'Upper weathered sandstone showing intense fracturing and iron oxide staining.',
      },
      {
        id: 'bh2-photo-2',
        boxNumber: 2,
        depthFrom: 6.0,
        depthTo: 12.0,
        photoUrl: '',
        photoTitle: 'Core Box #02 (6.00m to 12.00m) - Fault Breccia & Footwall',
        takenAt: nowStr,
        condition: 'Wet',
        notes: 'Crushed siltstone shear zone at 7.2m-8.1m; transition to competent footwall.',
      },
    ],
    signOff: {
      contractorName: 'Er. Rajesh Kumar',
      contractorDate: nowStr,
      contractorDesignation: 'Senior Drilling Geologist (Contractor)',
      pmcName: 'Dr. Michael Chen',
      pmcDate: nowStr,
      pmcDesignation: 'Chief Tunnel Geotechnical Consultant (PMC)',
      clientName: 'Er. S. Narayanan',
      clientDate: nowStr,
      clientDesignation: 'Executive Engineer / Project Director (Client)',
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Benchmark Borehole #3: Deep Cavern Intake (Basalt & Amphibolite)
 */
export function createBenchmarkCavernBorehole(): BoreholeRecord {
  const nowStr = new Date().toISOString().split('T')[0];
  return {
    id: 'bh-tunnel-cavern-03',
    boreholeId: 'BH-03',
    projectName: 'Underground Powerhouse & Cavern Complex',
    tunnelName: 'Headrace Intake Tunnel #01',
    chainageLabel: 'Ch. 0+450',
    collarElevation: 1610.0,
    coordinates: {
      northing: '2,851,200.40 m N',
      easting: '418,940.60 m E',
      elevation: '1,610.00 m a.s.l.',
    },
    inclinationDeg: -90,
    azimuthDeg: 0,
    drillingMethod: 'Wireline Diamond Core (Triple Tube HQ3)',
    coreDiameter: 'HQ3 (61.1 mm)',
    drillingContractor: 'Alpha Geotechnical Drilling Consortium',
    pmcConsultant: 'Arup & Partners International Geotechnics',
    clientEmployer: 'National Highway & Infrastructure Authority',
    loggedBy: 'Dr. Akash D. (Lead Engineering Geologist)',
    reviewedBy: 'Chief Geotechnical PMC Engineer',
    startDate: nowStr,
    completionDate: nowStr,
    waterTableDepth: 8.5,
    runs: [
      {
        id: 'bh3-run-1',
        runNumber: 1,
        depthFrom: 0.0,
        depthTo: 3.0,
        runLength: 3.0,
        coreRecovered: 2.85,
        soundPiecesOver10cm: 2.4,
        tcrPercent: 95.0,
        rqdPercent: 80.0,
        rqdRating: 'Good',
        lithology: 'Basalt',
        lithologyColor: '#64748B',
        weathering: 'W2',
        strengthGrade: 'R5',
        fractureFrequency: 2,
        coreBoxNumber: 1,
        discontinuitiesDescription: 'Columnar cooling joints, tight calcite infill',
        remarks: 'Portal bench excavation level',
      },
      {
        id: 'bh3-run-2',
        runNumber: 2,
        depthFrom: 3.0,
        depthTo: 6.0,
        runLength: 3.0,
        coreRecovered: 3.0,
        soundPiecesOver10cm: 2.9,
        tcrPercent: 100.0,
        rqdPercent: 96.7,
        rqdRating: 'Excellent',
        lithology: 'Basalt',
        lithologyColor: '#64748B',
        weathering: 'W1',
        strengthGrade: 'R5',
        fractureFrequency: 1,
        coreBoxNumber: 1,
        discontinuitiesDescription: 'Massive dense crystalline basalt, closed pristine joints',
        remarks: 'Very high competence rock mass',
      },
      {
        id: 'bh3-run-3',
        runNumber: 3,
        depthFrom: 6.0,
        depthTo: 9.0,
        runLength: 3.0,
        coreRecovered: 3.0,
        soundPiecesOver10cm: 2.85,
        tcrPercent: 100.0,
        rqdPercent: 95.0,
        rqdRating: 'Excellent',
        lithology: 'Amphibolite',
        lithologyColor: '#475569',
        weathering: 'W1',
        strengthGrade: 'R5',
        fractureFrequency: 1,
        coreBoxNumber: 2,
        discontinuitiesDescription: 'Foliated metamorphic contact, healed epidote veins',
        remarks: 'Cavern crown horizon verified',
      },
      {
        id: 'bh3-run-4',
        runNumber: 4,
        depthFrom: 9.0,
        depthTo: 12.0,
        runLength: 3.0,
        coreRecovered: 3.0,
        soundPiecesOver10cm: 2.95,
        tcrPercent: 100.0,
        rqdPercent: 98.3,
        rqdRating: 'Excellent',
        lithology: 'Amphibolite',
        lithologyColor: '#475569',
        weathering: 'W1',
        strengthGrade: 'R6',
        fractureFrequency: 0,
        coreBoxNumber: 2,
        discontinuitiesDescription: 'Completely intact core cylinders > 1.2m continuous',
        remarks: 'Extremely strong rock mass (UCS > 220 MPa)',
      },
    ],
    photos: [
      {
        id: 'bh3-photo-1',
        boxNumber: 1,
        depthFrom: 0.0,
        depthTo: 6.0,
        photoUrl: '',
        photoTitle: 'Core Box #01 (0.00m to 6.00m) - Dense Basalt',
        takenAt: nowStr,
        condition: 'Wet',
        notes: 'Pristine massive basalt cores with excellent recovery and sound cylinders.',
      },
    ],
    signOff: {
      contractorName: 'Er. Rajesh Kumar',
      contractorDate: nowStr,
      contractorDesignation: 'Senior Drilling Geologist (Contractor)',
      pmcName: 'Dr. Michael Chen',
      pmcDate: nowStr,
      pmcDesignation: 'Chief Tunnel Geotechnical Consultant (PMC)',
      clientName: 'Er. S. Narayanan',
      clientDate: nowStr,
      clientDesignation: 'Executive Engineer / Project Director (Client)',
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Returns the complete set of 3 standard benchmark geotechnical boreholes
 */
export function getAllBenchmarkBoreholes(): BoreholeRecord[] {
  return [
    createDefaultBorehole(),
    createBenchmarkFaultZoneBorehole(),
    createBenchmarkCavernBorehole(),
  ];
}

/**
 * Duplicate an existing borehole record to quickly spin up the next hole
 */
export function duplicateBoreholeRecord(source: BoreholeRecord, nextBoreholeId: string): BoreholeRecord {
  const nowStr = new Date().toISOString().split('T')[0];
  return {
    ...source,
    id: `bh-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    boreholeId: nextBoreholeId,
    startDate: nowStr,
    completionDate: nowStr,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    runs: source.runs.map((r, i) => ({
      ...r,
      id: `run-${Date.now()}-${i + 1}`,
    })),
    photos: source.photos.map((p, i) => ({
      ...p,
      id: `photo-${Date.now()}-${i + 1}`,
      takenAt: nowStr,
    })),
  };
}

/**
 * Export borehole records to formatted JSON string
 */
export function exportBoreholesToJSON(records: BoreholeRecord[]): string {
  return JSON.stringify(
    {
      version: '1.0',
      exportType: 'Geotechnical_Borehole_Registry_Archive',
      exportedAt: new Date().toISOString(),
      recordCount: records.length,
      boreholes: records,
    },
    null,
    2
  );
}

/**
 * Trigger client-side JSON download of boreholes
 */
export function downloadBoreholeJSONFile(records: BoreholeRecord[], filename?: string): void {
  const jsonContent = exportBoreholesToJSON(records);
  const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename || `Geotechnical_Core_Logs_Backup_${new Date().toISOString().split('T')[0]}.json`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export all continuous runs from given boreholes into standard CSV format for GIS/CAD/Excel
 */
export function exportRunsToCSV(records: BoreholeRecord[]): string {
  const headers = [
    'Borehole_ID',
    'Project_Name',
    'Tunnel_Name',
    'Chainage',
    'Collar_Elevation_m',
    'Inclination_Deg',
    'Azimuth_Deg',
    'Run_Number',
    'Depth_From_m',
    'Depth_To_m',
    'Run_Length_m',
    'Core_Recovered_m',
    'TCR_Percent',
    'Sound_Pieces_100mm_m',
    'RQD_Percent',
    'RQD_Rating',
    'Lithology',
    'Weathering_Grade',
    'Strength_Grade',
    'Fracture_Frequency_per_m',
    'Core_Box_Number',
    'Discontinuities_Remarks',
  ];

  const rows: string[] = [headers.join(',')];

  records.forEach((bh) => {
    bh.runs.forEach((r) => {
      const cleanRemarks = `"${(r.remarks || r.discontinuitiesDescription || '').replace(/"/g, '""')}"`;
      rows.push(
        [
          `"${bh.boreholeId}"`,
          `"${bh.projectName.replace(/"/g, '""')}"`,
          `"${(bh.tunnelName || '').replace(/"/g, '""')}"`,
          `"${(bh.chainageLabel || '').replace(/"/g, '""')}"`,
          bh.collarElevation || 0,
          bh.inclinationDeg,
          bh.azimuthDeg,
          r.runNumber,
          r.depthFrom.toFixed(2),
          r.depthTo.toFixed(2),
          r.runLength.toFixed(2),
          r.coreRecovered.toFixed(2),
          r.tcrPercent.toFixed(1),
          r.soundPiecesOver10cm.toFixed(2),
          r.rqdPercent.toFixed(1),
          `"${r.rqdRating}"`,
          `"${r.lithology.replace(/"/g, '""')}"`,
          `"${r.weathering}"`,
          `"${r.strengthGrade}"`,
          r.fractureFrequency || 0,
          `"${r.coreBoxNumber}"`,
          cleanRemarks,
        ].join(',')
      );
    });
  });

  return rows.join('\r\n');
}

/**
 * Trigger client-side CSV download
 */
export function downloadRunsCSVFile(records: BoreholeRecord[], filename?: string): void {
  const csvContent = exportRunsToCSV(records);
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename || `Geotechnical_Core_Runs_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Validate and import boreholes from JSON string
 */
export function importBoreholesFromJSON(jsonStr: string): { success: boolean; records: BoreholeRecord[]; message: string } {
  try {
    const parsed = JSON.parse(jsonStr);
    let rawList: unknown[] = [];
    if (Array.isArray(parsed)) {
      rawList = parsed;
    } else if (parsed && Array.isArray(parsed.boreholes)) {
      rawList = parsed.boreholes;
    } else {
      return { success: false, records: [], message: 'JSON format invalid: expected an array of boreholes or a backup container.' };
    }

    const validated: BoreholeRecord[] = [];
    for (const item of rawList) {
      if (item && typeof item === 'object' && 'boreholeId' in item && 'runs' in item) {
        const bh = item as BoreholeRecord;
        if (!bh.id) bh.id = `bh-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        if (!Array.isArray(bh.runs)) bh.runs = [];
        if (!Array.isArray(bh.photos)) bh.photos = [];
        if (!bh.signOff) {
          bh.signOff = {
            contractorName: '',
            contractorDate: '',
            contractorDesignation: '',
            pmcName: '',
            pmcDate: '',
            pmcDesignation: '',
            clientName: '',
            clientDate: '',
            clientDesignation: '',
          };
        }
        validated.push(bh);
      }
    }

    if (validated.length === 0) {
      return { success: false, records: [], message: 'No valid geotechnical borehole records found in the uploaded file.' };
    }

    return {
      success: true,
      records: validated,
      message: `Successfully validated and parsed ${validated.length} borehole log(s).`,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { success: false, records: [], message: `Failed to parse JSON file: ${errorMsg}` };
  }
}

/**
 * Storage diagnostics and capacity metrics
 */
export function calculateStorageUsage(): {
  usedBytes: number;
  formattedSize: string;
  percentageOfLimit: number;
  boreholeCount: number;
  runCount: number;
  photoCount: number;
} {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || '[]';
    const usedBytes = new Blob([raw]).size;
    const records: BoreholeRecord[] = JSON.parse(raw);
    const boreholeCount = Array.isArray(records) ? records.length : 0;
    let runCount = 0;
    let photoCount = 0;
    if (Array.isArray(records)) {
      records.forEach((b) => {
        runCount += b.runs?.length || 0;
        photoCount += b.photos?.length || 0;
      });
    }
    const maxLimitBytes = 5 * 1024 * 1024; // Standard 5MB localStorage threshold
    const percentageOfLimit = Math.min(100, Math.round((usedBytes / maxLimitBytes) * 100));

    let formattedSize = `${usedBytes} B`;
    if (usedBytes >= 1024 * 1024) {
      formattedSize = `${(usedBytes / (1024 * 1024)).toFixed(2)} MB`;
    } else if (usedBytes >= 1024) {
      formattedSize = `${(usedBytes / 1024).toFixed(1)} KB`;
    }

    return {
      usedBytes,
      formattedSize,
      percentageOfLimit,
      boreholeCount,
      runCount,
      photoCount,
    };
  } catch {
    return {
      usedBytes: 0,
      formattedSize: '0 KB',
      percentageOfLimit: 0,
      boreholeCount: 0,
      runCount: 0,
      photoCount: 0,
    };
  }
}

