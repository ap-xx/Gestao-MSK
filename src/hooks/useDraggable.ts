import { useState, useRef, useCallback, useEffect } from 'react';

interface Position { x: number; y: number }

const STORAGE_PREFIX = 'msk_drag_';
const DRAG_THRESHOLD = 4; // pixels before we consider it a drag (not a click)

/**
 * Makes a fixed-position element draggable from any handle element.
 *
 * • Position uses CSS `right`/`bottom` offsets (distance from screen edges).
 * • Auto-clamps to the visible viewport — can't drag off-screen.
 * • Persists position in localStorage.
 * • Distinguishes click vs drag: `wasClick()` returns true when the mouse
 *   moved fewer than DRAG_THRESHOLD pixels, so you can still use onClick
 *   for toggle behaviour on the same element.
 */
export function useDraggable(
  id: string,
  defaultPos: Position = { x: 24, y: 96 },
  /** Width & height of the element in px — used for clamping */
  elementSize: { w: number; h: number } = { w: 288, h: 48 },
) {
  const storageKey = STORAGE_PREFIX + id;

  const [pos, setPos] = useState<Position>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? JSON.parse(raw) : defaultPos;
    } catch { return defaultPos; }
  });

  const [dragging, setDragging] = useState(false);
  const hasDragged = useRef(false);
  const startMouse = useRef<Position>({ x: 0, y: 0 });
  const startPos   = useRef<Position>({ x: 0, y: 0 });

  function clamp(next: Position): Position {
    const maxX = window.innerWidth  - elementSize.w - 4;
    const maxY = window.innerHeight - elementSize.h - 4;
    return {
      x: Math.max(4, Math.min(maxX, next.x)),
      y: Math.max(4, Math.min(maxY, next.y)),
    };
  }

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    // Only left button
    if (e.button !== 0) return;
    e.preventDefault();

    hasDragged.current = false;
    startMouse.current = { x: e.clientX, y: e.clientY };
    startPos.current   = pos;

    function onMove(ev: MouseEvent) {
      const dx = ev.clientX - startMouse.current.x;
      const dy = ev.clientY - startMouse.current.y;

      if (!hasDragged.current && (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD)) {
        hasDragged.current = true;
        setDragging(true);
      }

      if (hasDragged.current) {
        // right-offset:   mouse moves RIGHT (+dx) → element moves right  → right offset DECREASES (-dx)
        // bottom-offset:  mouse moves DOWN  (+dy) → element moves down   → bottom offset DECREASES (-dy)
        setPos(clamp({
          x: startPos.current.x - dx,
          y: startPos.current.y - dy,
        }));
      }
    }

    function onUp() {
      setDragging(false);
      // Persist only after drag ends
      if (hasDragged.current) {
        setPos(prev => {
          const clamped = clamp(prev);
          localStorage.setItem(storageKey, JSON.stringify(clamped));
          return clamped;
        });
      }
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    }

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos, storageKey]);

  /** Returns true when the last mousedown → mouseup was a click (not a drag). */
  const wasClick = useCallback(() => !hasDragged.current, []);

  // Re-clamp if window is resized
  useEffect(() => {
    function onResize() {
      setPos(prev => {
        const clamped = clamp(prev);
        localStorage.setItem(storageKey, JSON.stringify(clamped));
        return clamped;
      });
    }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  const wrapperStyle: React.CSSProperties = {
    position:   'fixed',
    right:      `${pos.x}px`,
    bottom:     `${pos.y}px`,
    zIndex:     50,
    userSelect: dragging ? 'none' : undefined,
  };

  return { wrapperStyle, onMouseDown, dragging, wasClick };
}
