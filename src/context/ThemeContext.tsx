import React, { createContext, useContext, useEffect, useState } from 'react';

export type ThemeMode = 'light' | 'dark';
export type ThemeColor = 'orange' | 'cherry' | 'emerald' | 'cyan' | 'amethyst' | 'slate';

export interface ThemeColorPalette {
  id: ThemeColor;
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

export const THEME_COLOR_PALETTES: Record<ThemeColor, ThemeColorPalette> = {
  orange: {
    id: 'orange',
    name: 'Geological Amber / Orange (Default)',
    shortName: 'Orange',
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
    shortName: 'Cherry Red',
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
    accentColorOnLight: '#059669',
    accentColorOnDark: '#6EE7B7',
    buttonTextColor: '#FFFFFF',
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
    accentColorOnLight: '#0284C7',
    accentColorOnDark: '#7DD3FC',
    buttonTextColor: '#FFFFFF',
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
    accentColorOnLight: '#7C3AED',
    accentColorOnDark: '#C4B5FD',
    buttonTextColor: '#FFFFFF',
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
    accentIconColor: '#475569',
    onBaseTextColor: '#FFFFFF',
    onBaseTextMuted: '#F1F5F9',
    cardTitleText: '#0F172A',
    cardMutedText: '#475569',
    accentColorOnLight: '#334155',
    accentColorOnDark: '#CBD5E1',
    buttonTextColor: '#FFFFFF',
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
};

interface ThemeContextValue {
  theme: ThemeMode;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
  themeColor: ThemeColor;
  setThemeColor: (color: ThemeColor) => void;
  palette: ThemeColorPalette;
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
  isCanvasActive: false,
  setIsCanvasActive: () => {},
  isReportActive: false,
  setIsReportActive: () => {},
});

const THEME_COLOR_STORAGE_KEY = 'eswa_theme_color_v2';

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme] = useState<ThemeMode>('light');
  const [themeColor, setThemeColorState] = useState<ThemeColor>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(THEME_COLOR_STORAGE_KEY);
        if (stored && stored in THEME_COLOR_PALETTES) {
          return stored as ThemeColor;
        }
      } catch {
        // Ignore storage errors
      }
    }
    return 'orange';
  });

  const [isCanvasActive, setIsCanvasActive] = useState<boolean>(false);
  const [isReportActive, setIsReportActive] = useState<boolean>(false);

  const setThemeColor = (color: ThemeColor) => {
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
      if (e.key === THEME_COLOR_STORAGE_KEY && e.newValue && e.newValue in THEME_COLOR_PALETTES) {
        setThemeColorState(e.newValue as ThemeColor);
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  useEffect(() => {
    const palette = THEME_COLOR_PALETTES[themeColor] || THEME_COLOR_PALETTES.orange;
    const root = document.documentElement;
    root.setAttribute('data-theme', 'light');
    root.setAttribute('data-theme-color', themeColor);
    root.classList.add('light');
    root.classList.remove('dark');

    // Dynamic CSS Custom Properties for immediate theme coloration and high-contrast text
    root.style.setProperty('--theme-accent', palette.primaryHex);
    root.style.setProperty('--theme-accent-highlight', palette.accentHex);
    root.style.setProperty('--theme-bg-glow', palette.bgGlowHex);
    root.style.setProperty('--theme-high-contrast-text', palette.highContrastText);
    root.style.setProperty('--theme-accent-icon', palette.accentIconColor);
    root.style.setProperty('--theme-on-base-text', palette.onBaseTextColor);
  }, [themeColor]);

  const palette = THEME_COLOR_PALETTES[themeColor] || THEME_COLOR_PALETTES.orange;

  return (
    <ThemeContext.Provider
      value={{
        theme,
        toggleTheme: () => {},
        setTheme: () => {},
        themeColor,
        setThemeColor,
        palette,
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

interface ThemeToggleButtonProps {
  compact?: boolean;
  isMainWindow?: boolean;
}

export const ThemeToggleButton: React.FC<ThemeToggleButtonProps> = () => {
  return null;
};
