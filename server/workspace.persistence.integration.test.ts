import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { savedExperiments, savedTopologies } from "../drizzle/schema";
import { getDb, listSavedExperiments, listSavedTopologies, saveExperiment, saveTopology } from "./db";

const integrationUserId = 9_991_337;

describe("workspace persistence helpers against the project database", () => {
  it("creates and retrieves isolated topology and experiment records", async () => {
    const db = await getDb();
    if (!db) throw new Error("Project database is unavailable for persistence integration testing.");

    const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const topologyName = `__netroute_test_topology_${suffix}`;
    const experimentName = `__netroute_test_experiment_${suffix}`;
    let topologyId: number | undefined;
    let experimentId: number | undefined;

    try {
      const topology = await saveTopology({
        userId: integrationUserId,
        name: topologyName,
        nodes: [{ id: "A" }, { id: "D" }],
        links: [{ id: "A-D", latency: 12 }],
        events: [{ id: "event-1", time: 20, type: "linkFailure" }],
      });
      topologyId = topology.id;

      const experiment = await saveExperiment({
        userId: integrationUserId,
        topologyId,
        name: experimentName,
        algorithm: "adaptive",
        results: { avgLatency: 29, packetLoss: 1.8, deliveryRate: 98 },
      });
      experimentId = experiment.id;

      const topologies = await listSavedTopologies(integrationUserId);
      const experiments = await listSavedExperiments(integrationUserId);

      expect(topologies.some((record) => record.id === topologyId && record.name === topologyName)).toBe(true);
      expect(experiments.some((record) => record.id === experimentId && record.name === experimentName && record.algorithm === "adaptive")).toBe(true);
    } finally {
      if (experimentId) await db.delete(savedExperiments).where(eq(savedExperiments.id, experimentId));
      if (topologyId) await db.delete(savedTopologies).where(eq(savedTopologies.id, topologyId));
    }
  });
});
