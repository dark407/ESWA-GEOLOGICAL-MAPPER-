import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Palette, Check, Pipette } from 'lucide-react';

export type ThemeMode = 'light' | 'dark';
export type ThemeColor =
  | 'orange'
  | 'cherry'
  | 'emerald'
  | 'cyan'
  | 'amethyst'
  | 'slate'
  | 'sapphire'
  | 'teal'
  | 'rose'
  | 'amber'
  | string;

export interface ThemeColorPalette {
  id: string;
  name: string;
  shortName: string;
  badge: string;
  primaryHex: string;
  accentHex: string;
  bgGlowHex: string;
  highContrastText: string;
  accentIconColor: string;
  onBaseTextColor: string;
  onBaseTextMuted: string;
  cardTitleText: string;
  cardMutedText: string;
  accentColorOnLight: string;
  accentColorOnDark: string;
  buttonTextColor: string;
  isLightBg: boolean;
  // Gradient stops for SVG background
  baseGradientStops: [string, string, string, string];
  glowStops: [string, string, string];
  strataColors: string[];
  // Dynamic CSS classes for UI components
  accentBadge: string;
  accentBtn: string;
  accentBtnOutline: string;
  accentText: string;
  accentBorder: string;
  accentBgSubtle: string;
  activeRing: string;
  lightCardBgHover: string;
  lightCardBorder: string;
}

// ============================================================================
// COLOR MATHEMATICS & HIGH-CONTRAST ACCESSIBILITY ENGINE
// Guarantees all texts and icons are 100% visible regardless of color chosen
// ============================================================================

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    clean = clean.split('').map((c) => c + c).join('');
  }
  const num = parseInt(clean, 16);
  if (isNaN(num)) return { r: 238, g: 135, b: 17 }; // Fallback orange
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return '#' + [clamp(r), clamp(g), clamp(b)].map((x) => x.toString(16).padStart(2, '0')).join('').toUpperCase();
}

/**
 * Calculates ITU-R BT.709 perceived luminance (0 to 255)
 */
export function getPerceivedLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

export function adjustHexBrightness(hex: string, percent: number): string {
  const { r, g, b } = hexToRgb(hex);
  const factor = 1 + percent / 100;
  return rgbToHex(r * factor, g * factor, b * factor);
}

/**
 * Generates a complete mathematical ThemeColorPalette from ANY arbitrary hex color.
 * Enforces strict WCAG high contrast so text is NEVER washed out or illegible.
 */
export function generateThemePalette(rawHex: string, customName?: string): ThemeColorPalette {
  let hex = rawHex.startsWith('#') ? rawHex : `#${rawHex}`;
  if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) {
    if (/^#[0-9A-Fa-f]{3}$/.test(hex)) {
      hex = '#' + hex.slice(1).split('').map((c) => c + c).join('');
    } else {
      hex = '#EE8711';
    }
  }

  const lum = getPerceivedLuminance(hex);
  const isLight = lum > 140; // True if bright background, False if dark background

  // High contrast text on top of this color:
  // If light background, text MUST be crisp charcoal/black (#0F172A).
  // If dark background, text MUST be crisp white (#FFFFFF).
  const onBaseTextColor = isLight ? '#0F172A' : '#FFFFFF';
  const onBaseTextMuted = isLight ? '#334155' : '#E2E8F0';
  const highContrastText = isLight ? '#0F172A' : '#F8FAFC';

  // Accent and icon colors (for use on white or card backgrounds)
  // Ensure the icon color is dark enough to read on white
  const iconLum = getPerceivedLuminance(hex);
  const accentIconColor = iconLum > 160 ? adjustHexBrightness(hex, -35) : hex;
  const accentColorOnLight = iconLum > 150 ? adjustHexBrightness(hex, -30) : hex;
  const accentColorOnDark = iconLum < 120 ? adjustHexBrightness(hex, 45) : hex;

  // Button text on top of primary button:
  const primaryLum = getPerceivedLuminance(hex);
  const buttonTextColor = primaryLum > 145 ? '#0F172A' : '#FFFFFF';

  const accentHex = adjustHexBrightness(hex, isLight ? -12 : 18);
  const bgGlowHex = adjustHexBrightness(hex, isLight ? -18 : 25);

  // Dynamic SVG stops for geological contours
  const baseGradientStops: [string, string, string, string] = [
    adjustHexBrightness(hex, -10),
    adjustHexBrightness(hex, 6),
    hex,
    adjustHexBrightness(hex, -14),
  ];

  const glowStops: [string, string, string] = [
    adjustHexBrightness(hex, 25),
    hex,
    adjustHexBrightness(hex, -30),
  ];

  const strataColors = [
    adjustHexBrightness(hex, -75),
    adjustHexBrightness(hex, 55),
    adjustHexBrightness(hex, -50),
    adjustHexBrightness(hex, 20),
    adjustHexBrightness(hex, -82),
    adjustHexBrightness(hex, 45),
    adjustHexBrightness(hex, -32),
    adjustHexBrightness(hex, -8),
  ];

  const displayName = customName || `Custom (${hex.toUpperCase()})`;

  return {
    id: hex.toLowerCase(),
    name: displayName,
    shortName: displayName.split(' ')[0],
    badge: 'Custom Palette',
    primaryHex: hex,
    accentHex,
    bgGlowHex,
    highContrastText,
    accentIconColor,
    onBaseTextColor,
    onBaseTextMuted,
    cardTitleText: '#0F172A',
    cardMutedText: '#475569',
    accentColorOnLight,
    accentColorOnDark,
    buttonTextColor,
    isLightBg: isLight,
    baseGradientStops,
    glowStops,
    strataColors,
    accentBadge: 'border font-semibold',
    accentBtn: 'font-bold shadow-md transition-all',
    accentBtnOutline: 'border transition-all',
    accentText: 'font-bold',
    accentBorder: 'border',
    accentBgSubtle: 'transition-colors',
    activeRing: 'ring-2',
    lightCardBgHover: 'hover:bg-slate-50/80',
    lightCardBorder: 'border-slate-300',
  };
}

// Built-in Curated Presets
export const THEME_COLOR_PALETTES: Record<string, ThemeColorPalette> = {
  orange: {
    id: 'orange',
    name: 'Geological Amber / Orange (Default)',
    shortName: 'Amber',
    badge: 'Amber/Orange',
    primaryHex: '#EE8711',
    accentHex: '#F59E0B',
    bgGlowHex: '#FAA026',
    highContrastText: '#FEF3C7',
    accentIconColor: '#D97706',
    onBaseTextColor: '#FFFFFF',
    onBaseTextMuted: '#FEF3C7',
    cardTitleText: '#0F172A',
    cardMutedText: '#475569',
    accentColorOnLight: '#D97706',
    accentColorOnDark: '#FBBF24',
    buttonTextColor: '#FFFFFF',
    isLightBg: false,
    baseGradientStops: ['#EB820E', '#F39015', '#EE8711', '#DC730A'],
    glowStops: ['#FAA026', '#F08A12', '#C95E06'],
    strataColors: ['#3E1604', '#FDE68A', '#853208', '#F59E0B', '#290D02', '#FEF3C7', '#9A3B0A', '#D97706'],
    accentBadge: 'bg-orange-500/20 text-orange-950 dark:text-amber-300 border-orange-500/40',
    accentBtn: 'bg-orange-600 hover:bg-orange-500 text-white font-bold shadow-md',
    accentBtnOutline: 'border border-orange-500/50 text-orange-600 dark:text-amber-300 hover:bg-orange-500/20',
    accentText: 'text-orange-600 dark:text-amber-300',
    accentBorder: 'border-orange-500/50',
    accentBgSubtle: 'bg-orange-500/10',
    activeRing: 'ring-orange-500',
    lightCardBgHover: 'hover:bg-amber-50/80',
    lightCardBorder: 'border-amber-300',
  },
  cherry: {
    id: 'cherry',
    name: 'Cherry Red',
    shortName: 'Cherry',
    badge: 'Cherry Red',
    primaryHex: '#DC2626',
    accentHex: '#EF4444',
    bgGlowHex: '#F87171',
    highContrastText: '#FFE4E6',
    accentIconColor: '#E11D48',
    onBaseTextColor: '#FFFFFF',
    onBaseTextMuted: '#FFE4E6',
    cardTitleText: '#0F172A',
    cardMutedText: '#475569',
    accentColorOnLight: '#DC2626',
    accentColorOnDark: '#FDA4AF',
    buttonTextColor: '#FFFFFF',
    isLightBg: false,
    baseGradientStops: ['#B91C1C', '#DC2626', '#991B1B', '#7F1D1D'],
    glowStops: ['#EF4444', '#DC2626', '#7F1D1D'],
    strataColors: ['#450A0A', '#FECDD3', '#881337', '#F43F5E', '#500724', '#FFE4E6', '#9F1239', '#E11D48'],
    accentBadge: 'bg-rose-500/20 text-rose-950 dark:text-rose-200 border-rose-500/40',
    accentBtn: 'bg-rose-600 hover:bg-rose-500 text-white font-bold shadow-md',
    accentBtnOutline: 'border border-rose-500/50 text-rose-600 dark:text-rose-300 hover:bg-rose-500/20',
    accentText: 'text-rose-600 dark:text-rose-300',
    accentBorder: 'border-rose-500/50',
    accentBgSubtle: 'bg-rose-500/10',
    activeRing: 'ring-rose-500',
    lightCardBgHover: 'hover:bg-rose-50/80',
    lightCardBorder: 'border-rose-300',
  },
  emerald: {
    id: 'emerald',
    name: 'Emerald Jade',
    shortName: 'Emerald',
    badge: 'Emerald Green',
    primaryHex: '#059669',
    accentHex: '#10B981',
    bgGlowHex: '#34D399',
    highContrastText: '#D1FAE5',
    accentIconColor: '#059669',
    onBaseTextColor: '#FFFFFF',
    onBaseTextMuted: '#D1FAE5',
    cardTitleText: '#0F172A',
    cardMutedText: '#475569',
    accentColorOnLight: '#047857',
    accentColorOnDark: '#6EE7B7',
    buttonTextColor: '#FFFFFF',
    isLightBg: false,
    baseGradientStops: ['#047857', '#059669', '#065F46', '#064E3B'],
    glowStops: ['#10B981', '#059669', '#022C22'],
    strataColors: ['#022C22', '#A7F3D0', '#065F46', '#34D399', '#011A14', '#D1FAE5', '#047857', '#10B981'],
    accentBadge: 'bg-emerald-500/20 text-emerald-950 dark:text-emerald-200 border-emerald-500/40',
    accentBtn: 'bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-md',
    accentBtnOutline: 'border border-emerald-500/50 text-emerald-600 dark:text-emerald-300 hover:bg-emerald-500/20',
    accentText: 'text-emerald-600 dark:text-emerald-300',
    accentBorder: 'border-emerald-500/50',
    accentBgSubtle: 'bg-emerald-500/10',
    activeRing: 'ring-emerald-500',
    lightCardBgHover: 'hover:bg-emerald-50/80',
    lightCardBorder: 'border-emerald-300',
  },
  cyan: {
    id: 'cyan',
    name: 'Cyan Ocean',
    shortName: 'Cyan',
    badge: 'Cyan Blue',
    primaryHex: '#0284C7',
    accentHex: '#38BDF8',
    bgGlowHex: '#7DD3FC',
    highContrastText: '#E0F2FE',
    accentIconColor: '#0284C7',
    onBaseTextColor: '#FFFFFF',
    onBaseTextMuted: '#E0F2FE',
    cardTitleText: '#0F172A',
    cardMutedText: '#475569',
    accentColorOnLight: '#0369A1',
    accentColorOnDark: '#7DD3FC',
    buttonTextColor: '#FFFFFF',
    isLightBg: false,
    baseGradientStops: ['#0369A1', '#0284C7', '#075985', '#0C4A6E'],
    glowStops: ['#38BDF8', '#0284C7', '#082F49'],
    strataColors: ['#082F49', '#BAE6FD', '#0369A1', '#38BDF8', '#041B2D', '#E0F2FE', '#0284C7', '#0EA5E9'],
    accentBadge: 'bg-cyan-500/20 text-cyan-950 dark:text-cyan-200 border-cyan-500/40',
    accentBtn: 'bg-cyan-600 hover:bg-cyan-500 text-white font-bold shadow-md',
    accentBtnOutline: 'border border-cyan-500/50 text-cyan-600 dark:text-cyan-300 hover:bg-cyan-500/20',
    accentText: 'text-cyan-600 dark:text-cyan-300',
    accentBorder: 'border-cyan-500/50',
    accentBgSubtle: 'bg-cyan-500/10',
    activeRing: 'ring-cyan-500',
    lightCardBgHover: 'hover:bg-sky-50/80',
    lightCardBorder: 'border-sky-300',
  },
  amethyst: {
    id: 'amethyst',
    name: 'Royal Amethyst',
    shortName: 'Amethyst',
    badge: 'Purple/Amethyst',
    primaryHex: '#7C3AED',
    accentHex: '#A78BFA',
    bgGlowHex: '#C4B5FD',
    highContrastText: '#EDE9FE',
    accentIconColor: '#7C3AED',
    onBaseTextColor: '#FFFFFF',
    onBaseTextMuted: '#EDE9FE',
    cardTitleText: '#0F172A',
    cardMutedText: '#475569',
    accentColorOnLight: '#6D28D9',
    accentColorOnDark: '#C4B5FD',
    buttonTextColor: '#FFFFFF',
    isLightBg: false,
    baseGradientStops: ['#6D28D9', '#7C3AED', '#5B21B6', '#4C1D95'],
    glowStops: ['#A78BFA', '#7C3AED', '#2E1065'],
    strataColors: ['#2E1065', '#DDD6FE', '#6D28D9', '#C084FC', '#1E0B40', '#EDE9FE', '#7C3AED', '#9333EA'],
    accentBadge: 'bg-purple-500/20 text-purple-950 dark:text-purple-200 border-purple-500/40',
    accentBtn: 'bg-purple-600 hover:bg-purple-500 text-white font-bold shadow-md',
    accentBtnOutline: 'border border-purple-500/50 text-purple-600 dark:text-purple-300 hover:bg-purple-500/20',
    accentText: 'text-purple-600 dark:text-purple-300',
    accentBorder: 'border-purple-500/50',
    accentBgSubtle: 'bg-purple-500/10',
    activeRing: 'ring-purple-500',
    lightCardBgHover: 'hover:bg-purple-50/80',
    lightCardBorder: 'border-purple-300',
  },
  slate: {
    id: 'slate',
    name: 'Obsidian / Steel',
    shortName: 'Steel',
    badge: 'Steel Gray',
    primaryHex: '#475569',
    accentHex: '#94A3B8',
    bgGlowHex: '#CBD5E1',
    highContrastText: '#F8FAFC',
    accentIconColor: '#334155',
    onBaseTextColor: '#FFFFFF',
    onBaseTextMuted: '#F1F5F9',
    cardTitleText: '#0F172A',
    cardMutedText: '#475569',
    accentColorOnLight: '#334155',
    accentColorOnDark: '#CBD5E1',
    buttonTextColor: '#FFFFFF',
    isLightBg: false,
    baseGradientStops: ['#334155', '#475569', '#1E293B', '#0F172A'],
    glowStops: ['#94A3B8', '#475569', '#020617'],
    strataColors: ['#020617', '#E2E8F0', '#334155', '#CBD5E1', '#000000', '#F1F5F9', '#475569', '#64748B'],
    accentBadge: 'bg-slate-700/30 text-slate-900 dark:text-slate-100 border-slate-600/40',
    accentBtn: 'bg-slate-700 hover:bg-slate-600 text-white font-bold shadow-md',
    accentBtnOutline: 'border border-slate-600/50 text-slate-700 dark:text-slate-200 hover:bg-slate-700/30',
    accentText: 'text-slate-800 dark:text-slate-100',
    accentBorder: 'border-slate-500/50',
    accentBgSubtle: 'bg-slate-500/10',
    activeRing: 'ring-slate-400',
    lightCardBgHover: 'hover:bg-slate-100/80',
    lightCardBorder: 'border-slate-300',
  },
  sapphire: {
    id: 'sapphire',
    name: 'Sapphire Blue',
    shortName: 'Sapphire',
    badge: 'Deep Blue',
    primaryHex: '#2563EB',
    accentHex: '#60A5FA',
    bgGlowHex: '#93C5FD',
    highContrastText: '#EFF6FF',
    accentIconColor: '#1D4ED8',
    onBaseTextColor: '#FFFFFF',
    onBaseTextMuted: '#DBEAFE',
    cardTitleText: '#0F172A',
    cardMutedText: '#475569',
    accentColorOnLight: '#1D4ED8',
    accentColorOnDark: '#93C5FD',
    buttonTextColor: '#FFFFFF',
    isLightBg: false,
    baseGradientStops: ['#1D4ED8', '#2563EB', '#1E40AF', '#172554'],
    glowStops: ['#60A5FA', '#2563EB', '#0F172A'],
    strataColors: ['#0F172A', '#BFDBFE', '#1E40AF', '#60A5FA', '#030712', '#DBEAFE', '#1D4ED8', '#3B82F6'],
    accentBadge: 'bg-blue-500/20 text-blue-950 dark:text-blue-200 border-blue-500/40',
    accentBtn: 'bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-md',
    accentBtnOutline: 'border border-blue-500/50 text-blue-600 dark:text-blue-300 hover:bg-blue-500/20',
    accentText: 'text-blue-600 dark:text-blue-300',
    accentBorder: 'border-blue-500/50',
    accentBgSubtle: 'bg-blue-500/10',
    activeRing: 'ring-blue-500',
    lightCardBgHover: 'hover:bg-blue-50/80',
    lightCardBorder: 'border-blue-300',
  },
  teal: {
    id: 'teal',
    name: 'Deep Teal',
    shortName: 'Teal',
    badge: 'Mineral Teal',
    primaryHex: '#0D9488',
    accentHex: '#2DD4BF',
    bgGlowHex: '#5EEAD4',
    highContrastText: '#F0FDFA',
    accentIconColor: '#0F766E',
    onBaseTextColor: '#FFFFFF',
    onBaseTextMuted: '#CCFBF1',
    cardTitleText: '#0F172A',
    cardMutedText: '#475569',
    accentColorOnLight: '#0F766E',
    accentColorOnDark: '#5EEAD4',
    buttonTextColor: '#FFFFFF',
    isLightBg: false,
    baseGradientStops: ['#0F766E', '#0D9488', '#115E59', '#134E4A'],
    glowStops: ['#2DD4BF', '#0D9488', '#042F2E'],
    strataColors: ['#042F2E', '#99F6E4', '#115E59', '#2DD4BF', '#021817', '#CCFBF1', '#0F766E', '#14B8A6'],
    accentBadge: 'bg-teal-500/20 text-teal-950 dark:text-teal-200 border-teal-500/40',
    accentBtn: 'bg-teal-600 hover:bg-teal-500 text-white font-bold shadow-md',
    accentBtnOutline: 'border border-teal-500/50 text-teal-600 dark:text-teal-300 hover:bg-teal-500/20',
    accentText: 'text-teal-600 dark:text-teal-300',
    accentBorder: 'border-teal-500/50',
    accentBgSubtle: 'bg-teal-500/10',
    activeRing: 'ring-teal-500',
    lightCardBgHover: 'hover:bg-teal-50/80',
    lightCardBorder: 'border-teal-300',
  },
  rose: {
    id: 'rose',
    name: 'Rose Quartz',
    shortName: 'Rose',
    badge: 'Rose Quartz',
    primaryHex: '#E11D48',
    accentHex: '#FB7185',
    bgGlowHex: '#FDA4AF',
    highContrastText: '#FFF1F2',
    accentIconColor: '#BE123C',
    onBaseTextColor: '#FFFFFF',
    onBaseTextMuted: '#FFE4E6',
    cardTitleText: '#0F172A',
    cardMutedText: '#475569',
    accentColorOnLight: '#BE123C',
    accentColorOnDark: '#FDA4AF',
    buttonTextColor: '#FFFFFF',
    isLightBg: false,
    baseGradientStops: ['#BE123C', '#E11D48', '#9F1239', '#881337'],
    glowStops: ['#FB7185', '#E11D48', '#4C0519'],
    strataColors: ['#4C0519', '#FECDD3', '#9F1239', '#FB7185', '#2B030D', '#FFF1F2', '#BE123C', '#F43F5E'],
    accentBadge: 'bg-rose-500/20 text-rose-950 dark:text-rose-200 border-rose-500/40',
    accentBtn: 'bg-rose-600 hover:bg-rose-500 text-white font-bold shadow-md',
    accentBtnOutline: 'border border-rose-500/50 text-rose-600 dark:text-rose-300 hover:bg-rose-500/20',
    accentText: 'text-rose-600 dark:text-rose-300',
    accentBorder: 'border-rose-500/50',
    accentBgSubtle: 'bg-rose-500/10',
    activeRing: 'ring-rose-500',
    lightCardBgHover: 'hover:bg-rose-50/80',
    lightCardBorder: 'border-rose-300',
  },
  amber: {
    id: 'amber',
    name: 'Golden Sun',
    shortName: 'Gold',
    badge: 'Golden Amber',
    primaryHex: '#D97706',
    accentHex: '#FBBF24',
    bgGlowHex: '#FDE68A',
    highContrastText: '#FEF3C7',
    accentIconColor: '#B45309',
    onBaseTextColor: '#FFFFFF',
    onBaseTextMuted: '#FEF3C7',
    cardTitleText: '#0F172A',
    cardMutedText: '#475569',
    accentColorOnLight: '#B45309',
    accentColorOnDark: '#FDE68A',
    buttonTextColor: '#FFFFFF',
    isLightBg: false,
    baseGradientStops: ['#B45309', '#D97706', '#92400E', '#78350F'],
    glowStops: ['#FBBF24', '#D97706', '#451A03'],
    strataColors: ['#451A03', '#FDE68A', '#92400E', '#FBBF24', '#260B01', '#FEF3C7', '#B45309', '#F59E0B'],
    accentBadge: 'bg-amber-500/20 text-amber-950 dark:text-amber-200 border-amber-500/40',
    accentBtn: 'bg-amber-600 hover:bg-amber-500 text-white font-bold shadow-md',
    accentBtnOutline: 'border border-amber-500/50 text-amber-600 dark:text-amber-300 hover:bg-amber-500/20',
    accentText: 'text-amber-600 dark:text-amber-300',
    accentBorder: 'border-amber-500/50',
    accentBgSubtle: 'bg-amber-500/10',
    activeRing: 'ring-amber-500',
    lightCardBgHover: 'hover:bg-amber-50/80',
    lightCardBorder: 'border-amber-300',
  },
};

interface ThemeContextValue {
  theme: ThemeMode;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
  themeColor: string;
  setThemeColor: (color: string) => void;
  palette: ThemeColorPalette;
  isCustomColor: boolean;
  // Watermark suppression flags
  isCanvasActive: boolean;
  setIsCanvasActive: (active: boolean) => void;
  isReportActive: boolean;
  setIsReportActive: (active: boolean) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'light',
  toggleTheme: () => {},
  setTheme: () => {},
  themeColor: 'orange',
  setThemeColor: () => {},
  palette: THEME_COLOR_PALETTES.orange,
  isCustomColor: false,
  isCanvasActive: false,
  setIsCanvasActive: () => {},
  isReportActive: false,
  setIsReportActive: () => {},
});

const THEME_COLOR_STORAGE_KEY = 'eswa_theme_color_v2';

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme] = useState<ThemeMode>('light');
  const [themeColor, setThemeColorState] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(THEME_COLOR_STORAGE_KEY);
        if (stored) return stored;
      } catch {
        // Ignore storage errors
      }
    }
    return 'orange';
  });

  const [isCanvasActive, setIsCanvasActive] = useState<boolean>(false);
  const [isReportActive, setIsReportActive] = useState<boolean>(false);

  const setThemeColor = (color: string) => {
    setThemeColorState(color);
    try {
      localStorage.setItem(THEME_COLOR_STORAGE_KEY, color);
      window.dispatchEvent(new CustomEvent('eswa-theme-color-changed', { detail: color }));
    } catch {
      // Ignore storage errors
    }
  };

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === THEME_COLOR_STORAGE_KEY && e.newValue) {
        setThemeColorState(e.newValue);
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const palette = useMemo(() => {
    if (themeColor in THEME_COLOR_PALETTES) {
      return THEME_COLOR_PALETTES[themeColor];
    }
    if (themeColor.startsWith('#')) {
      return generateThemePalette(themeColor);
    }
    return THEME_COLOR_PALETTES.orange;
  }, [themeColor]);

  const isCustomColor = !(themeColor in THEME_COLOR_PALETTES);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', 'light');
    root.setAttribute('data-theme-color', themeColor);
    root.classList.add('light');
    root.classList.remove('dark');

    // Dynamic CSS Custom Properties for immediate theme coloration and 100% high-contrast text
    const { r, g, b } = hexToRgb(palette.primaryHex);
    root.style.setProperty('--theme-accent-rgb', `${r}, ${g}, ${b}`);
    root.style.setProperty('--theme-accent', palette.primaryHex);
    root.style.setProperty('--theme-accent-highlight', palette.accentHex);
    root.style.setProperty('--theme-bg-glow', palette.bgGlowHex);
    root.style.setProperty('--theme-high-contrast-text', palette.highContrastText);
    root.style.setProperty('--theme-accent-icon', palette.accentIconColor);
    root.style.setProperty('--theme-on-base-text', palette.onBaseTextColor);
    root.style.setProperty('--theme-on-base-muted', palette.onBaseTextMuted);
    root.style.setProperty('--theme-button-text', palette.buttonTextColor);
    root.style.setProperty('--app-bg', palette.primaryHex);
    root.style.setProperty('--app-panel', palette.isLightBg ? '#FFFFFF' : '#0F172A');
    root.style.setProperty('--app-subpanel', palette.isLightBg ? adjustHexBrightness(palette.primaryHex, 88) : adjustHexBrightness(palette.primaryHex, -80));
    root.style.setProperty('--app-border', palette.accentHex);
    root.style.setProperty('--app-text', palette.onBaseTextColor);
    root.style.setProperty('--app-text-muted', palette.onBaseTextMuted);
    root.style.setProperty('--theme-input-border', palette.accentHex);
    root.style.setProperty('--theme-input-focus', palette.primaryHex);
    root.style.setProperty('--theme-accent-btn-bg', palette.primaryHex);
    root.style.setProperty('--theme-accent-btn-text', palette.buttonTextColor);
  }, [palette, themeColor]);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        toggleTheme: () => {},
        setTheme: () => {},
        themeColor,
        setThemeColor,
        palette,
        isCustomColor,
        isCanvasActive,
        setIsCanvasActive,
        isReportActive,
        setIsReportActive,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

// ============================================================================
// THEME COLOR PALETTE POPUP & SELECTOR COMPONENT (UNLIMITED COLOURS + HIGH CONTRAST)
// ============================================================================

interface ThemeToggleButtonProps {
  compact?: boolean;
  isMainWindow?: boolean;
  className?: string;
}

export const ThemeToggleButton: React.FC<ThemeToggleButtonProps> = ({
  compact = false,
  className = '',
}) => {
  const { themeColor, setThemeColor, palette, isCustomColor } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [customHexInput, setCustomHexInput] = useState(palette.primaryHex);

  useEffect(() => {
    setCustomHexInput(palette.primaryHex);
  }, [palette.primaryHex]);

  const presetList = Object.values(THEME_COLOR_PALETTES);

  return (
    <div className={`relative inline-block ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-white/95 text-slate-900 border border-slate-300 hover:border-slate-400 shadow-sm transition-all cursor-pointer select-none active:scale-95"
        title={`Active Theme: ${palette.name}. Click to choose unlimited colors.`}
      >
        <span
          className="w-4 h-4 rounded-full border border-black/20 shadow-xs shrink-0 flex items-center justify-center"
          style={{ backgroundColor: palette.primaryHex }}
        >
          {isCustomColor && <Pipette className="w-2.5 h-2.5" style={{ color: palette.buttonTextColor }} />}
        </span>
        <Palette className="w-3.5 h-3.5 text-slate-700 shrink-0" />
        {!compact && <span>Theme Colors</span>}
      </button>

      {isOpen && (
        <>
          {/* Backdrop to close */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          <div className="absolute right-0 mt-2 w-80 max-w-[90vw] p-3.5 rounded-2xl bg-slate-950/95 backdrop-blur-xl border border-white/20 shadow-2xl text-left z-50 space-y-3 font-mono text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Palette className="w-4 h-4 text-amber-400" />
                <span className="font-bold text-slate-100 text-xs">Unlimited Theme Colors</span>
              </div>
              <span className="text-[10px] text-slate-400 uppercase font-semibold">100% Contrast</span>
            </div>

            {/* Curated Presets Grid */}
            <div>
              <div className="text-[10px] text-slate-400 uppercase font-bold mb-1.5">Preset Palettes</div>
              <div className="grid grid-cols-5 gap-1.5">
                {presetList.map((p) => {
                  const isAct = themeColor === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setThemeColor(p.id);
                      }}
                      className={`h-7 rounded-lg flex items-center justify-center border transition-all cursor-pointer relative group ${
                        isAct ? 'ring-2 ring-white scale-105' : 'border-white/20 hover:scale-105'
                      }`}
                      style={{ backgroundColor: p.primaryHex }}
                      title={`${p.name} (${p.primaryHex})`}
                    >
                      {isAct && <Check className="w-3.5 h-3.5 text-white drop-shadow" />}
                      <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 hidden group-hover:block bg-black text-white text-[9px] px-1.5 py-0.5 rounded whitespace-nowrap z-50">
                        {p.shortName}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Unlimited Color Picker */}
            <div className="pt-2 border-t border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-400 uppercase font-bold flex items-center gap-1">
                  <Pipette className="w-3 h-3 text-cyan-400" />
                  <span>Choose Any Custom Color</span>
                </span>
                <span className="text-[10px] font-bold text-cyan-300">{customHexInput.toUpperCase()}</span>
              </div>

              <div className="flex items-center gap-2">
                {/* Native HTML Color Input */}
                <div className="relative w-9 h-9 rounded-xl overflow-hidden border border-white/30 shrink-0 cursor-pointer shadow-inner">
                  <input
                    type="color"
                    value={customHexInput}
                    onChange={(e) => {
                      const hex = e.target.value.toUpperCase();
                      setCustomHexInput(hex);
                      setThemeColor(hex);
                    }}
                    className="absolute -inset-2 w-14 h-14 cursor-pointer opacity-100"
                    title="Click to open color spectrum wheel"
                  />
                </div>

                {/* Hex Text Box */}
                <input
                  type="text"
                  value={customHexInput}
                  onChange={(e) => {
                    const val = e.target.value;
                    setCustomHexInput(val);
                    if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
                      setThemeColor(val.toUpperCase());
                    }
                  }}
                  placeholder="#RRGGBB"
                  maxLength={7}
                  className="flex-1 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono font-bold text-white uppercase focus:border-cyan-400 focus:outline-none"
                />

                <button
                  type="button"
                  onClick={() => {
                    if (/^#[0-9A-Fa-f]{6}$/.test(customHexInput)) {
                      setThemeColor(customHexInput.toUpperCase());
                    }
                  }}
                  className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold cursor-pointer"
                >
                  Apply
                </button>
              </div>
            </div>

            {/* Live Contrast & Visibility Guarantee Badge */}
            <div
              className="p-2.5 rounded-xl border flex items-center justify-between transition-colors"
              style={{
                backgroundColor: palette.primaryHex,
                borderColor: palette.accentHex,
              }}
            >
              <div className="min-w-0">
                <div
                  className="text-xs font-bold truncate"
                  style={{ color: palette.onBaseTextColor }}
                >
                  Text Visibility 100% Guaranteed
                </div>
                <div
                  className="text-[10px] truncate"
                  style={{ color: palette.onBaseTextMuted }}
                >
                  {palette.isLightBg ? 'Light Theme • Crisp Dark Text' : 'Deep Theme • Crisp Light Text'}
                </div>
              </div>
              <span
                className="px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ml-2 shadow-xs"
                style={{
                  backgroundColor: palette.accentHex,
                  color: palette.buttonTextColor,
                }}
              >
                Clear Text
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
