# ns-3 Core Attachment Point

Place the C++ ns-3 project and an executable named `run-simulation` in this directory. The launcher must read the FastAPI request JSON from standard input and write a single normalized result JSON document to standard output.

The core should implement Dijkstra, Bellman-Ford, Flooding, Distance Vector, Link State, and Adaptive routing against the same topology and timeline fields documented in `docs/architecture.md`. It should emit both per-packet records and experiment aggregates so the React workspace can animate actual route transitions and store summaries.

