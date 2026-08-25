import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

vi.mock("./db", () => ({
  listSavedExperiments: vi.fn(),
  listSavedTopologies: vi.fn(),
  saveExperiment: vi.fn(),
  saveTopology: vi.fn(),
}));

import * as db from "./db";
import { appRouter } from "./routers";

function createContext(): TrpcContext {
  return {
    user: {
      id: 42,
      openId: "network-lab-user",
      email: "lab@example.com",
      name: "Network Lab",
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("workspace persistence procedures", () => {
  it("stores a topology against the authenticated user", async () => {
    vi.mocked(db.saveTopology).mockResolvedValue({ id: 7, success: true });
    const caller = appRouter.createCaller(createContext());

    const result = await caller.workspace.saveTopology({
      name: "Crosswind",
      nodes: [{ id: "A" }],
      links: [{ id: "A-B" }],
      events: [{ id: "event-1" }],
    });

    expect(result).toEqual({ id: 7, success: true });
    expect(db.saveTopology).toHaveBeenCalledWith(expect.objectContaining({ userId: 42, name: "Crosswind" }));
  });

  it("stores experiment results and retrieves both saved histories", async () => {
    vi.mocked(db.saveExperiment).mockResolvedValue({ id: 11, success: true });
    vi.mocked(db.listSavedTopologies).mockResolvedValue([{ id: 7, name: "Crosswind" }] as never);
    vi.mocked(db.listSavedExperiments).mockResolvedValue([{ id: 11, name: "Crosswind run", algorithm: "adaptive" }] as never);
    const caller = appRouter.createCaller(createContext());

    const saved = await caller.workspace.saveExperiment({
      name: "Crosswind run",
      algorithm: "adaptive",
      results: { avgLatency: 29, packetLoss: 1.8 },
      topologyId: 7,
    });
    const history = await caller.workspace.listTopologies();
    const experiments = await caller.workspace.listExperiments();

    expect(saved).toEqual({ id: 11, success: true });
    expect(db.saveExperiment).toHaveBeenCalledWith(expect.objectContaining({ userId: 42, topologyId: 7, algorithm: "adaptive" }));
    expect(history).toEqual([{ id: 7, name: "Crosswind" }]);
    expect(experiments).toEqual([{ id: 11, name: "Crosswind run", algorithm: "adaptive" }]);
  });
});
