"""FastAPI boundary for a native ns-3 simulation launcher.

The endpoint contract is ready for a runner that receives JSON on stdin and writes
normalized simulation results to stdout. It intentionally refuses execution until
that runner is provided rather than returning synthetic simulator data.
"""

from __future__ import annotations

import os
from typing import Any, Literal

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

app = FastAPI(title="NetRoute Simulator API", version="0.1.0")


class TimelineEvent(BaseModel):
    time: float = Field(ge=0)
    type: Literal["linkFailure", "nodeFailure", "congestion", "latencyIncrease", "packetLoss", "bandwidthReduction"]
    targetId: str
    value: float | None = None


class SimulationRequest(BaseModel):
    topology: dict[str, Any]
    timeline: list[TimelineEvent]
    algorithm: Literal["dijkstra", "bellmanFord", "flooding", "distanceVector", "linkState", "adaptive"]
    source: str
    destination: str
    durationSeconds: float = Field(gt=0, le=3600)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "runner": "configured" if os.path.exists(os.getenv("NS3_RUNNER", "")) else "missing"}


@app.post("/v1/simulations")
def run_simulation(request: SimulationRequest) -> dict[str, Any]:
    runner = os.getenv("NS3_RUNNER", "")
    if not runner or not os.path.exists(runner):
        raise HTTPException(
            status_code=501,
            detail="Native ns-3 runner is not attached. Build the C++ launcher at NS3_RUNNER before enabling this endpoint.",
        )

    # Replace this explicit boundary with a subprocess invocation once the runner is added.
    # The runner must accept `request.model_dump_json()` on stdin and emit one result JSON document.
    raise HTTPException(status_code=501, detail="The ns-3 runner interface is declared but execution wiring is pending.")
