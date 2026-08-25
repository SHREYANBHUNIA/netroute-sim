/** @vitest-environment jsdom */

import { render } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { defaultLinks, defaultNodes } from "@/lib/network-sim";
import NetworkCanvas from "./NetworkCanvas";

describe("NetworkCanvas runtime mouse drag", () => {
  it("moves a rendered node through the real D3 drag binding without an exception", () => {
    const onMoveNode = vi.fn();
    const { container } = render(
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
    const node = container.querySelector('[data-node-id="B"]');
    expect(node).toBeTruthy();
    const view = node?.ownerDocument.defaultView;
    if (!view) throw new Error("Expected the rendered SVG node to have a document window.");

    const createMouseEvent = (type: string, clientX: number, clientY: number, button = 0) => {
      const event = new view.MouseEvent(type, {
      bubbles: true,
      button,
      buttons: button === 0 ? 1 : 0,
      clientX,
      clientY,
    });
      Object.defineProperty(event, "view", { value: view });
      return event;
    };
    node!.dispatchEvent(createMouseEvent("mousedown", 400, 180));
    view.dispatchEvent(createMouseEvent("mousemove", 500, 305));
    view.dispatchEvent(createMouseEvent("mouseup", 500, 305));

    expect(onMoveNode).toHaveBeenCalled();
    expect(onMoveNode.mock.calls[0]?.[0]).toBe("B");
  });
});
