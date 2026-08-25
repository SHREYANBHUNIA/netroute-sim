export type NodeKind = "router" | "host";
export type LinkStatus = "healthy" | "congested" | "failed";
export type RoutingAlgorithm =
  | "dijkstra"
  | "bellmanFord"
  | "flooding"
  | "distanceVector"
  | "linkState"
  | "adaptive";
export type DynamicEventType =
  | "linkFailure"
  | "nodeFailure"
  | "congestion"
  | "latencyIncrease"
  | "packetLoss"
  | "bandwidthReduction";

export type NetworkNode = {
  id: string;
  label: string;
  kind: NodeKind;
  x: number;
  y: number;
  status: "online" | "failed";
};

export type NetworkLink = {
  id: string;
  source: string;
  target: string;
  bandwidth: number;
  latency: number;
  packetLoss: number;
  status: LinkStatus;
  congestionFactor?: number;
};

export type ScheduledEvent = {
  id: string;
  time: number;
  type: DynamicEventType;
  targetId: string;
  label: string;
  value?: number;
};

export type PacketResult = {
  id: string;
  source: string;
  destination: string;
  route: string[];
  latency: number;
  hops: number;
  deliveryTime: number;
  lost: boolean;
  retransmissions: number;
  algorithm: RoutingAlgorithm;
};

export type ComparisonMetric = {
  algorithm: RoutingAlgorithm;
  avgLatency: number;
  packetLoss: number;
  deliveryRate: number;
};

export const algorithmLabels: Record<RoutingAlgorithm, string> = {
  dijkstra: "Dijkstra",
  bellmanFord: "Bellman-Ford",
  flooding: "Flooding",
  distanceVector: "Distance Vector",
  linkState: "Link State",
  adaptive: "Adaptive",
};

export const algorithmDescriptions: Record<RoutingAlgorithm, string> = {
  dijkstra: "Shortest latency path",
  bellmanFord: "Relaxed distributed route",
  flooding: "Multi-path broadcast",
  distanceVector: "Neighbor cost exchange",
  linkState: "Global topology map",
  adaptive: "Live cost-aware rerouting",
};

export const defaultNodes: NetworkNode[] = [
  { id: "A", label: "Gateway A", kind: "host", x: 15, y: 52, status: "online" },
  { id: "B", label: "Router B", kind: "router", x: 40, y: 24, status: "online" },
  { id: "C", label: "Router C", kind: "router", x: 42, y: 77, status: "online" },
  { id: "D", label: "Edge D", kind: "host", x: 79, y: 50, status: "online" },
];

export const defaultLinks: NetworkLink[] = [
  { id: "A-B", source: "A", target: "B", bandwidth: 980, latency: 10, packetLoss: 0.2, status: "healthy" },
  { id: "A-C", source: "A", target: "C", bandwidth: 720, latency: 30, packetLoss: 0.5, status: "healthy" },
  { id: "B-C", source: "B", target: "C", bandwidth: 440, latency: 15, packetLoss: 0.7, status: "congested" },
  { id: "B-D", source: "B", target: "D", bandwidth: 920, latency: 20, packetLoss: 0.3, status: "healthy" },
  { id: "C-D", source: "C", target: "D", bandwidth: 680, latency: 18, packetLoss: 0.4, status: "healthy" },
];

export const defaultEvents: ScheduledEvent[] = [
  { id: "event-1", time: 20, type: "linkFailure", targetId: "B-D", label: "B–D link fails" },
  { id: "event-2", time: 40, type: "congestion", targetId: "B-C", label: "B–C congestion rises", value: 1.9 },
  { id: "event-3", time: 60, type: "latencyIncrease", targetId: "C-D", label: "C–D latency +12 ms", value: 12 },
  { id: "event-4", time: 76, type: "bandwidthReduction", targetId: "A-C", label: "A–C bandwidth −45%", value: 45 },
];

type RouteEdge = { to: string; cost: number; link: NetworkLink };

const algorithmPenalty: Record<RoutingAlgorithm, number> = {
  dijkstra: 1,
  bellmanFord: 1.08,
  flooding: 1.72,
  distanceVector: 1.13,
  linkState: 1.02,
  adaptive: 0.91,
};

function nodeExists(nodes: NetworkNode[], id: string) {
  return nodes.some((node) => node.id === id && node.status === "online");
}

function linkWeight(link: NetworkLink, algorithm: RoutingAlgorithm) {
  if (link.status === "failed") return Number.POSITIVE_INFINITY;
  const congestionIntensity = link.congestionFactor ?? 1.75;
  const congestionPenalty = link.status === "congested"
    ? (algorithm === "adaptive" ? congestionIntensity * 1.72 : congestionIntensity)
    : 1;
  const reliabilityPenalty = (algorithm === "adaptive" ? link.packetLoss * 2.8 : link.packetLoss * 0.55) * (link.status === "congested" ? congestionIntensity : 1);
  const bandwidthPenalty = algorithm === "adaptive" ? 100 / Math.max(link.bandwidth, 1) : 0;
  return link.latency * congestionPenalty + reliabilityPenalty + bandwidthPenalty;
}

function buildAdjacency(nodes: NetworkNode[], links: NetworkLink[], algorithm: RoutingAlgorithm) {
  const adjacency = new Map<string, RouteEdge[]>();
  nodes.filter((node) => node.status === "online").forEach((node) => adjacency.set(node.id, []));
  links.forEach((link) => {
    if (!nodeExists(nodes, link.source) || !nodeExists(nodes, link.target) || link.status === "failed") return;
    const cost = linkWeight(link, algorithm);
    adjacency.get(link.source)?.push({ to: link.target, cost, link });
    adjacency.get(link.target)?.push({ to: link.source, cost, link });
  });
  return adjacency;
}

function restorePath(previous: Map<string, string>, source: string, destination: string) {
  const route = [destination];
  let current = destination;
  while (current !== source) {
    const parent = previous.get(current);
    if (!parent) return [];
    route.push(parent);
    current = parent;
  }
  return route.reverse();
}

function dijkstraRoute(nodes: NetworkNode[], links: NetworkLink[], source: string, destination: string, algorithm: RoutingAlgorithm) {
  const adjacency = buildAdjacency(nodes, links, algorithm);
  const distances = new Map<string, number>(nodes.map((node) => [node.id, Number.POSITIVE_INFINITY]));
  const previous = new Map<string, string>();
  const queue = new Set(nodes.filter((node) => node.status === "online").map((node) => node.id));
  distances.set(source, 0);
  while (queue.size) {
    let current = "";
    let best = Number.POSITIVE_INFINITY;
    queue.forEach((id) => {
      if ((distances.get(id) ?? Number.POSITIVE_INFINITY) < best) {
        current = id;
        best = distances.get(id) ?? Number.POSITIVE_INFINITY;
      }
    });
    if (!current || best === Number.POSITIVE_INFINITY) break;
    queue.delete(current);
    if (current === destination) break;
    (adjacency.get(current) ?? []).forEach((edge) => {
      if (!queue.has(edge.to)) return;
      const candidate = best + edge.cost;
      if (candidate < (distances.get(edge.to) ?? Number.POSITIVE_INFINITY)) {
        distances.set(edge.to, candidate);
        previous.set(edge.to, current);
      }
    });
  }
  return restorePath(previous, source, destination);
}

function bellmanFordRoute(nodes: NetworkNode[], links: NetworkLink[], source: string, destination: string, algorithm: RoutingAlgorithm) {
  const distances = new Map<string, number>(nodes.map((node) => [node.id, Number.POSITIVE_INFINITY]));
  const previous = new Map<string, string>();
  distances.set(source, 0);
  const usable = links.filter((link) => link.status !== "failed" && nodeExists(nodes, link.source) && nodeExists(nodes, link.target));
  for (let round = 1; round < nodes.length; round += 1) {
    let changed = false;
    usable.forEach((link) => {
      const weight = linkWeight(link, algorithm);
      const sourceDistance = distances.get(link.source) ?? Number.POSITIVE_INFINITY;
      const targetDistance = distances.get(link.target) ?? Number.POSITIVE_INFINITY;
      if (sourceDistance + weight < targetDistance) {
        distances.set(link.target, sourceDistance + weight);
        previous.set(link.target, link.source);
        changed = true;
      }
      if (targetDistance + weight < sourceDistance) {
        distances.set(link.source, targetDistance + weight);
        previous.set(link.source, link.target);
        changed = true;
      }
    });
    if (!changed) break;
  }
  return restorePath(previous, source, destination);
}

function floodingRoute(nodes: NetworkNode[], links: NetworkLink[], source: string, destination: string) {
  const adjacency = buildAdjacency(nodes, links, "flooding");
  const queue: string[][] = [[source]];
  const explored = new Set<string>([source]);
  while (queue.length) {
    const path = queue.shift();
    if (!path) break;
    const current = path[path.length - 1];
    if (current === destination) return path;
    const edges = [...(adjacency.get(current) ?? [])].sort((a, b) => a.cost - b.cost);
    edges.forEach((edge) => {
      if (!explored.has(edge.to)) {
        explored.add(edge.to);
        queue.push([...path, edge.to]);
      }
    });
  }
  return [];
}

export function routeForAlgorithm(
  nodes: NetworkNode[],
  links: NetworkLink[],
  source: string,
  destination: string,
  algorithm: RoutingAlgorithm,
) {
  if (!nodeExists(nodes, source) || !nodeExists(nodes, destination)) return [];
  if (algorithm === "flooding") return floodingRoute(nodes, links, source, destination);
  if (algorithm === "bellmanFord" || algorithm === "distanceVector") {
    return bellmanFordRoute(nodes, links, source, destination, algorithm);
  }
  return dijkstraRoute(nodes, links, source, destination, algorithm);
}

function routeLinks(links: NetworkLink[], route: string[]) {
  return route.slice(1).flatMap((node, index) => {
    const preceding = route[index];
    const link = links.find(
      (candidate) =>
        (candidate.source === preceding && candidate.target === node) ||
        (candidate.source === node && candidate.target === preceding),
    );
    return link ? [link] : [];
  });
}

function stableHash(value: string) {
  return Array.from(value).reduce((hash, char) => ((hash << 5) - hash + char.charCodeAt(0)) | 0, 0) >>> 0;
}

export function simulatePacket(
  nodes: NetworkNode[],
  links: NetworkLink[],
  source: string,
  destination: string,
  algorithm: RoutingAlgorithm,
  sequence = 1,
): PacketResult {
  const route = routeForAlgorithm(nodes, links, source, destination, algorithm);
  const traversed = routeLinks(links, route);
  if (route.length < 2 || traversed.length !== route.length - 1) {
    return {
      id: `pkt-${sequence}`,
      source,
      destination,
      route,
      latency: 0,
      hops: 0,
      deliveryTime: 0,
      lost: true,
      retransmissions: 0,
      algorithm,
    };
  }
  const rawLatency = traversed.reduce((total, link) => total + link.latency * (link.status === "congested" ? link.congestionFactor ?? 1.62 : 1), 0);
  const weightedLoss = traversed.reduce((total, link) => total + link.packetLoss * (link.status === "congested" ? (link.congestionFactor ?? 1.45) * 0.9 : 1), 0) / traversed.length;
  const lossChance = Math.min(0.88, weightedLoss / 100 + (algorithm === "flooding" ? 0.014 : 0));
  const draw = (stableHash(`${algorithm}-${sequence}-${route.join("-")}`) % 1000) / 1000;
  const lost = draw < lossChance;
  const retransmissions = lost ? 1 + (stableHash(`${sequence}-${algorithm}`) % 3) : weightedLoss > 0.9 ? 1 : 0;
  const latency = Math.round(rawLatency * algorithmPenalty[algorithm]);
  return {
    id: `pkt-${sequence}`,
    source,
    destination,
    route,
    latency,
    hops: route.length - 1,
    deliveryTime: lost ? 0 : Math.round(latency + retransmissions * 7.5),
    lost,
    retransmissions,
    algorithm,
  };
}

export function compareAlgorithms(nodes: NetworkNode[], links: NetworkLink[], source: string, destination: string): ComparisonMetric[] {
  return (Object.keys(algorithmLabels) as RoutingAlgorithm[]).map((algorithm, index) => {
    const samples = Array.from({ length: 16 }, (_, sample) => simulatePacket(nodes, links, source, destination, algorithm, sample + 1));
    const delivered = samples.filter((sample) => !sample.lost);
    const deliveredLatency = delivered.reduce((total, sample) => total + sample.latency, 0) / Math.max(delivered.length, 1);
    const baseLatency = deliveredLatency || 120;
    return {
      algorithm,
      avgLatency: Math.round(baseLatency + index * 0.4),
      packetLoss: Number(((samples.length - delivered.length) / samples.length * 100).toFixed(1)),
      deliveryRate: Math.round((delivered.length / samples.length) * 100),
    };
  });
}

export function applyScheduledEvents(
  nodes: NetworkNode[],
  links: NetworkLink[],
  events: ScheduledEvent[],
  time: number,
) {
  const updatedNodes = nodes.map((node) => ({ ...node }));
  const updatedLinks = links.map((link) => ({ ...link }));
  const triggered = events.filter((event) => event.time <= time).sort((a, b) => a.time - b.time);
  triggered.forEach((event) => {
    const link = updatedLinks.find((candidate) => candidate.id === event.targetId);
    const node = updatedNodes.find((candidate) => candidate.id === event.targetId);
    if (event.type === "nodeFailure" && node) node.status = "failed";
    if (!link) return;
    if (event.type === "linkFailure") link.status = "failed";
    if (event.type === "congestion") {
      link.status = "congested";
      link.congestionFactor = Math.max(1, event.value ?? 1.75);
    }
    if (event.type === "latencyIncrease") link.latency += event.value ?? 10;
    if (event.type === "packetLoss") link.packetLoss = Math.min(100, link.packetLoss + (event.value ?? 8));
    if (event.type === "bandwidthReduction") link.bandwidth = Math.max(1, Math.round(link.bandwidth * (1 - (event.value ?? 30) / 100)));
  });
  return { nodes: updatedNodes, links: updatedLinks, triggered };
}

export function connectionId(source: string, target: string) {
  return [source, target].sort().join("-");
}

export function filterEventLog<T extends { text: string }>(entries: T[], query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return entries;
  return entries.filter((entry) => entry.text.toLowerCase().includes(normalized));
}

export function comparisonBarPercent(latency: number, maxLatency: number) {
  if (maxLatency <= 0) return 8;
  return Math.max(8, Math.min(100, (latency / maxLatency) * 100));
}
