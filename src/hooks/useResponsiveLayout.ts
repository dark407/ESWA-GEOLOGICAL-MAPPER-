import { RefObject, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

const LAYOUT_RECALC_EVENT = 'eswa:layout-recalc';

export interface ResponsiveLayoutMetrics {
  viewportWidth: number;
  viewportHeight: number;
  aspectRatio: number;
  devicePixelRatio: number;
  isMobile: boolean;
  isTablet: boolean;
  isTouchDevice: boolean;
  isLandscape: boolean;
  isShortLandscape: boolean;
  isCompactHeight: boolean;
  isCompactWidth: boolean;
  isCompactScreen: boolean;
  isLargeScreen: boolean;
  isUltraWide: boolean;
  toolbarCompact: boolean;
  sidePanelWidthPx: number;
  inspectorWidthPx: number;
  floatingPanelWidthPx: number;
  bottomDrawerHeightPx: number;
  uiScaleFactor: number;
  layoutRevision: number;
  recalculateLayout: () => void;
}

export interface ContainerResizeMetrics {
  width: number;
  height: number;
  aspectRatio: number;
  dpr: number;
  revision: number;
  recalculate: () => void;
}

type CoreViewportMetrics = Omit<ResponsiveLayoutMetrics, 'layoutRevision' | 'recalculateLayout'>;

function computeResponsiveMetrics(width: number, height: number, dpr: number): CoreViewportMetrics {
  const safeW = Math.max(320, Math.round(width));
  const safeH = Math.max(240, Math.round(height));
  const aspectRatio = Number((safeW / safeH).toFixed(3));

  const isLandscape = safeW > safeH;
  const isShortLandscape = isLandscape && safeH < 640;
  const isMobile = safeW < 768 || (isLandscape && safeH < 520);
  const isTablet = !isMobile && safeW >= 768 && safeW < 1024;
  const isTouchDevice =
    isMobile ||
    isTablet ||
    (typeof window !== 'undefined' &&
      ('ontouchstart' in window || (navigator?.maxTouchPoints ?? 0) > 0));
  const isCompactHeight = safeH < 780;
  const isCompactWidth = safeW < 1366;
  const isCompactScreen = isCompactWidth || isCompactHeight;
  const isLargeScreen = safeW >= 1920 && safeH >= 960;
  const isUltraWide = aspectRatio >= 2.0;
  const toolbarCompact = safeW < 1480 || safeH < 800 || isShortLandscape;

  // Automatically scale side panels, inspectors, floating panels, and bottom drawers for horizontal mobile screens
  const sidePanelWidthPx = Math.round(
    isShortLandscape
      ? Math.max(190, Math.min(260, safeW * 0.24))
      : Math.max(220, Math.min(360, safeW * (isCompactWidth ? 0.225 : 0.21)))
  );
  const inspectorWidthPx = Math.round(
    isShortLandscape
      ? Math.max(185, Math.min(250, safeW * 0.23))
      : Math.max(210, Math.min(330, safeW * (isCompactWidth ? 0.205 : 0.19)))
  );
  const floatingPanelWidthPx = Math.round(
    isShortLandscape
      ? Math.max(200, Math.min(280, safeW * 0.25))
      : Math.max(240, Math.min(368, safeW * 0.235))
  );
  const bottomDrawerHeightPx = Math.round(
    Math.max(150, Math.min(350, safeH * (isShortLandscape ? 0.42 : isCompactHeight ? 0.3 : 0.34)))
  );

  const uiScaleFactor = isLargeScreen
    ? 1.04
    : isShortLandscape
    ? Math.max(0.8, Math.min(0.92, Math.min(safeW / 1100, safeH / 540)))
    : isCompactScreen
    ? Math.max(0.86, Math.min(0.96, Math.min(safeW / 1440, safeH / 820)))
    : 1.0;

  return {
    viewportWidth: safeW,
    viewportHeight: safeH,
    aspectRatio,
    devicePixelRatio: Number(dpr.toFixed(2)),
    isMobile,
    isTablet,
    isTouchDevice,
    isLandscape,
    isShortLandscape,
    isCompactHeight,
    isCompactWidth,
    isCompactScreen,
    isLargeScreen,
    isUltraWide,
    toolbarCompact,
    sidePanelWidthPx,
    inspectorWidthPx,
    floatingPanelWidthPx,
    bottomDrawerHeightPx,
    uiScaleFactor: Number(uiScaleFactor.toFixed(3)),
  };
}

function syncDocumentCssVariables(m: CoreViewportMetrics): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.style.setProperty('--eswa-vw', `${m.viewportWidth}px`);
  root.style.setProperty('--eswa-vh', `${m.viewportHeight}px`);
  root.style.setProperty('--eswa-dpr', String(m.devicePixelRatio));
  root.style.setProperty('--eswa-side-panel-w', `${m.sidePanelWidthPx}px`);
  root.style.setProperty('--eswa-inspector-w', `${m.inspectorWidthPx}px`);
  root.style.setProperty('--eswa-floating-panel-w', `${m.floatingPanelWidthPx}px`);
  root.style.setProperty('--eswa-drawer-h', `${m.bottomDrawerHeightPx}px`);
  root.style.setProperty('--eswa-ui-scale', String(m.uiScaleFactor));
  root.setAttribute('data-orientation', m.isLandscape ? 'landscape' : 'portrait');
  root.setAttribute('data-short-landscape', m.isShortLandscape ? 'true' : 'false');
}

function readViewportDimensions(): { width: number; height: number; dpr: number } {
  if (typeof window === 'undefined') {
    return { width: 1440, height: 900, dpr: 1 };
  }
  const vv = window.visualViewport;
  const docEl = document.documentElement;
  const width = Math.round(vv?.width || docEl?.clientWidth || window.innerWidth || 1440);
  const height = Math.round(vv?.height || docEl?.clientHeight || window.innerHeight || 900);
  const dpr = window.devicePixelRatio || 1;
  return { width, height, dpr };
}

/**
 * Broadcasts a global synchronous layout recalculation signal to all active
 * canvas and engineering sheet ResizeObserver instances.
 */
export function triggerGlobalLayoutRecalculation(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(LAYOUT_RECALC_EVENT));
}

/**
 * Global responsive layout hook powered by a synchronous ResizeObserver + visualViewport +
 * multi-monitor DPI change observer. Eliminates rendering delays and visual clipping when
 * resizing windows across different monitor resolutions and scaling factors.
 */
export function useResponsiveLayout(): ResponsiveLayoutMetrics {
  const [state, setState] = useState<{
    core: CoreViewportMetrics;
    layoutRevision: number;
  }>(() => {
    const { width, height, dpr } = readViewportDimensions();
    const initial = computeResponsiveMetrics(width, height, dpr);
    syncDocumentCssVariables(initial);
    return { core: initial, layoutRevision: 0 };
  });

  const rafIdRef = useRef<number | null>(null);

  const measureAndSync = useCallback((forceIncrement = false) => {
    const { width, height, dpr } = readViewportDimensions();
    const next = computeResponsiveMetrics(width, height, dpr);
    syncDocumentCssVariables(next);

    setState((prev) => {
      const changed =
        Math.abs(prev.core.viewportWidth - next.viewportWidth) >= 1 ||
        Math.abs(prev.core.viewportHeight - next.viewportHeight) >= 1 ||
        Math.abs(prev.core.devicePixelRatio - next.devicePixelRatio) >= 0.01;

      if (!changed && !forceIncrement) {
        return prev;
      }
      return {
        core: next,
        layoutRevision: prev.layoutRevision + 1,
      };
    });
  }, []);

  const recalculateLayout = useCallback(() => {
    measureAndSync(true);
    triggerGlobalLayoutRecalculation();
  }, [measureAndSync]);

  useIsomorphicLayoutEffect(() => {
    if (typeof window === 'undefined') return;

    const handleImmediateAndTrailingMeasure = (force = false) => {
      // Immediate synchronous pass prevents visual clipping on fast resize
      measureAndSync(force);
      // Trailing animation-frame pass captures settled flexbox/grid geometry
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
      rafIdRef.current = requestAnimationFrame(() => {
        rafIdRef.current = null;
        measureAndSync(false);
      });
    };

    handleImmediateAndTrailingMeasure(false);

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const box = entry.contentBoxSize?.[0];
        const w = box ? Math.round(box.inlineSize) : Math.round(entry.contentRect.width);
        const h = box ? Math.round(box.blockSize) : Math.round(entry.contentRect.height);
        if (w > 0 && h > 0) {
          const dpr = window.devicePixelRatio || 1;
          const next = computeResponsiveMetrics(w, h, dpr);
          syncDocumentCssVariables(next);
          setState((prev) => {
            const changed =
              Math.abs(prev.core.viewportWidth - next.viewportWidth) >= 1 ||
              Math.abs(prev.core.viewportHeight - next.viewportHeight) >= 1 ||
              Math.abs(prev.core.devicePixelRatio - next.devicePixelRatio) >= 0.01;
            if (!changed) return prev;
            return {
              core: next,
              layoutRevision: prev.layoutRevision + 1,
            };
          });
          break;
        }
      }
    });

    ro.observe(document.documentElement);
    if (document.body) {
      ro.observe(document.body);
    }

    const onWindowResize = () => handleImmediateAndTrailingMeasure(false);
    const onForceRecalc = () => handleImmediateAndTrailingMeasure(true);

    window.addEventListener('resize', onWindowResize, { passive: true });
    window.addEventListener('orientationchange', onWindowResize, { passive: true });
    window.visualViewport?.addEventListener('resize', onWindowResize);
    window.visualViewport?.addEventListener('scroll', onWindowResize);
    window.addEventListener(LAYOUT_RECALC_EVENT, onForceRecalc);

    // Re-registering DPI / display scaling listener when moving window across monitors
    let dprMediaQuery: MediaQueryList | null = null;
    const bindDprListener = () => {
      if (dprMediaQuery) {
        dprMediaQuery.removeEventListener?.('change', onDprChange);
      }
      dprMediaQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
      dprMediaQuery.addEventListener?.('change', onDprChange);
    };
    const onDprChange = () => {
      handleImmediateAndTrailingMeasure(true);
      bindDprListener();
    };
    bindDprListener();

    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
      ro.disconnect();
      window.removeEventListener('resize', onWindowResize);
      window.removeEventListener('orientationchange', onWindowResize);
      window.visualViewport?.removeEventListener('resize', onWindowResize);
      window.visualViewport?.removeEventListener('scroll', onWindowResize);
      window.removeEventListener(LAYOUT_RECALC_EVENT, onForceRecalc);
      dprMediaQuery?.removeEventListener?.('change', onDprChange);
    };
  }, [measureAndSync]);

  return {
    ...state.core,
    layoutRevision: state.layoutRevision,
    recalculateLayout,
  };
}

/**
 * High-stability container ResizeObserver hook specifically engineered for the SVG Mapping Canvas
 * and Final Engineering Sheet preview containers. Reads exact ResizeObserverEntry box metrics
 * synchronously before paint to eliminate lag, jitter, or visual clipping on window resize.
 */
export function useContainerResizeObserver(
  containerRef: RefObject<HTMLElement | null>,
  fallbackWidth = 1080,
  fallbackHeight = 680,
  enabled = true
): ContainerResizeMetrics {
  const [size, setSize] = useState<{
    width: number;
    height: number;
    aspectRatio: number;
    dpr: number;
    revision: number;
  }>(() => ({
    width: fallbackWidth,
    height: fallbackHeight,
    aspectRatio: Number((fallbackWidth / Math.max(1, fallbackHeight)).toFixed(3)),
    dpr: typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1,
    revision: 0,
  }));

  const rafIdRef = useRef<number | null>(null);

  const commitDimensions = useCallback(
    (rawWidth: number, rawHeight: number, forceRevision = false) => {
      const w = Math.floor(rawWidth);
      const h = Math.floor(rawHeight);
      if (w <= 24 || h <= 24) return;
      const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;

      setSize((prev) => {
        const widthChanged = Math.abs(prev.width - w) >= 1;
        const heightChanged = Math.abs(prev.height - h) >= 1;
        const dprChanged = Math.abs(prev.dpr - dpr) >= 0.01;

        if (!widthChanged && !heightChanged && !dprChanged && !forceRevision) {
          return prev;
        }
        return {
          width: w,
          height: h,
          aspectRatio: Number((w / h).toFixed(4)),
          dpr,
          revision: prev.revision + 1,
        };
      });
    },
    []
  );

  const recalculate = useCallback(() => {
    const target = containerRef.current;
    if (!target) return;
    const rect = target.getBoundingClientRect();
    commitDimensions(rect.width || target.clientWidth, rect.height || target.clientHeight, true);
  }, [containerRef, commitDimensions]);

  useIsomorphicLayoutEffect(() => {
    if (!enabled || typeof window === 'undefined') return;
    const el = containerRef.current;
    if (!el) return;

    const measureElementNow = (force = false) => {
      const target = containerRef.current;
      if (!target) return;
      const rect = target.getBoundingClientRect();
      const w = rect.width || target.clientWidth;
      const h = rect.height || target.clientHeight;
      commitDimensions(w, h, force);
    };

    // 1. Synchronous pre-paint measurement so initial render is never clipped
    measureElementNow(false);

    // 2. Direct ResizeObserver reading exact contentBoxSize / contentRect without 1-frame delay
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const box = entry.contentBoxSize?.[0];
      const entryW = box ? box.inlineSize : entry.contentRect.width;
      const entryH = box ? box.blockSize : entry.contentRect.height;

      if (entryW > 24 && entryH > 24) {
        commitDimensions(entryW, entryH, false);
      } else {
        measureElementNow(false);
      }

      // Trailing frame verification after child SVG / flex layout settles
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
      rafIdRef.current = requestAnimationFrame(() => {
        rafIdRef.current = null;
        measureElementNow(false);
      });
    });

    ro.observe(el);
    if (el.parentElement) {
      ro.observe(el.parentElement);
    }

    const onWindowResize = () => {
      measureElementNow(false);
      if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = requestAnimationFrame(() => {
        rafIdRef.current = null;
        measureElementNow(false);
      });
    };

    const onGlobalRecalc = () => measureElementNow(true);

    window.addEventListener('resize', onWindowResize, { passive: true });
    window.visualViewport?.addEventListener('resize', onWindowResize);
    window.addEventListener(LAYOUT_RECALC_EVENT, onGlobalRecalc);

    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
      ro.disconnect();
      window.removeEventListener('resize', onWindowResize);
      window.visualViewport?.removeEventListener('resize', onWindowResize);
      window.removeEventListener(LAYOUT_RECALC_EVENT, onGlobalRecalc);
    };
  }, [containerRef, enabled, commitDimensions]);

  return {
    width: size.width,
    height: size.height,
    aspectRatio: size.aspectRatio,
    dpr: size.dpr,
    revision: size.revision,
    recalculate,
  };
}
