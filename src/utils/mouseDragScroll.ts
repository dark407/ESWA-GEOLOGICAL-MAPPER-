/**
 * Global Mouse Drag-to-Scroll & Touch Sliding Controller
 * Allows users on PC software and laptops to smoothly slide horizontal bars,
 * side panels, toolbars, and scrollable containers by clicking and dragging with the mouse,
 * eliminating the need for ugly native slide bars while adapting seamlessly to screen size.
 */

import { useEffect, useRef } from 'react';

let isGlobalInitialized = false;

export function initGlobalMouseDragScroll(): void {
  if (typeof window === 'undefined' || isGlobalInitialized) return;
  isGlobalInitialized = true;

  let activeContainer: HTMLElement | null = null;
  let startX = 0;
  let startY = 0;
  let scrollLeftStart = 0;
  let scrollTopStart = 0;
  let isDragging = false;
  let preventNextClick = false;

  const findScrollableAncestor = (target: HTMLElement | null): HTMLElement | null => {
    let curr = target;
    while (curr && curr !== document.body && curr !== document.documentElement) {
      // Do not drag-scroll if interacting inside canvas, SVG drawing surface, range slider, or text input
      const tagName = curr.tagName.toLowerCase();
      if (
        tagName === 'svg' ||
        tagName === 'canvas' ||
        tagName === 'input' ||
        tagName === 'textarea' ||
        tagName === 'select' ||
        curr.getAttribute('role') === 'slider' ||
        curr.hasAttribute('data-no-mouse-drag')
      ) {
        return null;
      }

      if (curr.classList.contains('mouse-scrollable') || curr.hasAttribute('data-mouse-scrollable')) {
        return curr;
      }

      const style = window.getComputedStyle(curr);
      const isScrollableX =
        (style.overflowX === 'auto' || style.overflowX === 'scroll') &&
        curr.scrollWidth > curr.clientWidth + 2;
      const isScrollableY =
        (style.overflowY === 'auto' || style.overflowY === 'scroll') &&
        curr.scrollHeight > curr.clientHeight + 2;

      if (isScrollableX || isScrollableY) {
        return curr;
      }

      curr = curr.parentElement;
    }
    return null;
  };

  window.addEventListener(
    'mousedown',
    (e: MouseEvent) => {
      // Only primary mouse button (button 0)
      if (e.button !== 0) return;

      const target = e.target as HTMLElement | null;
      if (!target) return;

      // Skip input fields, sliders, resize handles
      const tagName = target.tagName.toLowerCase();
      if (
        tagName === 'input' ||
        tagName === 'textarea' ||
        tagName === 'select' ||
        target.isContentEditable ||
        target.classList.contains('cursor-ew-resize') ||
        target.classList.contains('cursor-ns-resize') ||
        target.classList.contains('cursor-crosshair')
      ) {
        return;
      }

      const container = findScrollableAncestor(target);
      if (!container) return;

      activeContainer = container;
      startX = e.clientX;
      startY = e.clientY;
      scrollLeftStart = container.scrollLeft;
      scrollTopStart = container.scrollTop;
      isDragging = false;
    },
    { passive: true }
  );

  window.addEventListener(
    'mousemove',
    (e: MouseEvent) => {
      if (!activeContainer) return;

      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      // Small threshold (4px) before initiating drag-scroll to allow normal clicks
      if (!isDragging) {
        if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
          isDragging = true;
          preventNextClick = true;
          document.body.style.userSelect = 'none';
          activeContainer.style.cursor = 'grabbing';
        }
      }

      if (isDragging) {
        if (activeContainer.scrollWidth > activeContainer.clientWidth) {
          activeContainer.scrollLeft = scrollLeftStart - dx;
        }
        if (activeContainer.scrollHeight > activeContainer.clientHeight) {
          activeContainer.scrollTop = scrollTopStart - dy;
        }
      }
    },
    { passive: false }
  );

  const finishDrag = () => {
    if (activeContainer) {
      activeContainer.style.cursor = '';
      activeContainer = null;
    }
    if (isDragging) {
      isDragging = false;
      document.body.style.userSelect = '';
      // Delay resetting preventNextClick so the subsequent click event is safely cancelled
      window.setTimeout(() => {
        preventNextClick = false;
      }, 50);
    }
  };

  window.addEventListener('mouseup', finishDrag, { passive: true });
  window.addEventListener('mouseleave', finishDrag, { passive: true });

  // Suppress accidental click trigger if the user was sliding/dragging with the mouse
  window.addEventListener(
    'click',
    (e: MouseEvent) => {
      if (preventNextClick) {
        e.preventDefault();
        e.stopPropagation();
        preventNextClick = false;
      }
    },
    { capture: true }
  );
}

/**
 * Hook to attach mouse drag sliding directly to any element
 */
export function useMouseDragScroll<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let isDown = false;
    let startX = 0;
    let startY = 0;
    let sLeft = 0;
    let sTop = 0;
    let hasMoved = false;

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      isDown = true;
      startX = e.clientX;
      startY = e.clientY;
      sLeft = el.scrollLeft;
      sTop = el.scrollTop;
      hasMoved = false;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDown) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      if (!hasMoved && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
        hasMoved = true;
        el.style.cursor = 'grabbing';
      }

      if (hasMoved) {
        el.scrollLeft = sLeft - dx;
        el.scrollTop = sTop - dy;
      }
    };

    const onMouseUp = () => {
      isDown = false;
      el.style.cursor = '';
    };

    el.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      el.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  return ref;
}
