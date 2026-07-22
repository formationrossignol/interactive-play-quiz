import type { BaseElement, Rect } from "../types/presentation";

export function rectsIntersect(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

export function boundingBoxOf(elements: BaseElement[]): Rect {
  const minX = Math.min(...elements.map((e) => e.x));
  const minY = Math.min(...elements.map((e) => e.y));
  const maxX = Math.max(...elements.map((e) => e.x + e.width));
  const maxY = Math.max(...elements.map((e) => e.y + e.height));
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/**
 * Given a dragged element's committed geometry plus a proposed (dx, dy),
 * returns an adjusted (dx, dy) snapped to the nearest matching edge/center
 * of `others` when within `threshold` px. Checks left/center/right edges on
 * X and top/middle/bottom edges on Y independently.
 */
export function snapDelta(
  dragged: BaseElement,
  dx: number,
  dy: number,
  others: BaseElement[],
  threshold: number,
): { dx: number; dy: number } {
  const left = dragged.x + dx;
  const right = left + dragged.width;
  const centerX = left + dragged.width / 2;
  const top = dragged.y + dy;
  const bottom = top + dragged.height;
  const centerY = top + dragged.height / 2;

  let bestDx = dx;
  let bestDxDist = threshold;
  let bestDy = dy;
  let bestDyDist = threshold;

  for (const o of others) {
    const oLeft = o.x, oRight = o.x + o.width, oCenterX = o.x + o.width / 2;
    const oTop = o.y, oBottom = o.y + o.height, oCenterY = o.y + o.height / 2;

    for (const [edge, target] of [[left, oLeft], [right, oRight], [centerX, oCenterX]] as const) {
      const dist = Math.abs(edge - target);
      if (dist < bestDxDist) { bestDxDist = dist; bestDx = dx + (target - edge); }
    }
    for (const [edge, target] of [[top, oTop], [bottom, oBottom], [centerY, oCenterY]] as const) {
      const dist = Math.abs(edge - target);
      if (dist < bestDyDist) { bestDyDist = dist; bestDy = dy + (target - edge); }
    }
  }

  return { dx: bestDx, dy: bestDy };
}

function mapById<T extends BaseElement>(elements: T[], fn: (e: T) => Partial<T>): T[] {
  return elements.map((e) => ({ ...e, ...fn(e) }));
}

export function alignLeft<T extends BaseElement>(elements: T[]): T[] {
  const min = Math.min(...elements.map((e) => e.x));
  return mapById(elements, () => ({ x: min } as Partial<T>));
}
export function alignRight<T extends BaseElement>(elements: T[]): T[] {
  const maxRight = Math.max(...elements.map((e) => e.x + e.width));
  return mapById(elements, (e) => ({ x: maxRight - e.width } as Partial<T>));
}
export function alignCenterH<T extends BaseElement>(elements: T[]): T[] {
  const box = boundingBoxOf(elements);
  const centerX = box.x + box.width / 2;
  return mapById(elements, (e) => ({ x: centerX - e.width / 2 } as Partial<T>));
}
export function alignTop<T extends BaseElement>(elements: T[]): T[] {
  const min = Math.min(...elements.map((e) => e.y));
  return mapById(elements, () => ({ y: min } as Partial<T>));
}
export function alignBottom<T extends BaseElement>(elements: T[]): T[] {
  const maxBottom = Math.max(...elements.map((e) => e.y + e.height));
  return mapById(elements, (e) => ({ y: maxBottom - e.height } as Partial<T>));
}
export function alignMiddleV<T extends BaseElement>(elements: T[]): T[] {
  const box = boundingBoxOf(elements);
  const centerY = box.y + box.height / 2;
  return mapById(elements, (e) => ({ y: centerY - e.height / 2 } as Partial<T>));
}

export function distributeHorizontal<T extends BaseElement>(elements: T[]): T[] {
  if (elements.length < 3) return elements;
  const sorted = elements.slice().sort((a, b) => a.x - b.x);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const totalSpan = (last.x + last.width) - first.x;
  const totalWidth = sorted.reduce((sum, e) => sum + e.width, 0);
  const gap = (totalSpan - totalWidth) / (sorted.length - 1);

  let cursor = first.x + first.width;
  const positioned = new Map<string, number>();
  positioned.set(first.id, first.x);
  for (let i = 1; i < sorted.length - 1; i++) {
    positioned.set(sorted[i].id, cursor + gap);
    cursor = cursor + gap + sorted[i].width;
  }
  positioned.set(last.id, last.x);

  return elements.map((e) => (positioned.has(e.id) ? { ...e, x: positioned.get(e.id)! } : e));
}

export function distributeVertical<T extends BaseElement>(elements: T[]): T[] {
  if (elements.length < 3) return elements;
  const sorted = elements.slice().sort((a, b) => a.y - b.y);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const totalSpan = (last.y + last.height) - first.y;
  const totalHeight = sorted.reduce((sum, e) => sum + e.height, 0);
  const gap = (totalSpan - totalHeight) / (sorted.length - 1);

  let cursor = first.y + first.height;
  const positioned = new Map<string, number>();
  positioned.set(first.id, first.y);
  for (let i = 1; i < sorted.length - 1; i++) {
    positioned.set(sorted[i].id, cursor + gap);
    cursor = cursor + gap + sorted[i].height;
  }
  positioned.set(last.id, last.y);

  return elements.map((e) => (positioned.has(e.id) ? { ...e, y: positioned.get(e.id)! } : e));
}
