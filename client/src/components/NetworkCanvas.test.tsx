/** @vitest-environment jsdom */

import { render } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { defaultLinks, defaultNodes } from "@/lib/network-sim";

const d3State = vi.hoisted(() => {
  let dragHandler: ((this: SVGGElement, event: { x: number; y: number }, datum: unknown) => void) | undefined;
  const behavior = {
    on: vi.fn((_type: string, callback: typeof dragHandler) => {
      dragHandler = callback;
      return behavior;
    }),
  };
  return {
    behavior,
    getHandler: () => dragHandler,
  };
});

vi.mock("d3", () => ({
  drag: vi.fn(() => d3State.behavior),
  select: vi.fn(() => ({
    selectAll: vi.fn(() => ({ call: vi.fn() })),
  })),
}));

import NetworkCanvas from "./NetworkCanvas";

describe("NetworkCanvas drag binding", () => {
  it("moves a rendered node by its DOM identifier even when D3 supplies no datum", () => {
    const onMoveNode = vi.fn();
    render(
      <NetworkCanvas
        nodes={defaultNodes}
        links={defaultLinks}
        activeRoute={[]}
        packetProgress={0}
        onSelectNode={vi.fn()}
        onSelectLink={vi.fn()}
        onMoveNode={onMoveNode}
      />,
    );

    const handler = d3State.getHandler();
    expect(handler).toBeDefined();
    const nodeElement = document.createElementNS("http://www.w3.org/2000/svg", "g");
    nodeElement.setAttribute("data-node-id", "B");
    handler?.call(nodeElement, { x: 500, y: 305 }, undefined);

    expect(onMoveNode).toHaveBeenCalledWith("B", 50, 50);
  });
});
