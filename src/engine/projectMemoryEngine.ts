import {
  PlaneSurfaceConfig,
  Point2D,
  SavedDesignGeometryRecord,
  SavedProjectRecord,
  SectionToSectionVolumeRow,
  TunnelGeometry,
} from '../types/tunnel';

const SAVED_GEOMETRIES_STORAGE_KEY = 'eswa_tunnel_saved_geometries_v20_fresh';
const PROJECT_MEMORY_STORAGE_KEY = 'eswa_tunnel_project_memory_v20_fresh';

export interface ProjectLocationChainageGroup {
  groupKey: string;
  projectName: string;
  location: string;
  tunnelName: string;
  faces: SavedProjectRecord[]; // Sorted ascending by numericChainageMeters
  minRdMeters: number | null;
  maxRdMeters: number | null;
  totalOverbreakAreaSqM: number;
  totalUndercutAreaSqM: number;
  totalOverbreakVolM3: number;
  totalUndercutVolM3: number;
}

/**
 * Generates a crisp SVG Data URL Engineering Logo Badge for Client, Contractor, or Consultant
 * (Used when user clicks "Generate Stamp/Badge" or tests logo placement before uploading custom PNG/SVG).
 */
export function generateSampleEngineeringLogoDataUrl(
  role: 'CLIENT' | 'CONTRACTOR' | 'CONSULTANT',
  orgName: string
): string {
  const cleanName = (orgName || role).trim().toUpperCase().slice(0, 22);
  const words = cleanName.split(/\s+/).filter(Boolean);
  const initials =
    words.length >= 2
      ? `${words[0][0]}${words[1][0]}${words[2]?.[0] || ''}`
      : cleanName.slice(0, 3);

  const palette =
    role === 'CLIENT'
      ? { bg: '#0F172A', border: '#0284C7', accent: '#38BDF8', badge: 'EMPLOYER / CLIENT' }
      : role === 'CONTRACTOR'
      ? { bg: '#064E3B', border: '#059669', accent: '#34D399', badge: 'CONTRACTOR' }
      : { bg: '#312E81', border: '#4F46E5', accent: '#818CF8', badge: 'CONSULTANT' };

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="84" viewBox="0 0 240 84">
    <rect x="2" y="2" width="236" height="80" rx="6" fill="${palette.bg}" stroke="${palette.border}" stroke-width="3"/>
    <circle cx="42" cy="42" r="26" fill="none" stroke="${palette.accent}" stroke-width="2.5"/>
    <path d="M 24 52 A 20 20 0 0 1 60 52 L 60 60 L 24 60 Z" fill="${palette.accent}" fill-opacity="0.25" stroke="${palette.accent}" stroke-width="1.6"/>
    <text x="42" y="46" text-anchor="middle" font-family="monospace, sans-serif" font-size="14" font-weight="800" fill="#FFFFFF">${initials}</text>
    <text x="80" y="28" font-family="monospace, sans-serif" font-size="9.5" font-weight="700" fill="${palette.accent}">${palette.badge}</text>
    <text x="80" y="48" font-family="monospace, sans-serif" font-size="12" font-weight="800" fill="#FFFFFF">${cleanName.slice(0, 18)}</text>
    <text x="80" y="64" font-family="monospace, sans-serif" font-size="8.5" font-weight="600" fill="#CBD5E1">TUNNELING &amp; GEOTECH</text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * Extracts numeric chainage / RD in meters from strings like:
 * - "RD 1423.50m" -> 1423.5
 * - "CH 1+423.50" -> 1423.5
 * - "RD 1420.00m - 1423.50m" -> 1423.5
 */
export function parseNumericChainageMeters(
  faceChainage: string,
  chainageRange?: string
): number | null {
  const target = (faceChainage || chainageRange || '').trim();
  if (!target) return null;

  // Check station format e.g. "1+423.50"
  const stationMatch = target.match(/(\d+)\s*\+\s*(\d+(?:\.\d+)?)/);
  if (stationMatch) {
    const km = parseFloat(stationMatch[1]);
    const m = parseFloat(stationMatch[2]);
    if (!Number.isNaN(km) && !Number.isNaN(m)) {
      return Number((km * 1000 + m).toFixed(2));
    }
  }

  // Otherwise extract all numbers and take the last one (e.g., face RD in "1420.00 - 1423.50")
  const numMatches = target.match(/\d+(?:\.\d+)?/g);
  if (numMatches && numMatches.length > 0) {
    const val = parseFloat(numMatches[numMatches.length - 1]);
    if (!Number.isNaN(val)) return Number(val.toFixed(2));
  }
  return null;
}

/**
 * Creates a rectangular Plane-Surface Geometry in meters:
 * x in [-width/2, +width/2], y in [0, height]
 */
export function createPlaneSurfaceGeometry(config: PlaneSurfaceConfig): TunnelGeometry {
  const w = Math.max(1.0, Number(config.widthMeters.toFixed(2)));
  const h = Math.max(1.0, Number(config.heightMeters.toFixed(2)));
  const halfW = w / 2;

  const pts: Point2D[] = [
    { x: -halfW, y: 0 },
    { x: -halfW, y: h },
    { x: halfW, y: h },
    { x: halfW, y: 0 },
  ];

  return {
    width: w,
    height: h,
    wallHeight: h,
    crownGeometry: 'custom_cad',
    crownRadius: w,
    units: 'm',
    source: 'manual',
    cadFileName: `Plane Surface (${config.planeName})`,
    crossSectionPoints: pts,
    crownArcLength: w,
    isPlaneSurface: true,
    planeSurfaceConfig: { ...config, enabled: true },
  };
}

export function createDefaultPlaneSurfaceConfig(): PlaneSurfaceConfig {
  return {
    enabled: false,
    planeName: 'Portal Cut Wall / Rock Bench B-1',
    widthMeters: 10.0,
    heightMeters: 6.0,
    planeStrikeDeg: 160,
    planeDipDirectionDeg: 250,
    planeDipDeg: 85,
    elevationMeters: 1240.0,
    location: 'Main Portal Bench Slope',
  };
}

export function loadSavedDesignGeometries(): SavedDesignGeometryRecord[] {
  if (typeof window !== 'undefined' && window.akashDesktop?.isElectron) {
    try {
      const diskGeoms = window.akashDesktop.loadGeometriesFromDiskSync();
      if (Array.isArray(diskGeoms) && diskGeoms.length > 0) {
        return diskGeoms;
      }
    } catch {
      // Fallback to localStorage
    }
  }

  try {
    const raw = localStorage.getItem(SAVED_GEOMETRIES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (g) => g && typeof g.id === 'string' && !g.id.startsWith('geom-sample-')
        );
      }
    }
  } catch {
    // Ignore storage read errors
  }

  return [];
}

export function saveDesignGeometryToLibrary(
  record: Omit<SavedDesignGeometryRecord, 'id' | 'savedAt'> & { id?: string }
): SavedDesignGeometryRecord[] {
  const existing = loadSavedDesignGeometries();
  const newItem: SavedDesignGeometryRecord = {
    id: record.id || `geom-${Date.now()}`,
    name: record.name,
    tunnelName: record.tunnelName,
    location: record.location,
    chainage: record.chainage,
    savedAt: new Date().toISOString(),
    geometry: record.geometry,
  };
  const next = [newItem, ...existing.filter((g) => g.id !== newItem.id)].slice(0, 30);
  if (typeof window !== 'undefined' && window.akashDesktop?.isElectron) {
    window.akashDesktop.saveGeometriesToDisk(next).catch(() => {});
  }
  try {
    localStorage.setItem(SAVED_GEOMETRIES_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore quota errors
  }
  return next;
}

export function deleteSavedDesignGeometry(id: string): SavedDesignGeometryRecord[] {
  const next = loadSavedDesignGeometries().filter((g) => g.id !== id);
  if (typeof window !== 'undefined' && window.akashDesktop?.isElectron) {
    window.akashDesktop.saveGeometriesToDisk(next).catch(() => {});
  }
  try {
    localStorage.setItem(SAVED_GEOMETRIES_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore errors
  }
  return next;
}

export function loadSavedProjectsFromMemory(): SavedProjectRecord[] {
  if (typeof window !== 'undefined' && window.akashDesktop?.isElectron) {
    try {
      const diskProjects = window.akashDesktop.loadProjectsFromDiskSync();
      if (Array.isArray(diskProjects) && diskProjects.length > 0) {
        return diskProjects;
      }
    } catch {
      // Fallback to localStorage
    }
  }

  try {
    const raw = localStorage.getItem(PROJECT_MEMORY_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (p) => p && typeof p.id === 'string' && !p.id.startsWith('proj-sample-')
        );
      }
    }
  } catch {
    // Ignore storage read errors
  }
  return [];
}

/**
 * Saves or updates a complete Project Record in Project File Memory.
 * Indexed by (Project + Location + Tunnel + Face Chainage).
 */
export function saveProjectRecordToMemory(
  record: SavedProjectRecord,
  overwriteMatchingKey = true
): { records: SavedProjectRecord[]; savedRecord: SavedProjectRecord; storageWarning?: string } {
  const existing = loadSavedProjectsFromMemory();
  const normKey = (r: {
    projectName?: string;
    tunnelName: string;
    location: string;
    faceChainage: string;
    chainage: string;
  }) =>
    `${(r.projectName || '').trim().toLowerCase()}|${(r.location || '')
      .trim()
      .toLowerCase()}|${(r.tunnelName || '').trim().toLowerCase()}|${(
      r.faceChainage ||
      r.chainage ||
      ''
    )
      .trim()
      .toLowerCase()}`;

  const targetKey = normKey(record);
  const replacedIds: string[] = [];
  const filtered = existing.filter((item) => {
    if (item.id === record.id) return false;
    if (overwriteMatchingKey && normKey(item) === targetKey) {
      replacedIds.push(item.id);
      return false;
    }
    return true;
  });

  const next = [record, ...filtered].slice(0, 80);

  if (typeof window !== 'undefined' && window.akashDesktop?.isElectron) {
    for (const oldId of replacedIds) {
      window.akashDesktop.deleteProjectFromDisk(oldId).catch(() => {});
    }
    window.akashDesktop.saveProjectToDisk(record).catch(() => {});
  }

  try {
    localStorage.setItem(PROJECT_MEMORY_STORAGE_KEY, JSON.stringify(next));
    return { records: next, savedRecord: record };
  } catch {
    try {
      const compactNext = next.map((proj, idx) => {
        if (idx === 0) return proj;
        const compactPhotos = { ...proj.photos };
        (['face', 'crown', 'leftWall', 'rightWall'] as const).forEach((s) => {
          compactPhotos[s] = {
            ...compactPhotos[s],
            supportingPhotos: [],
            warpedImage: null,
          };
        });
        return { ...proj, photos: compactPhotos };
      });
      localStorage.setItem(PROJECT_MEMORY_STORAGE_KEY, JSON.stringify(compactNext));
      return {
        records: next,
        savedRecord: record,
      };
    } catch {
      return {
        records: next,
        savedRecord: record,
        storageWarning:
          typeof window !== 'undefined' && window.akashDesktop?.isElectron
            ? undefined
            : 'Saved in active session memory (use Export .akash.json for large high-res photo archives).',
      };
    }
  }
}

export function deleteProjectRecordFromMemory(id: string): SavedProjectRecord[] {
  const next = loadSavedProjectsFromMemory().filter((r) => r.id !== id);
  if (typeof window !== 'undefined' && window.akashDesktop?.isElectron) {
    window.akashDesktop.deleteProjectFromDisk(id).catch(() => {});
  }
  try {
    localStorage.setItem(PROJECT_MEMORY_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore errors
  }
  return next;
}

/**
 * Searches saved Project Records by Project Name, Tunnel Name, Location, Chainage/RD, and Date.
 */
export function filterSavedProjects(
  records: SavedProjectRecord[],
  filters: {
    projectQuery?: string;
    tunnelQuery?: string;
    locationQuery?: string;
    chainageQuery?: string;
    dateQuery?: string;
  }
): SavedProjectRecord[] {
  const pq = (filters.projectQuery || '').trim().toLowerCase();
  const tq = (filters.tunnelQuery || '').trim().toLowerCase();
  const lq = (filters.locationQuery || '').trim().toLowerCase();
  const cq = (filters.chainageQuery || '').trim().toLowerCase();
  const dq = (filters.dateQuery || '').trim().toLowerCase();

  return records.filter((rec) => {
    const recProj = (
      rec.projectName ||
      rec.settings?.projectName ||
      rec.sheetConfig?.projectName ||
      'Underground Tunnel Project'
    ).toLowerCase();
    if (pq && !recProj.includes(pq)) return false;
    if (tq && !(rec.tunnelName || '').toLowerCase().includes(tq)) return false;
    if (lq && !(rec.location || rec.settings?.locationName || '').toLowerCase().includes(lq))
      return false;
    if (
      cq &&
      !(rec.faceChainage || '').toLowerCase().includes(cq) &&
      !(rec.chainage || '').toLowerCase().includes(cq)
    ) {
      return false;
    }
    if (dq && !(rec.date || '').toLowerCase().includes(dq)) return false;
    return true;
  });
}

/**
 * Groups saved face records hierarchically by:
 * Project Name -> Location / Adit -> Tunnel Name -> Chainage Sequence (sorted by numeric RD)
 */
export function groupSavedProjectsByHierarchy(
  records: SavedProjectRecord[]
): ProjectLocationChainageGroup[] {
  const map = new Map<string, ProjectLocationChainageGroup>();

  for (const rec of records) {
    const projectName =
      (
        rec.projectName ||
        rec.settings?.projectName ||
        rec.sheetConfig?.projectName ||
        'Underground Tunnel Project'
      ).trim() || 'Underground Tunnel Project';
    const location =
      (rec.location || rec.settings?.locationName || rec.settings?.location || 'Main Heading').trim() ||
      'Main Heading';
    const tunnelName = (rec.tunnelName || 'Tunnel Section 01').trim() || 'Tunnel Section 01';
    const key = `${projectName.toLowerCase()}|${location.toLowerCase()}|${tunnelName.toLowerCase()}`;

    if (!map.has(key)) {
      map.set(key, {
        groupKey: key,
        projectName,
        location,
        tunnelName,
        faces: [],
        minRdMeters: null,
        maxRdMeters: null,
        totalOverbreakAreaSqM: 0,
        totalUndercutAreaSqM: 0,
        totalOverbreakVolM3: 0,
        totalUndercutVolM3: 0,
      });
    }

    const grp = map.get(key)!;
    grp.faces.push(rec);
    grp.totalOverbreakAreaSqM = Number(
      (grp.totalOverbreakAreaSqM + (rec.quantitySummary?.overbreakAreaSqM || 0)).toFixed(2)
    );
    grp.totalUndercutAreaSqM = Number(
      (grp.totalUndercutAreaSqM + (rec.quantitySummary?.undercutAreaSqM || 0)).toFixed(2)
    );
    grp.totalOverbreakVolM3 = Number(
      (grp.totalOverbreakVolM3 + (rec.quantitySummary?.overbreakVolumeM3 || 0)).toFixed(2)
    );
    grp.totalUndercutVolM3 = Number(
      (grp.totalUndercutVolM3 + (rec.quantitySummary?.undercutVolumeM3 || 0)).toFixed(2)
    );
  }

  const groups = Array.from(map.values());
  for (const grp of groups) {
    grp.faces.sort((a, b) => {
      const rdA =
        typeof a.numericChainageMeters === 'number'
          ? a.numericChainageMeters
          : parseNumericChainageMeters(a.faceChainage, a.chainage) ?? 0;
      const rdB =
        typeof b.numericChainageMeters === 'number'
          ? b.numericChainageMeters
          : parseNumericChainageMeters(b.faceChainage, b.chainage) ?? 0;
      return rdA - rdB;
    });
    const rds = grp.faces
      .map((f) =>
        typeof f.numericChainageMeters === 'number'
          ? f.numericChainageMeters
          : parseNumericChainageMeters(f.faceChainage, f.chainage)
      )
      .filter((v): v is number => typeof v === 'number' && !Number.isNaN(v));
    if (rds.length > 0) {
      grp.minRdMeters = Math.min(...rds);
      grp.maxRdMeters = Math.max(...rds);
    }
  }

  return groups;
}

/**
 * Exports all stored faces organized by Project, Location, Tunnel & Chainage to a CSV ledger.
 */
export function exportProjectHierarchyRegisterToCSV(records: SavedProjectRecord[]): string {
  const headers = [
    'Project Name',
    'Location / Adit',
    'Tunnel Name',
    'Face Chainage (RD)',
    'Chainage Interval',
    'Numeric RD (m)',
    'Mapping Date',
    'Mapped By',
    'Width (m)',
    'Height (m)',
    'Design Area (m2)',
    'Surveyed Area (m2)',
    'Overbreak Area (m2)',
    'Overbreak (%)',
    'Max Overbreak (m)',
    'Overbreak Vol (m3)',
    'Undercut Area (m2)',
    'Undercut (%)',
    'Max Undercut (m)',
    'Undercut Vol (m3)',
    'Mapped Joints',
    'Survey Control Pts',
    'Lithology',
    'Client Name',
    'Contractor Name',
  ];

  const escapeCsv = (val: unknown) => {
    const s = String(val ?? '').replace(/"/g, '""');
    return `"${s}"`;
  };

  const sorted = [...records].sort((a, b) => {
    const pA = (a.projectName || a.settings?.projectName || '').localeCompare(
      b.projectName || b.settings?.projectName || ''
    );
    if (pA !== 0) return pA;
    const lA = (a.location || '').localeCompare(b.location || '');
    if (lA !== 0) return lA;
    return (a.numericChainageMeters || 0) - (b.numericChainageMeters || 0);
  });

  const rows = sorted.map((r) => [
    r.projectName || r.settings?.projectName || r.sheetConfig?.projectName || 'Underground Tunnel Project',
    r.location || r.settings?.locationName || 'Main Heading',
    r.tunnelName,
    r.faceChainage,
    r.chainage,
    r.numericChainageMeters ?? '',
    r.date,
    r.settings?.mappedBy || '',
    r.geometry?.width?.toFixed(2) || '',
    r.geometry?.height?.toFixed(2) || '',
    r.quantitySummary?.designAreaSqM?.toFixed(2) || '',
    r.quantitySummary?.surveyedAreaSqM?.toFixed(2) || '',
    r.quantitySummary?.overbreakAreaSqM?.toFixed(2) || '',
    r.quantitySummary?.overbreakPct?.toFixed(2) || '',
    r.quantitySummary?.maxOverbreakM?.toFixed(3) || '',
    r.quantitySummary?.overbreakVolumeM3 !== null && r.quantitySummary?.overbreakVolumeM3 !== undefined
      ? r.quantitySummary.overbreakVolumeM3.toFixed(2)
      : '',
    r.quantitySummary?.undercutAreaSqM?.toFixed(2) || '',
    r.quantitySummary?.undercutPct?.toFixed(2) || '',
    r.quantitySummary?.maxUndercutM?.toFixed(3) || '',
    r.quantitySummary?.undercutVolumeM3 !== null && r.quantitySummary?.undercutVolumeM3 !== undefined
      ? r.quantitySummary.undercutVolumeM3.toFixed(2)
      : '',
    r.joints?.length ?? 0,
    r.controlPoints?.length ?? 0,
    r.settings?.lithology || '',
    r.sheetConfig?.clientName || r.settings?.sheetConfig?.clientName || '',
    r.sheetConfig?.contractorName || r.settings?.sheetConfig?.contractorName || '',
  ]);

  return [headers.map(escapeCsv).join(','), ...rows.map((r) => r.map(escapeCsv).join(','))].join(
    '\n'
  );
}

/**
 * Section 4 & 5: Multi-Section Chainage-to-Chainage Engineering Volume Calculation.
 * Uses both the Average End Area method and the Prismoidal method between consecutive
 * surveyed cross-sections along the same tunnel & location.
 */
export function computeSectionToSectionVolumes(
  records: SavedProjectRecord[],
  tunnelNameFilter?: string
): SectionToSectionVolumeRow[] {
  const validSections = records
    .filter((r) => {
      if (
        tunnelNameFilter &&
        r.tunnelName.trim().toLowerCase() !== tunnelNameFilter.trim().toLowerCase()
      ) {
        return false;
      }
      return typeof r.numericChainageMeters === 'number' && !Number.isNaN(r.numericChainageMeters);
    })
    .slice()
    .sort((a, b) => (a.numericChainageMeters || 0) - (b.numericChainageMeters || 0));

  const rows: SectionToSectionVolumeRow[] = [];
  for (let i = 0; i < validSections.length - 1; i++) {
    const s1 = validSections[i];
    const s2 = validSections[i + 1];
    // Only compute between sections in the same tunnel
    if (s1.tunnelName.trim().toLowerCase() !== s2.tunnelName.trim().toLowerCase()) continue;
    const rd1 = s1.numericChainageMeters!;
    const rd2 = s2.numericChainageMeters!;
    const dL = Number(Math.abs(rd2 - rd1).toFixed(2));
    if (dL <= 0.01) continue;

    const desA1 = s1.quantitySummary.designAreaSqM;
    const desA2 = s2.quantitySummary.designAreaSqM;
    const survA1 = s1.quantitySummary.surveyedAreaSqM || desA1;
    const survA2 = s2.quantitySummary.surveyedAreaSqM || desA2;

    const obA1 = s1.quantitySummary.overbreakAreaSqM;
    const obA2 = s2.quantitySummary.overbreakAreaSqM;
    const ucA1 = s1.quantitySummary.undercutAreaSqM;
    const ucA2 = s2.quantitySummary.undercutAreaSqM;

    const avgEndArea = (a1: number, a2: number) => Number((((a1 + a2) / 2) * dL).toFixed(2));
    const prismoidal = (a1: number, a2: number) =>
      Number(((dL / 6) * (a1 + 4 * Math.sqrt(Math.max(0, a1 * a2)) + a2)).toFixed(2));

    const dVol = avgEndArea(desA1, desA2);
    const sVol = avgEndArea(survA1, survA2);
    const obAvg = avgEndArea(obA1, obA2);
    const obPrism = prismoidal(obA1, obA2);
    const ucAvg = avgEndArea(ucA1, ucA2);
    const ucPrism = prismoidal(ucA1, ucA2);

    rows.push({
      id: `vol-${s1.id}-${s2.id}`,
      fromSectionId: s1.id,
      toSectionId: s2.id,
      fromChainageLabel: s1.faceChainage || s1.chainage,
      toChainageLabel: s2.faceChainage || s2.chainage,
      fromRdMeters: rd1,
      toRdMeters: rd2,
      intervalLengthMeters: dL,
      designVolumeM3: dVol,
      designVolumeCubicMeters: dVol,
      surveyedVolumeM3: sVol,
      surveyedVolumeCubicMeters: sVol,
      overbreakVolumeAvgEndAreaM3: obAvg,
      overbreakVolumeAvgEndAreaCubicMeters: obAvg,
      overbreakVolumePrismoidalM3: obPrism,
      overbreakVolumePrismoidalCubicMeters: obPrism,
      undercutVolumeAvgEndAreaM3: ucAvg,
      undercutVolumeAvgEndAreaCubicMeters: ucAvg,
      undercutVolumePrismoidalM3: ucPrism,
      undercutVolumePrismoidalCubicMeters: ucPrism,
      primaryOverbreakReason:
        s2.surveyProfile?.overallOverbreakReason ||
        s1.surveyProfile?.overallOverbreakReason ||
        'Geological wedge / discontinuity Controlled Overbreak',
    });
  }

  return rows;
}
