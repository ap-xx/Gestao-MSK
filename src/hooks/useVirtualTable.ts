/**
 * Virtual table hook — renders only visible rows for large datasets.
 * Uses @tanstack/react-virtual under the hood.
 *
 * Automatically activates when the item count exceeds VIRTUAL_THRESHOLD.
 * Below the threshold, regular pagination is used (no change).
 *
 * @param items      Full sorted/filtered array
 * @param rowHeight  Estimated row height in pixels (default: 57)
 */
import { useRef, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

export const VIRTUAL_THRESHOLD = 200; // activate virtual scroll above this

export function useVirtualTable<T>(
  items: T[],
  rowHeight = 57,
) {
  const parentRef = useRef<HTMLDivElement>(null);
  const isVirtual = items.length > VIRTUAL_THRESHOLD;

  const virtualizer = useVirtualizer({
    count:             isVirtual ? items.length : 0,
    getScrollElement:  () => parentRef.current,
    estimateSize:      () => rowHeight,
    overscan:          8,
  });

  const virtualItems   = isVirtual ? virtualizer.getVirtualItems() : [];
  const totalSize      = isVirtual ? virtualizer.getTotalSize() : 0;

  const visibleItems = useMemo(
    () => isVirtual
      ? virtualItems.map(vi => ({ item: items[vi.index], virtualItem: vi }))
      : items.map((item, index) => ({ item, virtualItem: null as any, index })),
    [isVirtual, items, virtualItems],
  );

  return {
    parentRef,
    isVirtual,
    visibleItems,
    totalSize,
    /** Wraps the <tbody> — only used in virtual mode */
    tbodyStyle: isVirtual ? { height: `${totalSize}px`, position: 'relative' as const } : undefined,
    /** Wraps each <tr> — only used in virtual mode */
    trStyle: (vi: ReturnType<typeof virtualizer.getVirtualItems>[0] | null) =>
      vi ? {
        position: 'absolute' as const,
        top: 0,
        left: 0,
        width: '100%',
        height: `${vi.size}px`,
        transform: `translateY(${vi.start}px)`,
      } : undefined,
  };
}
