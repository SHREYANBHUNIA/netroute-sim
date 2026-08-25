import { NETWORK_CANVAS_HEIGHT, NETWORK_CANVAS_WIDTH, resolveNodeDrag } from "@/lib/network-drag";
import { connectionId, type NetworkLink, type NetworkNode } from "@/lib/network-sim";
import { drag, select } from "d3";
import React, { useEffect, useMemo, useRef } from "react";

type CanvasProps = {
  nodes: NetworkNode[];
  links: NetworkLink[];
  activeRoute: string[];
  packetProgress: number;
  selectedId?: string;
  onSelectNode: (id: string) => void;
  onSelectLink: (id: string) => void;
  onMoveNode: (id: string, x: number, y: number) => void;
};

function statusStroke(status: NetworkLink["status"]) {
  if (status === "failed") return "#eb654f";
  if (status === "congested") return "#f49a47";
  return "#50e4dc";
}

export default function NetworkCanvas({
  nodes,
  links,
  activeRoute,
  packetProgress,
  selectedId,
  onSelectNode,
  onSelectLink,
  onMoveNode,
}: CanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const nodeById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const activeConnections = useMemo(
    () => new Set(activeRoute.slice(1).map((node, index) => connectionId(activeRoute[index], node))),
    [activeRoute],
  );

  useEffect(() => {
    if (!svgRef.current) return;
    const root = select(svgRef.current);
    root.selectAll<SVGGElement, unknown>(".draggable-node").call(
      drag<SVGGElement, unknown>().on("drag", function onDrag(event) {
        const update = resolveNodeDrag(this.getAttribute("data-node-id"), event);
        if (update) onMoveNode(update.id, update.x, update.y);
      }),
    );
  }, [nodes, onMoveNode]);

  const packetPosition = useMemo(() => {
    if (activeRoute.length < 2) return null;
    const scaled = packetProgress * (activeRoute.length - 1);
    const segment = Math.min(Math.floor(scaled), activeRoute.length - 2);
    const localProgress = scaled - segment;
    const start = nodeById.get(activeRoute[segment]);
    const end = nodeById.get(activeRoute[segment + 1]);
    if (!start || !end) return null;
    return {
      x: ((start.x + (end.x - start.x) * localProgress) / 100) * NETWORK_CANVAS_WIDTH,
      y: ((start.y + (end.y - start.y) * localProgress) / 100) * NETWORK_CANVAS_HEIGHT,
    };
  }, [activeRoute, nodeById, packetProgress]);

  return (
    <div className="canvas-wrap relative h-[430px] overflow-hidden rounded-2xl border border-cyan-100/10 md:h-[570px]">
      <div className="pointer-events-none absolute left-4 top-4 z-10 flex items-center gap-2 rounded-full border border-cyan-100/10 bg-slate-950/55 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-cyan-100/70 backdrop-blur-md">
        <span className="status-dot h-1.5 w-1.5 rounded-full bg-cyan-300" />
        D3 topology canvas
      </div>
      <svg ref={svgRef} viewBox={`0 0 ${NETWORK_CANVAS_WIDTH} ${NETWORK_CANVAS_HEIGHT}`} className="h-full w-full select-none" role="img" aria-label="Interactive network topology canvas">
        <defs>
          <pattern id="micro-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(109,222,216,.09)" strokeWidth="1" />
          </pattern>
          <radialGradient id="canvas-glow" cx="50%" cy="48%" r="55%">
            <stop offset="0%" stopColor="rgba(50,190,183,.18)" />
            <stop offset="100%" stopColor="rgba(3,15,22,0)" />
          </radialGradient>
        </defs>
        <rect width={NETWORK_CANVAS_WIDTH} height={NETWORK_CANVAS_HEIGHT} fill="url(#micro-grid)" />
        <rect width={NETWORK_CANVAS_WIDTH} height={NETWORK_CANVAS_HEIGHT} fill="url(#canvas-glow)" />

        <g>
          {links.map((link) => {
            const source = nodeById.get(link.source);
            const target = nodeById.get(link.target);
            if (!source || !target) return null;
            const active = activeConnections.has(connectionId(link.source, link.target));
            const selected = selectedId === link.id;
            return (
              <g key={link.id} onClick={() => onSelectLink(link.id)} className="cursor-pointer">
                <line
                  x1={(source.x / 100) * NETWORK_CANVAS_WIDTH}
                  y1={(source.y / 100) * NETWORK_CANVAS_HEIGHT}
                  x2={(target.x / 100) * NETWORK_CANVAS_WIDTH}
                  y2={(target.y / 100) * NETWORK_CANVAS_HEIGHT}
                  stroke="transparent"
                  strokeWidth="24"
                />
                <line
                  className="network-link"
                  x1={(source.x / 100) * NETWORK_CANVAS_WIDTH}
                  y1={(source.y / 100) * NETWORK_CANVAS_HEIGHT}
                  x2={(target.x / 100) * NETWORK_CANVAS_WIDTH}
                  y2={(target.y / 100) * NETWORK_CANVAS_HEIGHT}
                  stroke={active ? "#f5b046" : statusStroke(link.status)}
                  strokeWidth={active || selected ? 5 : 3}
                  strokeDasharray={link.status === "failed" ? "9 10" : link.status === "congested" ? "7 5" : "0"}
                  opacity={link.status === "failed" ? 0.64 : 0.84}
                />
                <g transform={`translate(${((source.x + target.x) / 200) * NETWORK_CANVAS_WIDTH} ${((source.y + target.y) / 200) * NETWORK_CANVAS_HEIGHT})`} pointerEvents="none">
                  <rect x="-35" y="-16" width="70" height="28" rx="7" fill="rgba(4,20,26,.82)" stroke="rgba(114,228,221,.14)" />
                  <text textAnchor="middle" y="-2" fill="#cceeed" fontSize="11" fontFamily="DM Mono, monospace">{link.latency} ms</text>
                  <text textAnchor="middle" y="11" fill={statusStroke(link.status)} fontSize="9" fontFamily="DM Mono, monospace">{link.bandwidth} Mbps</text>
                </g>
              </g>
            );
          })}
        </g>

        <g>
          {nodes.map((node) => {
            const cx = (node.x / 100) * NETWORK_CANVAS_WIDTH;
            const cy = (node.y / 100) * NETWORK_CANVAS_HEIGHT;
            const selected = selectedId === node.id;
            const failed = node.status === "failed";
            return (
              <g key={node.id} data-node-id={node.id} className="draggable-node cursor-grab active:cursor-grabbing" transform={`translate(${cx} ${cy})`} onClick={() => onSelectNode(node.id)}>
                <circle className={failed ? "" : "node-halo"} r={selected ? 37 : 31} fill={selected ? "rgba(78,230,220,.16)" : "rgba(38,150,157,.09)"} stroke={selected ? "#68eee4" : "rgba(105,231,223,.22)"} strokeWidth="1.3" />
                {node.kind === "router" ? (
                  <>
                    <rect x="-15" y="-15" width="30" height="30" rx="8" fill={failed ? "#39272b" : "#0d434b"} stroke={failed ? "#ec725f" : "#69e4dc"} strokeWidth="2" />
                    <path d="M-8 0h16M0-8v16M-10-8l4 4M10-8L6-4M-10 8l4-4M10 8L6 4" stroke={failed ? "#f09986" : "#d7fffb"} strokeWidth="1.6" strokeLinecap="round" />
                  </>
                ) : (
                  <>
                    <circle r="15" fill={failed ? "#39272b" : "#123c45"} stroke={failed ? "#ec725f" : "#f4ac50"} strokeWidth="2" />
                    <circle r="5" fill={failed ? "#f09986" : "#ffe0a7"} />
                  </>
                )}
                <text textAnchor="middle" y="52" fill={failed ? "#f4a49a" : "#e4fbf8"} fontSize="13" fontWeight="600" fontFamily="Space Grotesk, sans-serif">{node.id}</text>
                <text textAnchor="middle" y="69" fill="rgba(212,241,240,.57)" fontSize="10" fontFamily="DM Mono, monospace">{node.kind.toUpperCase()}</text>
              </g>
            );
          })}
        </g>

        {packetPosition ? (
          <g transform={`translate(${packetPosition.x} ${packetPosition.y})`} pointerEvents="none" className="packet-trail">
            <circle r="17" fill="rgba(247,156,67,.18)" className="pulse-orbit" />
            <circle r="7" fill="#ffba61" stroke="#fff5d5" strokeWidth="2" />
          </g>
        ) : null}
      </svg>
      <div className="pointer-events-none absolute bottom-4 right-4 rounded-xl border border-cyan-100/10 bg-slate-950/50 px-3 py-2 font-mono text-[10px] text-cyan-50/50 backdrop-blur-md">Drag nodes to reshape topology</div>
    </div>
  );
}
