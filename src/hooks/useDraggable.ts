import { useState, useRef, useEffect, useCallback } from 'react';

interface Position { x: number; y: number }

const STORAGE_KEY_PREFIX = 'msk_drag_';

/**
 * Makes a fixed-position element draggable by the user.
 * Position is persisted in localStorage so it survives page reloads.
 *
 * @param id          Unique key for this element (used for persistence)
 * @param defaultPos  Default position { x, y } from bottom-right corner (positive = distance from edge)
 */
export function useDraggable(
  id: string,
  defaultPos: Position = { x: 24, y: 96 },
) {
  const storageKey = STORAGE_KEY_PREFIX + id;

  const [pos, setPos] = useState<Position>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : defaultPos;
    } catch {
      return defaultPos;
    }
  });

  const [dragging, setDragging] = useState(false);
  const startMouse = useRef<Position>({ x: 0, y: 0 });
  const startPos   = useRef<Position>({ x: 0, y: 0 });

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setDragging(true);
    startMouse.current = { x: e.clientX, y: e.clientY };
    startPos.current   = { ...pos };
  }, [pos]);

  useEffect(() => {
    if (!dragging) return;

    function onMouseMove(e: MouseEvent) {
      const dx = e.clientX - startMouse.current.x;
      const dy = e.clientY - startMouse.current.y;
      // We use right/bottom offsets, so movement is inverted
      const newPos = {
        x: Math.max(8, startPos.current.x - dx),
        y: Math.max(8, startPos.current.y + dy),
      };
      setPos(newPos);
    }

    function onMouseUp() {
      setDragging(false);
      setPos(prev => {
        localStorage.setItem(storageKey, JSON.stringify(prev));
        return prev;
      });
    }

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup',   onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup',   onMouseUp);
    };
  }, [dragging, storageKey]);

  /** Apply to the drag handle (usually the header bar) */
  const dragHandleProps = {
    onMouseDown,
    style: { cursor: dragging ? 'grabbing' : 'grab' } as React.CSSProperties,
  };

  /** Apply to the outermost wrapper div */
  const wrapperStyle: React.CSSProperties = {
    position:  'fixed',
    right:     `${pos.x}px`,
    bottom:    `${pos.y}px`,
    zIndex:    50,
    userSelect: dragging ? 'none' : 'auto',
  };

  return { wrapperStyle, dragHandleProps, dragging };
}
