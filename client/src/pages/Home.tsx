import NetworkCanvas from "@/components/NetworkCanvas";
import SimulationDesk, { type SimulationFrame } from "@/components/SimulationDesk";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import {
  algorithmLabels,
  defaultEvents,
  defaultLinks,
  defaultNodes,
  type DynamicEventType,
  type LinkStatus,
  type NetworkLink,
  type NetworkNode,
  type ScheduledEvent,
} from "@/lib/network-sim";
import {
  Activity,
  Cable,
  ChevronDown,
  CircleDot,
  Clock3,
  Gauge,
  Link2,
  Network,
  Plus,
  RadioTower,
  Router,
  SlidersHorizontal,
  Sparkles,
  TriangleAlert,
  Waypoints,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

type SelectedItem = { type: "link" | "node"; id: string } | null;
type SavedExperimentView = { id: number; name: string; algorithm: string; resultsJson: string; createdAt: Date };

const eventConfig: Record<DynamicEventType, { label: string; color: string }> = {
  linkFailure: { label: "Link failure", color: "#ef6953" },
  nodeFailure: { label: "Node failure", color: "#ef6953" },
  congestion: { label: "Congestion", color: "#f2a04e" },
  latencyIncrease: { label: "Latency increase", color: "#62ddd5" },
  packetLoss: { label: "Packet loss", color: "#d983d1" },
  bandwidthReduction: { label: "Bandwidth reduction", color: "#a9cd64" },
};

const magnitudeConfig: Partial<Record<DynamicEventType, { label: string; suffix: string; defaultValue: number; min: number; step: number }>> = {
  congestion: { label: "Load", suffix: "×", defaultValue: 1.8, min: 1, step: 0.1 },
  latencyIncrease: { label: "Delta", suffix: "ms", defaultValue: 12, min: 1, step: 1 },
  packetLoss: { label: "Increase", suffix: "%", defaultValue: 8, min: 0.1, step: 0.1 },
  bandwidthReduction: { label: "Reduction", suffix: "%", defaultValue: 35, min: 1, step: 1 },
};

function labelForIndex(index: number) {
  return String.fromCharCode(65 + index);
}

export default function Home() {
  const { isAuthenticated } = useAuth();
  const [nodes, setNodes] = useState<NetworkNode[]>(defaultNodes);
  const [links, setLinks] = useState<NetworkLink[]>(defaultLinks);
  const [events, setEvents] = useState<ScheduledEvent[]>(defaultEvents);
  const [selected, setSelected] = useState<SelectedItem>({ type: "link", id: "B-D" });
  const [linkFrom, setLinkFrom] = useState("A");
  const [linkTo, setLinkTo] = useState("D");
  const [eventType, setEventType] = useState<DynamicEventType>("congestion");
  const [eventTarget, setEventTarget] = useState("B-C");
  const [eventTime, setEventTime] = useState(50);
  const [eventValue, setEventValue] = useState(1.8);
  const [timelineCursor, setTimelineCursor] = useState(0);
  const [simulationFrame, setSimulationFrame] = useState<SimulationFrame | null>(null);
  const saveTopologyMutation = trpc.workspace.saveTopology.useMutation();
  const saveExperimentMutation = trpc.workspace.saveExperiment.useMutation();
  const savedTopologiesQuery = trpc.workspace.listTopologies.useQuery(undefined, { enabled: isAuthenticated });
  const savedExperimentsQuery = trpc.workspace.listExperiments.useQuery(undefined, { enabled: isAuthenticated });
  const savedTopologies = savedTopologiesQuery.data ?? [];
  const savedExperiments = (savedExperimentsQuery.data ?? []) as SavedExperimentView[];
  const [openedExperimentId, setOpenedExperimentId] = useState<number | null>(null);
  const openedExperiment = savedExperiments.find((experiment) => experiment.id === openedExperimentId) ?? null;

  const visibleNodes = simulationFrame?.nodes ?? nodes;
  const visibleLinks = simulationFrame?.links ?? links;
  const selectedLink = selected?.type === "link" ? visibleLinks.find((link) => link.id === selected.id) : undefined;
  const selectedNode = selected?.type === "node" ? visibleNodes.find((node) => node.id === selected.id) : undefined;
  const activeEvents = useMemo(() => events.filter((event) => event.time <= timelineCursor), [events, timelineCursor]);
  const targetOptions = eventType === "nodeFailure"
    ? nodes.map((node) => ({ value: node.id, label: `Node · ${node.id} (${node.kind})` }))
    : links.map((link) => ({ value: link.id, label: `Link · ${link.id}` }));
  const activeMagnitude = magnitudeConfig[eventType];

  const moveNode = useCallback((id: string, x: number, y: number) => {
    setNodes((previous) => previous.map((node) => (node.id === id ? { ...node, x, y } : node)));
  }, []);

  const handleSimulationFrame = useCallback((frame: SimulationFrame) => {
    setSimulationFrame(frame);
    setTimelineCursor(frame.time);
  }, []);

  const requireSession = useCallback(() => {
    if (isAuthenticated) return true;
    toast.message("Sign in to save your workspace and experiment history.");
    startLogin();
    return false;
  }, [isAuthenticated]);

  const saveTopology = useCallback(() => {
    if (!requireSession()) return;
    saveTopologyMutation.mutate({ name: "Scenario 08 · Crosswind", nodes, links, events }, {
      onSuccess: () => {
        void savedTopologiesQuery.refetch();
        toast.success("Topology saved to your workspace.");
      },
      onError: () => toast.error("The topology could not be saved. Please retry."),
    });
  }, [events, links, nodes, requireSession, saveTopologyMutation, savedTopologiesQuery]);

  const saveExperiment = useCallback((payload: { algorithm: keyof typeof algorithmLabels; elapsed: number; packets: unknown; comparisons: unknown }) => {
    if (!requireSession()) return;
    saveExperimentMutation.mutate({
      name: `Scenario 08 · T+${payload.elapsed}s`,
      algorithm: payload.algorithm,
      results: { capturedAt: Date.now(), ...payload },
    }, {
      onSuccess: () => {
        void savedExperimentsQuery.refetch();
        toast.success("Experiment result saved to your workspace.");
      },
      onError: () => toast.error("The experiment could not be saved. Please retry."),
    });
  }, [requireSession, saveExperimentMutation, savedExperimentsQuery]);

  const loadTopology = useCallback((id: number) => {
    const saved = savedTopologies.find((topology) => topology.id === id);
    if (!saved) return;
    try {
      setNodes(JSON.parse(saved.nodesJson) as NetworkNode[]);
      setLinks(JSON.parse(saved.linksJson) as NetworkLink[]);
      setEvents(JSON.parse(saved.eventsJson) as ScheduledEvent[]);
      setSimulationFrame(null);
      setTimelineCursor(0);
      setSelected(null);
      toast.success(`Loaded ${saved.name}.`);
    } catch {
      toast.error("This saved topology could not be restored.");
    }
  }, [savedTopologies]);

  const addNode = (kind: NetworkNode["kind"]) => {
    const index = nodes.length;
    const id = labelForIndex(index);
    const nextNode: NetworkNode = {
      id,
      label: kind === "router" ? `Router ${id}` : `Host ${id}`,
      kind,
      x: 24 + ((index * 19) % 58),
      y: 24 + ((index * 23) % 52),
      status: "online",
    };
    setNodes((previous) => [...previous, nextNode]);
    setSelected({ type: "node", id });
  };

  const addLink = () => {
    if (linkFrom === linkTo) return;
    const id = [linkFrom, linkTo].sort().join("-");
    if (links.some((link) => link.id === id)) return;
    const nextLink: NetworkLink = { id, source: linkFrom, target: linkTo, bandwidth: 800, latency: 16, packetLoss: 0.3, status: "healthy" };
    setLinks((previous) => [...previous, nextLink]);
    setSelected({ type: "link", id });
  };

  const updateLink = (property: keyof NetworkLink, value: number | LinkStatus) => {
    if (!selectedLink) return;
    setLinks((previous) => previous.map((link) => (link.id === selectedLink.id ? { ...link, [property]: value } : link)));
  };

  const addEvent = () => {
    if (!eventTarget) return;
    const magnitudeText = activeMagnitude ? ` · ${eventValue}${activeMagnitude.suffix}` : "";
    const event: ScheduledEvent = {
      id: `event-${Date.now()}`,
      time: eventTime,
      type: eventType,
      targetId: eventTarget,
      label: `${eventTarget} · ${eventConfig[eventType].label}${magnitudeText}`,
      value: activeMagnitude ? eventValue : undefined,
    };
    setEvents((previous) => [...previous, event].sort((a, b) => a.time - b.time));
  };

  return (
    <div className="app-shell">
      <header className="top-nav sticky top-0 z-30">
        <div className="mx-auto flex max-w-[1680px] items-center justify-between gap-4 px-4 py-3 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <div className="brand-mark grid h-10 w-10 place-items-center rounded-xl border border-cyan-200/40 bg-cyan-300/10">
              <Network className="h-5 w-5 text-cyan-200" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold tracking-tight text-white">NetRoute</span>
                <span className="hidden rounded border border-orange-300/25 bg-orange-400/10 px-1.5 py-0.5 font-mono text-[9px] font-medium tracking-[0.16em] text-orange-200 sm:inline">LAB</span>
              </div>
              <p className="brand-kicker hidden text-[9px] text-cyan-100/45 sm:block">Dynamic routing control workspace</p>
            </div>
          </div>
          <nav className="hidden items-center gap-6 text-sm text-cyan-50/55 lg:flex">
            <button className="text-white">Workspace</button>
            <button className="transition-colors hover:text-white">Experiments</button>
            <button className="transition-colors hover:text-white">Compare</button>
          </nav>
          <div className="flex items-center gap-2">
            <button onClick={saveTopology} disabled={saveTopologyMutation.isPending} className="hidden h-9 items-center gap-2 rounded-lg border border-cyan-100/15 bg-white/5 px-3 text-xs font-medium text-cyan-50 transition hover:bg-white/10 disabled:opacity-50 md:flex"><SaveIcon />{saveTopologyMutation.isPending ? "Saving" : "Save topology"}</button>
            <div className="hidden items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-emerald-200 sm:flex">
              <span className="status-dot h-1.5 w-1.5 rounded-full bg-emerald-300" /> Core online
            </div>
            <button className="grid h-9 w-9 place-items-center rounded-lg border border-cyan-100/15 bg-white/5 text-cyan-50/75 transition hover:bg-white/10" aria-label="Workspace settings"><SlidersHorizontal className="h-4 w-4" /></button>
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-[1680px] px-4 py-6 lg:px-8 lg:py-8">
        <section className="mb-6 flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
          <div>
            <div className="eyebrow mb-3 flex items-center gap-2 text-[10px] text-orange-200/75"><Sparkles className="h-3.5 w-3.5" /> Scenario 08 / Crosswind</div>
            <h1 className="max-w-2xl text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">Routing decisions, <span className="text-cyan-200">in motion.</span></h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-cyan-50/57">Build a topology, stage disruption, then observe how every route responds under pressure.</p>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <Metric label="Nodes" value={visibleNodes.length.toString()} detail={`${visibleNodes.filter((node) => node.status === "online").length} online`} tone="cyan" />
            <Metric label="Links" value={visibleLinks.length.toString()} detail={`${visibleLinks.filter((link) => link.status === "healthy").length} stable`} tone="orange" />
            <Metric label="Events" value={events.length.toString()} detail={`${activeEvents.length} applied`} tone="violet" />
          </div>
        </section>

        <div className="workspace-grid grid gap-4 xl:grid-cols-[270px_minmax(0,1fr)_300px]">
          <aside className="glass-panel thin-scrollbar rounded-2xl p-4 xl:h-[715px] xl:overflow-y-auto">
            <PanelHeading icon={<Waypoints className="h-4 w-4" />} kicker="Topology" title="Network builder" />
            <p className="mt-2 text-xs leading-5 text-cyan-50/50">Compose the route surface. Drag any device directly on the canvas to reposition it.</p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <ToolButton icon={<Router className="h-4 w-4" />} label="Add router" onClick={() => addNode("router")} />
              <ToolButton icon={<CircleDot className="h-4 w-4" />} label="Add host" accent onClick={() => addNode("host")} />
            </div>
            <div className="mt-5 border-t border-cyan-100/10 pt-5">
              <p className="eyebrow text-[9px] text-cyan-50/44">Connect nodes</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Select value={linkFrom} onChange={setLinkFrom} options={nodes.map((node) => ({ value: node.id, label: node.id }))} />
                <Select value={linkTo} onChange={setLinkTo} options={nodes.map((node) => ({ value: node.id, label: node.id }))} />
              </div>
              <button onClick={addLink} className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-cyan-300/18 bg-cyan-300/10 px-3 py-2 text-xs font-medium text-cyan-50 transition hover:bg-cyan-300/18 active:scale-[.97]"><Link2 className="h-3.5 w-3.5" /> Create link</button>
            </div>
            <div className="mt-5 border-t border-cyan-100/10 pt-5">
              <div className="flex items-center justify-between"><p className="eyebrow text-[9px] text-cyan-50/44">Topology inventory</p><span className="font-mono text-[10px] text-cyan-100/45">{nodes.length + links.length} assets</span></div>
              <div className="mt-3 space-y-1.5">
                {nodes.map((node) => <InventoryRow key={node.id} active={selected?.id === node.id} icon={node.kind === "router" ? <Router className="h-3.5 w-3.5" /> : <CircleDot className="h-3.5 w-3.5" />} label={`${node.id} · ${node.kind}`} detail={node.status} onClick={() => setSelected({ type: "node", id: node.id })} />)}
              </div>
            </div>
            <div className="mt-5 border-t border-cyan-100/10 pt-5">
              <div className="flex items-center justify-between"><p className="eyebrow text-[9px] text-cyan-50/44">Saved workspaces</p><span className="font-mono text-[10px] text-cyan-100/45">{isAuthenticated ? savedTopologies.length : "locked"}</span></div>
              {!isAuthenticated ? <button onClick={() => startLogin()} className="mt-3 w-full rounded-lg border border-cyan-100/10 bg-cyan-300/6 px-3 py-2 text-left text-xs text-cyan-50/60 transition hover:bg-cyan-300/12">Sign in to restore saved workspaces</button> : savedTopologies.length ? <div className="mt-3 space-y-1.5">{savedTopologies.slice(0, 3).map((topology) => <button key={topology.id} onClick={() => loadTopology(topology.id)} className="flex w-full items-center justify-between rounded-lg border border-cyan-100/8 bg-slate-950/22 px-2.5 py-2 text-left transition hover:border-cyan-200/25 hover:bg-cyan-300/8"><span className="truncate text-xs text-cyan-50/72">{topology.name}</span><span className="ml-2 shrink-0 font-mono text-[9px] text-cyan-100/38">LOAD</span></button>)}</div> : <p className="mt-3 text-xs leading-5 text-cyan-50/42">No saved workspaces yet. Save the current topology to build your history.</p>}
            </div>
          </aside>

          <section className="glass-panel overflow-hidden rounded-2xl">
            <div className="flex flex-col gap-3 border-b border-cyan-100/10 px-4 py-4 md:flex-row md:items-center md:justify-between md:px-5">
              <div className="flex items-center gap-3"><div className="rounded-lg bg-orange-300/10 p-2 text-orange-200"><RadioTower className="h-4 w-4" /></div><div><p className="text-sm font-semibold text-white">Topology workspace</p><p className="font-mono text-[10px] text-cyan-50/47">4 nodes · 5 links · ARP-08</p></div></div>
              <div className="flex items-center gap-2"><StatusLegend color="cyan" label="Healthy" /><StatusLegend color="orange" label="Congested" /><StatusLegend color="red" label="Failed" /></div>
            </div>
            <div className="p-3 md:p-4"><NetworkCanvas nodes={visibleNodes} links={visibleLinks} activeRoute={simulationFrame?.activeRoute ?? []} packetProgress={simulationFrame?.packetProgress ?? 0} selectedId={selected?.id} onSelectNode={(id) => setSelected({ type: "node", id })} onSelectLink={(id) => setSelected({ type: "link", id })} onMoveNode={moveNode} /></div>
          </section>

          <aside className="right-rail gap-4 xl:flex xl:h-[715px] xl:flex-col">
            <section className="glass-panel rounded-2xl p-4 xl:flex-1">
              <PanelHeading icon={<Cable className="h-4 w-4" />} kicker="Inspector" title={selectedLink ? `${selectedLink.source} ↔ ${selectedLink.target}` : selectedNode ? selectedNode.label : "Select an asset"} />
              {selectedLink ? <LinkInspector link={selectedLink} onUpdate={updateLink} /> : selectedNode ? <NodeInspector node={selectedNode} onUpdateStatus={(status) => setNodes((previous) => previous.map((node) => node.id === selectedNode.id ? { ...node, status } : node))} /> : null}
            </section>
            <section className="glass-panel rounded-2xl p-4 xl:flex-1">
              <PanelHeading icon={<Activity className="h-4 w-4" />} kicker="Route probe" title="Simulation defaults" />
              <div className="mt-4 space-y-3"><ProbeField label="Source" value="Gateway A" /><ProbeField label="Destination" value="Edge D" /><ProbeField label="Algorithm" value={algorithmLabels.adaptive} accent /></div>
              <div className="mt-4 rounded-xl border border-orange-300/15 bg-orange-300/7 p-3"><div className="flex items-start gap-2"><TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-orange-200" /><p className="text-xs leading-5 text-orange-50/72">Timeline disruptions will be applied during a run. Adaptive routing will recompute at each transition.</p></div></div>
            </section>
          </aside>
        </div>

        <section className="glass-panel mt-4 rounded-2xl p-4 md:p-5">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
            <div><PanelHeading icon={<Clock3 className="h-4 w-4" />} kicker="Scenario timeline" title="Disruption schedule" /><p className="mt-2 text-xs text-cyan-50/50">Stage conditions along the experiment clock before running a packet stream.</p></div>
            <div className="flex items-center gap-2 rounded-xl border border-cyan-100/10 bg-slate-950/30 px-3 py-2 font-mono text-[10px] text-cyan-100/60"><Gauge className="h-3.5 w-3.5 text-cyan-200" /> CURRENT T+{timelineCursor.toString().padStart(2, "0")} SEC</div>
          </div>
          <div className="mt-6 overflow-x-auto pb-2"><div className="relative min-w-[700px] px-5">
            <div className="absolute left-5 right-5 top-[39px] h-px bg-gradient-to-r from-cyan-300/25 via-orange-300/30 to-cyan-300/12" />
            <div className="absolute top-[35px] h-2 w-2 rounded-full bg-cyan-200 shadow-[0_0_16px_rgba(113,238,229,.8)]" style={{ left: `calc(20px + ${Math.min(timelineCursor, 90) / 90 * 100}% - ${timelineCursor / 90 * 40}px)` }} />
            <div className="grid grid-cols-10 gap-0">{Array.from({ length: 10 }, (_, index) => <button key={index} onClick={() => setTimelineCursor(index * 10)} className="relative h-[104px] text-left"><span className="font-mono text-[10px] text-cyan-50/38">{index * 10}s</span><span className="absolute top-[33px] h-3 w-px bg-cyan-100/30" /></button>)}</div>
            {events.map((event) => <button key={event.id} onClick={() => setTimelineCursor(event.time)} className="timeline-event absolute top-[11px] w-[132px] text-left" style={{ left: `calc(20px + ${event.time / 90 * 100}% - ${event.time / 90 * 40}px)` }}><span className="mb-1.5 block min-h-8 rounded-md border px-2 py-1.5 font-mono text-[9px] leading-3" style={{ color: eventConfig[event.type].color, borderColor: `${eventConfig[event.type].color}44`, background: `${eventConfig[event.type].color}12` }}>{event.label}</span><span className="ml-1 block h-3 w-3 rounded-full border-2 border-slate-950" style={{ background: eventConfig[event.type].color, boxShadow: `0 0 12px ${eventConfig[event.type].color}` }} /></button>)}
          </div></div>
          <div className="mt-3 grid gap-3 border-t border-cyan-100/10 pt-4 md:grid-cols-[1.2fr_1fr_82px_98px_auto]">
            <Select value={eventType} onChange={(value) => {
              const nextType = value as DynamicEventType;
              setEventType(nextType);
              setEventTarget(nextType === "nodeFailure" ? nodes[0]?.id ?? "" : links[0]?.id ?? "");
              setEventValue(magnitudeConfig[nextType]?.defaultValue ?? 0);
            }} options={Object.entries(eventConfig).map(([value, config]) => ({ value, label: config.label }))} />
            <Select value={eventTarget} onChange={setEventTarget} options={targetOptions} />
            <input aria-label="Event time" type="number" min="0" max="90" value={eventTime} onChange={(event) => setEventTime(Number(event.target.value))} className="h-10 rounded-lg border border-cyan-100/10 bg-slate-950/30 px-3 font-mono text-xs text-white outline-none transition focus:border-cyan-300/55" />
            <label className={`relative ${activeMagnitude ? "" : "opacity-35"}`}><span className="pointer-events-none absolute left-3 top-1.5 font-mono text-[8px] uppercase text-cyan-50/40">{activeMagnitude?.label ?? "No magnitude"}</span><input aria-label="Event magnitude" disabled={!activeMagnitude} type="number" min={activeMagnitude?.min} step={activeMagnitude?.step} value={activeMagnitude ? eventValue : 0} onChange={(event) => setEventValue(Number(event.target.value))} className="h-10 w-full rounded-lg border border-cyan-100/10 bg-slate-950/30 px-3 pt-3 font-mono text-xs text-white outline-none transition focus:border-cyan-300/55 disabled:cursor-not-allowed" /><span className="pointer-events-none absolute bottom-1.5 right-2.5 font-mono text-[9px] text-cyan-50/38">{activeMagnitude?.suffix}</span></label>
            <button onClick={addEvent} className="flex h-10 items-center justify-center gap-2 rounded-lg bg-orange-300 px-4 text-xs font-semibold text-slate-950 transition hover:bg-orange-200 active:scale-[.97]"><Plus className="h-3.5 w-3.5" /> Stage event</button>
          </div>
        </section>
        <SimulationDesk nodes={nodes} links={links} events={events} onFrame={handleSimulationFrame} onSaveExperiment={saveExperiment} />
        <ExperimentHistory isAuthenticated={isAuthenticated} experiments={savedExperiments} openedExperiment={openedExperiment} onOpen={setOpenedExperimentId} onSignIn={() => startLogin()} />
      </main>
    </div>
  );
}

function Metric({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: "cyan" | "orange" | "violet" }) {
  const colors = { cyan: "text-cyan-200", orange: "text-orange-200", violet: "text-violet-200" };
  return <div className="glass-panel min-w-[83px] rounded-xl px-3 py-2.5"><p className="eyebrow text-[8px] text-cyan-50/42">{label}</p><div className="mt-1 flex items-end gap-1.5"><span className={`metric-value text-xl font-semibold ${colors[tone]}`}>{value}</span><span className="mb-0.5 font-mono text-[9px] text-cyan-50/40">{detail}</span></div></div>;
}

function PanelHeading({ icon, kicker, title }: { icon: React.ReactNode; kicker: string; title: string }) {
  return <div className="flex items-center gap-3"><div className="grid h-8 w-8 place-items-center rounded-lg border border-cyan-100/10 bg-cyan-300/8 text-cyan-200">{icon}</div><div><p className="eyebrow text-[9px] text-cyan-50/42">{kicker}</p><h2 className="mt-0.5 text-sm font-semibold text-white">{title}</h2></div></div>;
}

function ToolButton({ icon, label, accent, onClick }: { icon: React.ReactNode; label: string; accent?: boolean; onClick: () => void }) {
  return <button onClick={onClick} className={`flex flex-col gap-2 rounded-xl border p-3 text-left transition hover:-translate-y-0.5 hover:border-cyan-200/35 active:scale-[.97] ${accent ? "border-orange-300/16 bg-orange-300/8 text-orange-100" : "border-cyan-100/12 bg-cyan-300/6 text-cyan-50"}`}><span className={accent ? "text-orange-200" : "text-cyan-200"}>{icon}</span><span className="text-xs font-medium">{label}</span></button>;
}

function Select({ value, onChange, options }: { value: string; onChange: (value: string) => void; options: { value: string; label: string }[] }) {
  return <div className="relative"><select value={value} onChange={(event) => onChange(event.target.value)} className="h-10 w-full appearance-none rounded-lg border border-cyan-100/10 bg-slate-950/30 px-3 pr-8 text-xs text-cyan-50 outline-none transition focus:border-cyan-300/55">{options.map((option) => <option key={option.value} value={option.value} className="bg-slate-900">{option.label}</option>)}</select><ChevronDown className="pointer-events-none absolute right-2.5 top-3 h-4 w-4 text-cyan-50/35" /></div>;
}

function InventoryRow({ icon, label, detail, active, onClick }: { icon: React.ReactNode; label: string; detail: string; active: boolean; onClick: () => void }) {
  return <button onClick={onClick} className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left transition ${active ? "bg-cyan-300/12 text-white" : "text-cyan-50/60 hover:bg-white/5 hover:text-white"}`}><span className="flex items-center gap-2 text-xs"><span className="text-cyan-200/80">{icon}</span>{label}</span><span className="font-mono text-[9px] uppercase text-cyan-100/40">{detail}</span></button>;
}

function StatusLegend({ color, label }: { color: "cyan" | "orange" | "red"; label: string }) {
  const styles = { cyan: "bg-cyan-300 text-cyan-100", orange: "bg-orange-300 text-orange-100", red: "bg-red-400 text-red-100" };
  return <span className={`flex items-center gap-1.5 font-mono text-[9px] ${styles[color].split(" ")[1]}`}><span className={`h-1.5 w-1.5 rounded-full ${styles[color].split(" ")[0]}`} />{label}</span>;
}

function LinkInspector({ link, onUpdate }: { link: NetworkLink; onUpdate: (property: keyof NetworkLink, value: number | LinkStatus) => void }) {
  return <div className="mt-5"><div className="flex gap-1.5 rounded-lg border border-cyan-100/10 bg-slate-950/30 p-1">{(["healthy", "congested", "failed"] as LinkStatus[]).map((status) => <button key={status} onClick={() => onUpdate("status", status)} className={`flex-1 rounded-md px-1 py-1.5 font-mono text-[8px] uppercase transition ${link.status === status ? status === "healthy" ? "bg-cyan-300/18 text-cyan-100" : status === "congested" ? "bg-orange-300/18 text-orange-100" : "bg-red-400/18 text-red-100" : "text-cyan-50/38 hover:text-cyan-50/70"}`}>{status}</button>)}</div><div className="mt-4 space-y-3"><InspectorNumber label="Bandwidth" suffix="Mbps" value={link.bandwidth} onChange={(value) => onUpdate("bandwidth", value)} /><InspectorNumber label="Latency" suffix="ms" value={link.latency} onChange={(value) => onUpdate("latency", value)} /><InspectorNumber label="Packet loss" suffix="%" value={link.packetLoss} step="0.1" onChange={(value) => onUpdate("packetLoss", value)} /></div></div>;
}

function NodeInspector({ node, onUpdateStatus }: { node: NetworkNode; onUpdateStatus: (status: NetworkNode["status"]) => void }) {
  return <div className="mt-5"><div className="rounded-xl border border-cyan-100/10 bg-cyan-300/6 p-3"><p className="font-mono text-[10px] text-cyan-200">{node.kind.toUpperCase()} · {node.id}</p><p className="mt-1 text-sm font-medium text-white">{node.label}</p></div><div className="mt-3 grid grid-cols-2 gap-2"><button onClick={() => onUpdateStatus("online")} className={`rounded-lg border px-3 py-2 text-xs ${node.status === "online" ? "border-cyan-300/35 bg-cyan-300/12 text-cyan-100" : "border-cyan-100/10 text-cyan-50/50"}`}>Online</button><button onClick={() => onUpdateStatus("failed")} className={`rounded-lg border px-3 py-2 text-xs ${node.status === "failed" ? "border-red-300/35 bg-red-300/12 text-red-100" : "border-cyan-100/10 text-cyan-50/50"}`}>Failed</button></div></div>;
}

function InspectorNumber({ label, suffix, value, step = "1", onChange }: { label: string; suffix: string; value: number; step?: string; onChange: (value: number) => void }) {
  return <label className="block"><span className="mb-1.5 flex justify-between font-mono text-[10px] text-cyan-50/47"><span>{label}</span><span className="text-cyan-100/65">{suffix}</span></span><input type="number" min="0" step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} className="h-9 w-full rounded-lg border border-cyan-100/10 bg-slate-950/30 px-3 font-mono text-xs text-white outline-none transition focus:border-cyan-300/55" /></label>;
}

function ProbeField({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return <div className="flex items-center justify-between rounded-lg border border-cyan-100/10 bg-slate-950/24 px-3 py-2.5"><span className="font-mono text-[10px] text-cyan-50/40">{label}</span><span className={`text-xs ${accent ? "text-orange-100" : "text-cyan-50/80"}`}>{value}</span></div>;
}

function SaveIcon() {
  return <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2 2Z" /><path d="M17 21v-8H7v8" /><path d="M7 3v5h8" /></svg>;
}

function ExperimentHistory({ isAuthenticated, experiments, openedExperiment, onOpen, onSignIn }: { isAuthenticated: boolean; experiments: SavedExperimentView[]; openedExperiment: SavedExperimentView | null; onOpen: (id: number) => void; onSignIn: () => void }) {
  const summary = openedExperiment ? readExperimentSummary(openedExperiment.resultsJson) : null;
  return <section className="glass-panel mt-4 rounded-2xl p-4 md:p-5"><div className="flex flex-col justify-between gap-3 md:flex-row md:items-center"><div><div className="eyebrow text-[9px] text-cyan-50/42">Experiment archive</div><h2 className="mt-1 text-sm font-semibold text-white">Reopen prior simulation results</h2></div><span className="rounded border border-cyan-100/10 px-2 py-1 font-mono text-[9px] text-cyan-100/46">{isAuthenticated ? `${experiments.length} SAVED` : "SIGN IN REQUIRED"}</span></div>{!isAuthenticated ? <div className="mt-4 flex flex-col justify-between gap-3 rounded-xl border border-cyan-100/10 bg-slate-950/25 p-4 sm:flex-row sm:items-center"><p className="text-sm text-cyan-50/58">Sign in to browse saved packet traces and algorithm comparisons from earlier runs.</p><button onClick={onSignIn} className="rounded-lg bg-cyan-300 px-3 py-2 text-xs font-semibold text-slate-950 transition hover:bg-cyan-200 active:scale-[.97]">Sign in to archive</button></div> : experiments.length ? <div className="mt-4 grid gap-4 xl:grid-cols-[1.1fr_.9fr]"><div className="overflow-hidden rounded-xl border border-cyan-100/10"><table className="w-full text-left"><thead className="bg-slate-950/25 font-mono text-[9px] uppercase tracking-[.12em] text-cyan-50/38"><tr><th className="px-3 py-2 font-normal">Experiment</th><th className="px-3 py-2 font-normal">Algorithm</th><th className="px-3 py-2 font-normal">Saved</th><th className="px-3 py-2 font-normal" /></tr></thead><tbody>{experiments.map((experiment) => <tr key={experiment.id} className={`border-t border-cyan-100/7 ${openedExperiment?.id === experiment.id ? "bg-cyan-300/8" : ""}`}><td className="px-3 py-3 text-xs font-medium text-cyan-50/78">{experiment.name}</td><td className="px-3 py-3 font-mono text-[10px] text-orange-100/80">{algorithmLabels[experiment.algorithm as keyof typeof algorithmLabels] ?? experiment.algorithm}</td><td className="px-3 py-3 font-mono text-[10px] text-cyan-100/40">{new Date(experiment.createdAt).toLocaleDateString()}</td><td className="px-3 py-3 text-right"><button onClick={() => onOpen(experiment.id)} className="rounded-md border border-cyan-200/16 px-2 py-1 font-mono text-[9px] text-cyan-100 transition hover:bg-cyan-300/12">OPEN</button></td></tr>)}</tbody></table></div><div className="rounded-xl border border-orange-200/12 bg-orange-300/[.055] p-4">{openedExperiment && summary ? <><p className="font-mono text-[9px] uppercase tracking-[.12em] text-orange-100/58">Reviewing {openedExperiment.algorithm}</p><p className="mt-1 text-sm font-semibold text-white">{openedExperiment.name}</p><div className="mt-4 grid grid-cols-3 gap-2"><ArchiveMetric label="Run" value={`T+${summary.elapsed ?? 0}s`} /><ArchiveMetric label="Packets" value={(summary.packets?.length ?? 0).toString()} /><ArchiveMetric label="Best" value={bestAlgorithm(summary)} /></div><p className="mt-4 text-xs leading-5 text-cyan-50/56">This archived snapshot preserves the captured packet records and algorithm-comparison data from the saved run.</p></> : <p className="text-sm leading-6 text-cyan-50/50">Select an experiment to review its saved packet trace summary and comparison outcome.</p>}</div></div> : <p className="mt-4 rounded-xl border border-cyan-100/10 bg-slate-950/25 p-4 text-sm text-cyan-50/48">No experiment snapshots have been saved yet. Run a scenario and use <strong className="font-medium text-cyan-100">Save run</strong> to add one here.</p>}</section>;
}

function readExperimentSummary(raw: string): { elapsed?: number; packets?: unknown[]; comparisons?: { algorithm: string; avgLatency: number }[] } | null {
  try { return JSON.parse(raw); } catch { return null; }
}

function bestAlgorithm(summary: { comparisons?: { algorithm: string; avgLatency: number }[] }) {
  const best = [...(summary.comparisons ?? [])].sort((a, b) => a.avgLatency - b.avgLatency)[0];
  return best ? (algorithmLabels[best.algorithm as keyof typeof algorithmLabels] ?? best.algorithm) : "—";
}

function ArchiveMetric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-orange-100/10 bg-slate-950/20 px-2.5 py-2"><p className="font-mono text-[8px] uppercase tracking-[.1em] text-orange-100/43">{label}</p><p className="mt-1 truncate text-xs font-semibold text-orange-50">{value}</p></div>;
}
