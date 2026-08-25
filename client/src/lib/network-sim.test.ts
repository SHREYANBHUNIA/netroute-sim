import { describe, expect, it } from "vitest";
import {
  applyScheduledEvents,
  comparisonBarPercent,
  defaultEvents,
  defaultLinks,
  defaultNodes,
  filterEventLog,
  routeForAlgorithm,
  simulatePacket,
} from "./network-sim";

describe("network simulation routing", () => {
  it("finds a direct healthy shortest route before scheduled disruption", () => {
    const route = routeForAlgorithm(defaultNodes, defaultLinks, "A", "D", "dijkstra");
    expect(route).toEqual(["A", "B", "D"]);
  });

  it("removes a failed scheduled link and reroutes adaptive traffic", () => {
    const disrupted = applyScheduledEvents(defaultNodes, defaultLinks, defaultEvents, 20);
    const route = routeForAlgorithm(disrupted.nodes, disrupted.links, "A", "D", "adaptive");
    expect(disrupted.links.find((link) => link.id === "B-D")?.status).toBe("failed");
    expect(route).not.toContain("B-D");
    expect(route).toEqual(["A", "C", "D"]);
  });

  it("applies configured congestion magnitude to link behavior and packet latency", () => {
    const low = applyScheduledEvents(defaultNodes, defaultLinks, [{ id: "low", time: 0, type: "congestion", targetId: "B-C", label: "low", value: 1.2 }], 1);
    const high = applyScheduledEvents(defaultNodes, defaultLinks, [{ id: "high", time: 0, type: "congestion", targetId: "B-C", label: "high", value: 3 }], 1);
    expect(low.links.find((link) => link.id === "B-C")?.congestionFactor).toBe(1.2);
    expect(high.links.find((link) => link.id === "B-C")?.congestionFactor).toBe(3);
    const lowPacket = simulatePacket(low.nodes, low.links, "A", "D", "flooding", 4);
    const highPacket = simulatePacket(high.nodes, high.links, "A", "D", "flooding", 4);
    expect(highPacket.latency).toBeGreaterThanOrEqual(lowPacket.latency);
  });
});

describe("simulation display state", () => {
  const logs = [
    { text: "Adaptive selected A → C → D." },
    { text: "B–D link failure applied to topology." },
    { text: "Simulation controller ready." },
  ];

  it("filters route-change and disruption log entries case-insensitively", () => {
    expect(filterEventLog(logs, "adaptive")).toEqual([logs[0]]);
    expect(filterEventLog(logs, "failure")).toEqual([logs[1]]);
    expect(filterEventLog(logs, "")).toEqual(logs);
  });

  it("keeps comparison bars within a readable range", () => {
    expect(comparisonBarPercent(25, 100)).toBe(25);
    expect(comparisonBarPercent(0, 100)).toBe(8);
    expect(comparisonBarPercent(100, 0)).toBe(8);
    expect(comparisonBarPercent(180, 100)).toBe(100);
  });
});
