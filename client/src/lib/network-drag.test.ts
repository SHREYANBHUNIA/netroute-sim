import { describe, expect, it } from "vitest";
import { NETWORK_CANVAS_HEIGHT, NETWORK_CANVAS_WIDTH, resolveNodeDrag } from "./network-drag";

describe("resolveNodeDrag", () => {
  it("returns null when no rendered node identity is available", () => {
    expect(resolveNodeDrag(undefined, { x: 100, y: 100 })).toBeNull();
    expect(resolveNodeDrag("", { x: 100, y: 100 })).toBeNull();
  });

  it("uses the DOM node identifier and bounds the drag position", () => {
    expect(resolveNodeDrag("B", { x: NETWORK_CANVAS_WIDTH / 2, y: NETWORK_CANVAS_HEIGHT / 2 })).toEqual({ id: "B", x: 50, y: 50 });
    expect(resolveNodeDrag("B", { x: -30, y: 9999 })).toEqual({ id: "B", x: 7, y: 89 });
  });
});
