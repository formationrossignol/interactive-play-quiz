import { describe, it, expect } from "vitest";
import {
  rectsIntersect, boundingBoxOf, snapDelta,
  alignLeft, alignCenterH, alignRight, alignTop, alignMiddleV, alignBottom,
  distributeHorizontal, distributeVertical,
} from "../geometry";
import type { BaseElement } from "../../types/presentation";

const el = (id: string, x: number, y: number, width = 100, height = 50): BaseElement => ({
  id, x, y, width, height, rotation: 0, zIndex: 0, opacity: 1, locked: false, visible: true,
});

describe("rectsIntersect", () => {
  it("true for overlapping rects", () => {
    expect(rectsIntersect({ x: 0, y: 0, width: 50, height: 50 }, { x: 25, y: 25, width: 50, height: 50 })).toBe(true);
  });
  it("false for disjoint rects", () => {
    expect(rectsIntersect({ x: 0, y: 0, width: 10, height: 10 }, { x: 100, y: 100, width: 10, height: 10 })).toBe(false);
  });
});

describe("boundingBoxOf", () => {
  it("computes the union rect of multiple elements", () => {
    const box = boundingBoxOf([el("a", 0, 0), el("b", 200, 100, 40, 40)]);
    expect(box).toEqual({ x: 0, y: 0, width: 240, height: 140 });
  });
});

describe("snapDelta", () => {
  it("snaps to another element's edge within threshold", () => {
    // dragged element at x=98 moving toward a static element whose left edge is at x=100
    const dragged = el("dragged", 98, 0);
    const staticEl = el("target", 100, 200);
    const { dx } = snapDelta(dragged, 0, 0, [staticEl], 8);
    expect(dragged.x + dx).toBe(100);
  });
  it("does not snap when outside threshold", () => {
    const dragged = el("dragged", 50, 0);
    const staticEl = el("target", 100, 200);
    const { dx } = snapDelta(dragged, 0, 0, [staticEl], 8);
    expect(dx).toBe(0);
  });
});

describe("alignment", () => {
  const a = el("a", 10, 10, 100, 50);
  const b = el("b", 200, 80, 40, 20);

  it("alignLeft moves both to the min x", () => {
    const out = alignLeft([a, b]);
    expect(out.find((e) => e.id === "a")!.x).toBe(10);
    expect(out.find((e) => e.id === "b")!.x).toBe(10);
  });
  it("alignRight moves both so their right edges match the max right edge", () => {
    const out = alignRight([a, b]);
    const maxRight = Math.max(a.x + a.width, b.x + b.width);
    expect(out.find((e) => e.id === "a")!.x + a.width).toBe(maxRight);
    expect(out.find((e) => e.id === "b")!.x + b.width).toBe(maxRight);
  });
  it("alignCenterH centers both on the same vertical axis", () => {
    const out = alignCenterH([a, b]);
    const ca = out.find((e) => e.id === "a")!;
    const cb = out.find((e) => e.id === "b")!;
    expect(ca.x + ca.width / 2).toBeCloseTo(cb.x + cb.width / 2, 5);
  });
  it("alignTop/alignBottom/alignMiddleV mirror the horizontal ones on the Y axis", () => {
    const top = alignTop([a, b]);
    expect(top.find((e) => e.id === "a")!.y).toBe(10);
    expect(top.find((e) => e.id === "b")!.y).toBe(10);

    const bottom = alignBottom([a, b]);
    const maxBottom = Math.max(a.y + a.height, b.y + b.height);
    expect(bottom.find((e) => e.id === "a")!.y + a.height).toBe(maxBottom);

    const middle = alignMiddleV([a, b]);
    const ma = middle.find((e) => e.id === "a")!;
    const mb = middle.find((e) => e.id === "b")!;
    expect(ma.y + ma.height / 2).toBeCloseTo(mb.y + mb.height / 2, 5);
  });
});

describe("distribute", () => {
  it("distributeHorizontal spaces three elements evenly between the outer two", () => {
    const els = [el("a", 0, 0, 20, 20), el("b", 40, 0, 20, 20), el("c", 300, 0, 20, 20)];
    const out = distributeHorizontal(els);
    const sorted = out.slice().sort((x, y) => x.x - y.x);
    const gap1 = sorted[1].x - (sorted[0].x + sorted[0].width);
    const gap2 = sorted[2].x - (sorted[1].x + sorted[1].width);
    expect(gap1).toBeCloseTo(gap2, 5);
  });
  it("distributeVertical spaces three elements evenly between the outer two", () => {
    const els = [el("a", 0, 0, 20, 20), el("b", 0, 40, 20, 20), el("c", 0, 300, 20, 20)];
    const out = distributeVertical(els);
    const sorted = out.slice().sort((x, y) => x.y - y.y);
    const gap1 = sorted[1].y - (sorted[0].y + sorted[0].height);
    const gap2 = sorted[2].y - (sorted[1].y + sorted[1].height);
    expect(gap1).toBeCloseTo(gap2, 5);
  });
});
