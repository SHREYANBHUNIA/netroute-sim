import {
  algorithmDescriptions,
  algorithmLabels,
  applyScheduledEvents,
  comparisonBarPercent,
  compareAlgorithms,
  filterEventLog,
  simulatePacket,
  type ComparisonMetric,
  type NetworkLink,
  type NetworkNode,
  type PacketResult,
  type RoutingAlgorithm,
  type ScheduledEvent,
} from "@/lib/network-sim";
import { BarChart3, Pause, Play, Radio, RotateCcw, Save, Search, Send, TimerReset } from "lucide-react";
import React from "react";
import { useEffect, useMemo, useRef, useState } from "react";

export type SimulationFrame = {
  nodes: NetworkNode[];
  links: NetworkLink[];
  activeRoute: string[];
  packetProgress: number;
  time: number;
};

type SimulationDeskProps = {
  nodes: NetworkNode[];
  links: NetworkLink[];
  events: ScheduledEvent[];
  onFrame: (frame: SimulationFrame) => void;
  onSaveExperiment: (payload: { algorithm: RoutingAlgorithm; elapsed: number; packets: PacketResult[]; comparisons: ComparisonMetric[] }) => void;
};

type EventLog = { id: string; time: number; text: string; type: "info" | "route" | "warning" };

const speedOptions = [1, 2, 4];

export default function SimulationDesk({ nodes, links, events, onFrame, onSaveExperiment }: SimulationDeskProps) {
  const [algorithm, setAlgorithm] = useState<RoutingAlgorithm>("adaptive");
  const [source, setSource] = useState("A");
  const [destination, setDestination] = useState("D");
  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [elapsed, setElapsed] = useState(0);
  const [packetProgress, setPacketProgress] = useState(0);
  const [packets, setPackets] = useState<PacketResult[]>([]);
  const [logs, setLogs] = useState<EventLog[]>([{ id: "ready", time: 0, text: "Simulation controller ready. Scenario armed.", type: "info" }]);
  const [logQuery, setLogQuery] = useState("");
  const emittedAt = useRef<number | null>(null);
  const loggedEvents = useRef(new Set<string>());

  const effective = useMemo(() => applyScheduledEvents(nodes, links, events, elapsed), [nodes, links, events, elapsed]);
  const activePacket = useMemo(() => simulatePacket(effective.nodes, effective.links, source, destination, algorithm, elapsed + 1), [effective, source, destination, algorithm, elapsed]);
  const comparisons = useMemo(() => compareAlgorithms(effective.nodes, effective.links, source, destination), [effective, source, destination]);

  useEffect(() => {
    if (!running) return;
    const interval = window.setInterval(() => {
      setElapsed((previous) => Math.min(90, previous + 5));
      setPacketProgress((previous) => (previous + 0.22 * speed) % 1);
    }, Math.round(840 / speed));
    return () => window.clearInterval(interval);
  }, [running, speed]);

  useEffect(() => {
    if (elapsed >= 90 && running) setRunning(false);
  }, [elapsed, running]);

  useEffect(() => {
    onFrame({ nodes: effective.nodes, links: effective.links, activeRoute: activePacket.route, packetProgress, time: elapsed });
  }, [effective, activePacket.route, packetProgress, elapsed, onFrame]);

  useEffect(() => {
    if (!running || emittedAt.current === elapsed) return;
    emittedAt.current = elapsed;
    setPackets((previous) => [activePacket, ...previous].slice(0, 6));
    const eventLogs: EventLog[] = [];
    events.filter((event) => event.time <= elapsed && !loggedEvents.current.has(event.id)).forEach((event) => {
      loggedEvents.current.add(event.id);
      eventLogs.push({ id: `event-${event.id}`, time: event.time, text: `${event.label} applied to topology.`, type: event.type.includes("Failure") ? "warning" : "info" });
    });
    const routeText = activePacket.route.length ? activePacket.route.join(" → ") : "No viable route";
    eventLogs.push({ id: `packet-${elapsed}-${algorithm}`, time: elapsed, text: `${algorithmLabels[algorithm]} selected ${routeText}.`, type: activePacket.lost ? "warning" : "route" });
    setLogs((previous) => [...eventLogs.reverse(), ...previous].slice(0, 7));
  }, [elapsed, running, activePacket, algorithm, events]);

  const reset = () => {
    setRunning(false);
    setElapsed(0);
    setPacketProgress(0);
    setPackets([]);
    emittedAt.current = null;
    loggedEvents.current.clear();
    setLogs([{ id: `reset-${Date.now()}`, time: 0, text: "Simulation reset. Scenario armed.", type: "info" }]);
  };

  const start = () => {
    if (elapsed >= 90) reset();
    setRunning(true);
  };

  const maxLatency = Math.max(...comparisons.map((comparison) => comparison.avgLatency), 1);
  const latest = packets[0] ?? activePacket;
  const filteredLogs = filterEventLog(logs, logQuery);

  return (
    <section className="glass-panel mt-4 overflow-hidden rounded-2xl">
      <div className="flex flex-col gap-4 border-b border-cyan-100/10 px-4 py-4 md:flex-row md:items-center md:justify-between md:px-5">
        <div className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-lg border border-orange-200/16 bg-orange-300/10 text-orange-200"><Radio className="h-4 w-4" /></div><div><p className="eyebrow text-[9px] text-cyan-50/42">Live engine</p><h2 className="mt-0.5 text-sm font-semibold text-white">Packet simulation control</h2></div></div>
        <div className="flex items-center gap-2"><button onClick={() => onSaveExperiment({ algorithm, elapsed, packets: packets.length ? packets : [activePacket], comparisons })} className="flex h-9 items-center gap-2 rounded-lg border border-cyan-200/17 bg-cyan-300/8 px-3 text-xs font-medium text-cyan-50 transition hover:bg-cyan-300/15 active:scale-[.97]"><Save className="h-3.5 w-3.5 text-cyan-200" />Save run</button><div className="flex items-center gap-2 rounded-xl border border-cyan-100/10 bg-slate-950/30 p-1"><button onClick={start} aria-label="Play simulation" className={`grid h-9 w-9 place-items-center rounded-lg transition active:scale-[.97] ${running ? "bg-cyan-300/18 text-cyan-100" : "text-cyan-50/55 hover:bg-white/5"}`}><Play className="h-4 w-4 fill-current" /></button><button onClick={() => setRunning(false)} aria-label="Pause simulation" className="grid h-9 w-9 place-items-center rounded-lg text-cyan-50/55 transition hover:bg-white/5 active:scale-[.97]"><Pause className="h-4 w-4 fill-current" /></button><button onClick={reset} aria-label="Reset simulation" className="grid h-9 w-9 place-items-center rounded-lg text-cyan-50/55 transition hover:bg-white/5 active:scale-[.97]"><RotateCcw className="h-4 w-4" /></button><span className="mx-1 h-5 w-px bg-cyan-100/10" />{speedOptions.map((option) => <button key={option} onClick={() => setSpeed(option)} className={`rounded-md px-2 py-1.5 font-mono text-[10px] transition ${speed === option ? "bg-orange-300 text-slate-950" : "text-cyan-50/44 hover:text-white"}`}>{option}×</button>)}</div></div>
      </div>

      <div className="grid gap-0 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,.9fr)]">
        <div className="p-4 md:p-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <SelectBox label="Routing strategy" value={algorithm} onChange={(value) => setAlgorithm(value as RoutingAlgorithm)} options={(Object.keys(algorithmLabels) as RoutingAlgorithm[]).map((key) => ({ value: key, label: algorithmLabels[key] }))} />
            <SelectBox label="Source" value={source} onChange={setSource} options={nodes.filter((node) => node.status === "online").map((node) => ({ value: node.id, label: `${node.id} · ${node.label}` }))} />
            <SelectBox label="Destination" value={destination} onChange={setDestination} options={nodes.filter((node) => node.status === "online").map((node) => ({ value: node.id, label: `${node.id} · ${node.label}` }))} />
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3"><MetricCard label="Current route" value={activePacket.route.length ? activePacket.route.join(" → ") : "Unreachable"} detail={algorithmDescriptions[algorithm]} accent /><MetricCard label="Delivery time" value={latest.lost ? "Dropped" : `${latest.deliveryTime} ms`} detail={`${latest.hops} hops · ${latest.retransmissions} retries`} /><MetricCard label="Run clock" value={`T+${elapsed.toString().padStart(2, "0")}s`} detail={running ? "streaming packets" : "paused"} /></div>
          <div className="mt-5 overflow-hidden rounded-xl border border-cyan-100/10">
            <div className="flex items-center justify-between border-b border-cyan-100/10 bg-slate-950/22 px-3 py-2.5"><div className="flex items-center gap-2"><Send className="h-3.5 w-3.5 text-cyan-200" /><span className="font-mono text-[10px] uppercase tracking-[0.12em] text-cyan-50/58">Packet trace</span></div><span className="font-mono text-[10px] text-orange-200">{packets.length} captured</span></div>
            <div className="thin-scrollbar max-h-[212px] overflow-auto"><table className="w-full min-w-[600px] text-left"><thead className="font-mono text-[9px] uppercase tracking-[.12em] text-cyan-50/34"><tr><th className="px-3 py-2 font-normal">Packet</th><th className="px-3 py-2 font-normal">Path</th><th className="px-3 py-2 font-normal">Latency</th><th className="px-3 py-2 font-normal">Hops</th><th className="px-3 py-2 font-normal">Result</th></tr></thead><tbody>{(packets.length ? packets : [activePacket]).map((packet) => <tr key={packet.id} className="border-t border-cyan-100/6 font-mono text-[10px] text-cyan-50/68"><td className="px-3 py-2.5 text-cyan-100/48">{packet.id}</td><td className="px-3 py-2.5 text-cyan-50/82">{packet.route.length ? packet.route.join("→") : "—"}</td><td className="px-3 py-2.5">{packet.lost ? "—" : `${packet.latency} ms`}</td><td className="px-3 py-2.5">{packet.hops}</td><td className={`px-3 py-2.5 ${packet.lost ? "text-red-200" : "text-emerald-200"}`}>{packet.lost ? "lost" : "delivered"}</td></tr>)}</tbody></table></div>
          </div>
        </div>

        <aside className="border-t border-cyan-100/10 bg-slate-950/16 p-4 xl:border-l xl:border-t-0 xl:p-5">
          <div className="flex items-center justify-between"><div className="flex items-center gap-2"><BarChart3 className="h-4 w-4 text-orange-200" /><div><p className="eyebrow text-[9px] text-cyan-50/42">Experiment comparison</p><p className="mt-0.5 text-sm font-semibold text-white">Algorithm response</p></div></div><span className="rounded border border-cyan-100/10 px-2 py-1 font-mono text-[9px] text-cyan-100/50">16 PKTS</span></div>
          <div className="mt-5 space-y-3">{comparisons.map((comparison) => <ComparisonRow key={comparison.algorithm} comparison={comparison} maxLatency={maxLatency} active={comparison.algorithm === algorithm} />)}</div>
          <div className="mt-5 border-t border-cyan-100/10 pt-4"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><TimerReset className="h-3.5 w-3.5 text-cyan-200" /><span className="font-mono text-[10px] uppercase tracking-[.12em] text-cyan-50/54">Route change log</span></div><span className="font-mono text-[9px] text-cyan-100/34">{filteredLogs.length}/{logs.length}</span></div><label className="relative mt-3 block"><Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-cyan-100/38" /><input aria-label="Search event log" value={logQuery} onChange={(event) => setLogQuery(event.target.value)} placeholder="Search route or event" className="h-8 w-full rounded-lg border border-cyan-100/10 bg-slate-950/30 pl-8 pr-2 text-[11px] text-cyan-50 outline-none placeholder:text-cyan-100/28 focus:border-cyan-300/45" /></label><div className="thin-scrollbar mt-3 max-h-[170px] space-y-2 overflow-auto pr-1">{filteredLogs.length ? filteredLogs.map((log) => <div key={log.id} className="flex gap-2 text-xs leading-5"><span className={`mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full ${log.type === "warning" ? "bg-red-300" : log.type === "route" ? "bg-orange-200" : "bg-cyan-200"}`} /><p className="text-cyan-50/60"><span className="mr-1.5 font-mono text-[9px] text-cyan-100/34">T+{log.time.toString().padStart(2, "0")}</span>{log.text}</p></div>) : <p className="py-2 text-center font-mono text-[10px] text-cyan-100/34">No matching log entries.</p>}</div></div>
        </aside>
      </div>
    </section>
  );
}

function SelectBox({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[] }) {
  return <label className="block"><span className="mb-1.5 block font-mono text-[9px] uppercase tracking-[.12em] text-cyan-50/42">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="h-10 w-full rounded-lg border border-cyan-100/10 bg-slate-950/30 px-3 text-xs text-cyan-50 outline-none transition focus:border-cyan-300/55">{options.map((option) => <option key={option.value} value={option.value} className="bg-slate-900">{option.label}</option>)}</select></label>;
}

function MetricCard({ label, value, detail, accent }: { label: string; value: string; detail: string; accent?: boolean }) {
  return <div className="rounded-xl border border-cyan-100/10 bg-slate-950/25 px-3 py-3"><p className="font-mono text-[9px] uppercase tracking-[.12em] text-cyan-50/38">{label}</p><p className={`mt-1.5 truncate text-sm font-semibold ${accent ? "text-orange-100" : "text-cyan-50"}`}>{value}</p><p className="mt-1 font-mono text-[9px] text-cyan-100/40">{detail}</p></div>;
}

function ComparisonRow({ comparison, maxLatency, active }: { comparison: ComparisonMetric; maxLatency: number; active: boolean }) {
  const width = comparisonBarPercent(comparison.avgLatency, maxLatency);
  return <div className={`rounded-lg px-2 py-1.5 ${active ? "bg-cyan-300/8" : ""}`}><div className="mb-1.5 flex items-center justify-between gap-2"><span className={`text-xs ${active ? "font-semibold text-cyan-100" : "text-cyan-50/65"}`}>{algorithmLabels[comparison.algorithm]}</span><span className="font-mono text-[9px] text-cyan-100/50">{comparison.avgLatency}ms · {comparison.packetLoss}% loss</span></div><div className="h-1.5 overflow-hidden rounded-full bg-cyan-950/80"><div className={`h-full rounded-full ${active ? "bg-orange-300" : "bg-cyan-300/60"}`} style={{ width: `${width}%` }} /></div></div>;
}
