# NetRoute Architecture and Deployment Boundary

## Delivered application

The active NetRoute application is a full-stack React, TypeScript, Express, tRPC, and database workspace. It provides the cinematic D3 topology canvas, dynamic-condition timeline, live routing algorithms, packet traces, route-change events, comparison metrics, and authenticated persistence for topologies and experiment snapshots. The interactive simulation engine runs in TypeScript in the browser so topology changes and visual feedback remain immediate.

> **Delivery boundary:** This managed application runtime is intentionally kept Node-based. A native C++/ns-3 process and a Python FastAPI service are supplied as an external integration contract rather than being embedded in the web deployment, because they require a Docker-capable runtime and native tooling.

## Target production topology

| Service | Technology | Responsibility | Persistence boundary |
|---|---|---|---|
| Workspace UI | React, TypeScript, D3 | Topology creation, timeline authoring, packet animation, experiment comparison, and result exploration | Calls the web application API and simulator API |
| Workspace API | Express, tRPC | Authentication, saved topology records, saved experiment records, and access control | Stores metadata in the application database |
| Simulator API | Python, FastAPI | Validates simulation requests, launches or dispatches ns-3 work, and normalizes results to the UI contract | Stateless; accepts request-scoped jobs |
| Simulation core | C++, ns-3 | Packet-level event simulation, algorithm execution, link-state changes, and metrics capture | Emits structured result artifacts |
| Simulation store | PostgreSQL | Durable topology and experiment metadata | Owns user-scoped records and result indexes |

The React workspace should send an immutable topology snapshot, chosen routing strategy, packet profile, and timeline events to the FastAPI service. The simulator service returns packet-level and aggregate results. The web application stores a compact result summary and any external artifact URI instead of writing large raw trace files into relational text columns.

## Simulator API contract

The first production integration endpoint should be `POST /v1/simulations`. The request must include `topology`, `timeline`, `algorithm`, `source`, `destination`, `packetProfile`, and `durationSeconds`. The response should include `runId`, packet rows, route-change events, aggregate metrics, and a terminal status. A production service may run this work synchronously only for small experiments; longer ns-3 jobs should use a queue or durable job record.

| Payload group | Required fields |
|---|---|
| Topology | Nodes, links, bandwidth, latency, packet loss, and current link state |
| Timeline | Scheduled time, event type, target identifier, and event magnitude |
| Routing | Dijkstra, Bellman-Ford, Flooding, Distance Vector, Link State, or Adaptive |
| Packet results | Source, destination, route, latency, hops, delivery time, loss, and retransmissions |
| Aggregate metrics | Average latency, packet loss, delivery rate, throughput, and route-change count |

## External container scaffold

The `external-stack/` directory contains a deliberately separate FastAPI wrapper and Docker Compose starter. It is **not** used by the active managed web deployment. It establishes the service boundary and health checks, while the real ns-3 launcher must be attached at `external-stack/ns3-core/` in a Docker-capable environment.

The recommended next implementation step is to build or mount the ns-3 project into the `ns3-api` container and set `NS3_RUNNER` to a command that accepts a serialized simulation request and returns the normalized result JSON. The FastAPI wrapper already defines the intended request and response shapes. The browser engine remains valuable for rapid topology editing, while ns-3 becomes the higher-fidelity backend execution mode.
