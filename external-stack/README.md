# External Simulation Stack

This folder is a Docker-oriented integration scaffold for the production simulation tier. It sits outside the managed NetRoute web deployment, which remains Node-based. Use it on a Docker-capable VM, local development machine, or container platform when enabling the native ns-3 execution path.

Run `docker compose up --build` from this directory after supplying an ns-3 launcher under `ns3-core/` and updating `NS3_RUNNER` in the compose file. The FastAPI service exposes `/health` immediately. Its `/v1/simulations` endpoint returns a clear integration-required response until the native launcher is attached; it is intentionally not a fabricated simulation engine.
