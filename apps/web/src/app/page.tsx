"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { fieldAt } from "@/lib/field";
import type { SearchResponse } from "@/lib/types";

type Masked = { id: string; x: number; y: number; weight: number };

type ResolveData = {
  picked: {
    id: string;
    name: string;
    address: string;
    lat: number;
    lng: number;
    mapsUrl: string;
  };
  distanceMeters: number;
};

const PRESETS = ["Brisket", "Breakfast", "Climbing", "Muay Thai", "Coffee", "Date Night"];

type Stage = "intro" | "intent" | "journey";

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [stage, setStage] = useState<Stage>("intro");
  const [query, setQuery] = useState("Breakfast");
  const [sessionId, setSessionId] = useState("");
  const [points, setPoints] = useState<Masked[]>([]);
  const [selected, setSelected] = useState<ResolveData | null>(null);
  const [pendingReveal, setPendingReveal] = useState(false);
  const [hint, setHint] = useState("Move slowly. Listen to your body.");
  const [isRevealing, setIsRevealing] = useState(false);
  const [waitlistEmail, setWaitlistEmail] = useState("");
  const [waitlistState, setWaitlistState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [showWaitlistModal, setShowWaitlistModal] = useState(false);
  const [bridgeConnected, setBridgeConnected] = useState(false);
  const [introMouse, setIntroMouse] = useState({ x: 50, y: 50 });
  const [ritualPulse, setRitualPulse] = useState(false);
  const [hoveringHotspot, setHoveringHotspot] = useState(false);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const journeyMouseRef = useRef({ x: 0.5, y: 0.5 });
  const bridgeRef = useRef<WebSocket | null>(null);

  const canFeel = useMemo(() => typeof navigator !== "undefined" && "vibrate" in navigator, []);

  async function startSearch(nextQuery?: string) {
    setSelected(null);
    setPendingReveal(false);
    const effectiveQuery = nextQuery ?? query;
    const res = await fetch("/api/search", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        query: effectiveQuery,
        center: { lat: 41.8857, lng: -87.6472 },
        radiusMeters: 3000,
        limit: 34,
      }),
    });
    const data = (await res.json()) as SearchResponse;
    setSessionId(data.sessionId);
    setPoints(data.candidatesMasked);
  }

  async function resolveTap(x: number, y: number) {
    if (!sessionId) return;
    setIsRevealing(true);
    const res = await fetch("/api/resolve", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId, tap: { x, y } }),
    });
    if (!res.ok) {
      setIsRevealing(false);
      return;
    }
    const data = (await res.json()) as ResolveData;

    setTimeout(() => {
      setSelected(data);
      setPendingReveal(true);
      setIsRevealing(false);
      playRevealTone();
      const rnwv = (window as typeof window & { ReactNativeWebView?: { postMessage: (s: string) => void } }).ReactNativeWebView;
      rnwv?.postMessage?.(JSON.stringify({ type: "reveal" }));
    }, 500);
  }

  async function joinWaitlist(e: React.FormEvent) {
    e.preventDefault();
    if (!waitlistEmail.trim()) return;
    setWaitlistState("loading");
    const res = await fetch("/api/waitlist", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: waitlistEmail.trim() }),
    });
    setWaitlistState(res.ok ? "done" : "error");
    if (res.ok) setWaitlistEmail("");
  }

  function playRevealTone() {
    if (typeof window === "undefined") return;
    const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const o1 = ctx.createOscillator();
    const o2 = ctx.createOscillator();
    const gain = ctx.createGain();

    o1.type = "sine";
    o2.type = "triangle";
    o1.frequency.value = 196;
    o2.frequency.value = 329.6;

    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.45);

    o1.connect(gain);
    o2.connect(gain);
    gain.connect(ctx.destination);

    o1.start();
    o2.start();
    o1.stop(ctx.currentTime + 0.46);
    o2.stop(ctx.currentTime + 0.46);
  }

  useEffect(() => {
    if (stage === "journey") void startSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const ws = new WebSocket("ws://127.0.0.1:8787");
    bridgeRef.current = ws;
    ws.onopen = () => setBridgeConnected(true);
    ws.onerror = () => setBridgeConnected(false);
    ws.onclose = () => setBridgeConnected(false);
    return () => {
      ws.close();
      bridgeRef.current = null;
      setBridgeConnected(false);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || points.length === 0 || stage !== "journey") return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    const baseLayer = document.createElement("canvas");
    baseLayer.width = width;
    baseLayer.height = height;
    const bctx = baseLayer.getContext("2d");
    if (!bctx) return;

    const img = bctx.createImageData(width, height);
    for (let py = 0; py < height; py++) {
      for (let px = 0; px < width; px++) {
        const nx = px / width;
        const ny = py / height;
        const base = fieldAt(nx, ny, points) * 255;
        const ridge = Math.sin((nx * 18 + ny * 8) * Math.PI) * 10;
        const contour = Math.sin((nx * 42 - ny * 16) * Math.PI) * 4;
        const v = Math.max(8, Math.min(245, base + 22 + ridge + contour));
        const idx = (py * width + px) * 4;
        img.data[idx] = v * 0.43;
        img.data[idx + 1] = v * 0.62;
        img.data[idx + 2] = v;
        img.data[idx + 3] = 255;
      }
    }
    bctx.putImageData(img, 0, 0);

    let raf = 0;
    const draw = (t: number) => {
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(baseLayer, 0, 0);

      // drifting hash texture
      ctx.strokeStyle = "rgba(180,190,255,0.12)";
      ctx.lineWidth = 1;
      for (let i = 0; i < 140; i++) {
        const x = ((i * 73 + t * 0.02) % (width + 120)) - 60;
        const y = (i * 41 + Math.sin(t * 0.0007 + i) * 80) % height;
        const len = 8 + ((i * 13) % 12);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + len, y + len * 0.35);
        ctx.stroke();
      }

      // liftable hotspots
      const mx = journeyMouseRef.current.x * width;
      const my = journeyMouseRef.current.y * height;
      for (const p of points) {
        const px = p.x * width;
        const py = p.y * height + Math.sin(t * 0.0015 + p.x * 10) * 5;
        const dist = Math.hypot(mx - px, my - py);
        const lift = Math.max(0, 1 - dist / 120);
        const r = 6 + p.weight * 7 + lift * 8;

        ctx.shadowBlur = 24 * lift;
        ctx.shadowColor = "rgba(150,170,255,0.9)";
        ctx.fillStyle = `rgba(${130 + lift * 90}, ${150 + lift * 70}, 255, ${0.2 + lift * 0.55})`;
        ctx.beginPath();
        ctx.arc(px, py - lift * 16, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [points, stage]);

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (points.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    journeyMouseRef.current = { x, y };
    const intensity = fieldAt(x, y, points);

    const nearestDist = Math.min(
      ...points.map((p) => Math.hypot(x - p.x, y - p.y)),
    );
    const hovering = nearestDist < 0.04;
    setHoveringHotspot(hovering);
    setHint(hovering ? "You can feel it lifting... click to lock it." : intensity > 0.7 ? "There. Stay with that feeling." : "Keep drifting.");

    if (canFeel && intensity > 0.12) {
      const duration = Math.floor(8 + intensity * 26);
      navigator.vibrate(duration);
    }

    const payload = {
      type: "haptic.update",
      intensity,
      pulseHz: 2.5 + intensity * 8.5,
      texture: intensity > 0.65 ? "dense" : "grain",
    };

    const ws = bridgeRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload));

    const rnwv = (window as typeof window & { ReactNativeWebView?: { postMessage: (s: string) => void } }).ReactNativeWebView;
    if (rnwv?.postMessage) rnwv.postMessage(JSON.stringify(payload));
  }

  function onClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    void resolveTap(x, y);
  }

  if (stage === "intro") {
    return (
      <main
        className="min-h-screen bg-[#030712] text-zinc-100 grid place-items-center p-6 overflow-hidden relative"
        onMouseMove={(e) => {
          const target = e.currentTarget.getBoundingClientRect();
          setIntroMouse({
            x: ((e.clientX - target.left) / target.width) * 100,
            y: ((e.clientY - target.top) / target.height) * 100,
          });
        }}
      >
        <div
          className="pointer-events-none absolute inset-0 transition-all duration-200"
          style={{
            background: `radial-gradient(520px circle at ${introMouse.x}% ${introMouse.y}%, rgba(125,211,252,0.22), rgba(6,8,18,0) 58%)`,
          }}
        />
        <div className="pointer-events-none absolute inset-0 opacity-80" style={{ background: "radial-gradient(1200px 520px at 50% 120%, rgba(103,232,249,0.25), rgba(6,8,18,0) 65%)" }} />
        <div className="pointer-events-none absolute -top-24 left-[-8%] h-[34rem] w-[34rem] rounded-full bg-cyan-300/12 blur-3xl" style={{ animation: "floatA 14s ease-in-out infinite" }} />
        <div className="pointer-events-none absolute -bottom-24 right-[-10%] h-[38rem] w-[38rem] rounded-full bg-blue-300/12 blur-3xl" style={{ animation: "floatB 18s ease-in-out infinite" }} />
        <div className="pointer-events-none absolute inset-0" style={{ backgroundImage: "linear-gradient(180deg, rgba(186,230,253,0.06), transparent 24%, transparent 76%, rgba(186,230,253,0.08))" }} />

        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-48" style={{ background: "linear-gradient(0deg, rgba(103,232,249,0.14), rgba(103,232,249,0))" }} />

        <section className="relative z-10 w-full max-w-3xl text-center animate-in fade-in duration-700">
          <p className="text-xs uppercase tracking-[0.35em] text-cyan-200/90">Sensa</p>
          <h1 className="mt-6 text-5xl md:text-7xl font-semibold leading-[1.05] text-zinc-100" style={{ fontFamily: "var(--font-display-serif)" }}>
            Follow what pulls you.
          </h1>
          <p className="mt-6 text-zinc-200/90 text-lg md:text-xl leading-relaxed">
            A quieter way to choose what comes next — guided by sensation instead of feeds, scores, and noise.
          </p>
          <div className="mt-10 flex items-center justify-center">
            <button
              onClick={() => {
                setRitualPulse(true);
                setTimeout(() => setRitualPulse(false), 220);
                setStage("intent");
              }}
              className={`rounded-full bg-cyan-300/90 hover:bg-cyan-200 text-slate-900 px-8 py-3 font-semibold transition active:scale-95 ${
                ritualPulse ? "scale-105 shadow-[0_0_45px_rgba(103,232,249,0.55)]" : "shadow-[0_0_26px_rgba(103,232,249,0.35)]"
              }`}
            >
              Enter the water
            </button>
          </div>
        </section>
      </main>
    );
  }

  if (stage === "intent") {
    return (
      <main className="min-h-screen bg-[#05060a] text-zinc-100 grid place-items-center p-6 overflow-hidden relative">
        <div className="pointer-events-none absolute -top-10 left-10 h-72 w-72 rounded-full bg-teal-300/10 blur-3xl" style={{ animation: "floatA 10s ease-in-out infinite" }} />
        <div className="pointer-events-none absolute bottom-0 right-0 h-80 w-80 rounded-full bg-indigo-300/10 blur-3xl" style={{ animation: "floatB 14s ease-in-out infinite" }} />
        <section className="relative w-full max-w-4xl rounded-3xl border border-white/10 bg-[#0a0d19]/90 p-8 md:p-10 animate-in fade-in duration-700">
          <p className="text-xs uppercase tracking-[0.25em] text-indigo-300">Set your intention</p>
          <h2 className="mt-3 text-3xl font-semibold" style={{ fontFamily: "var(--font-display-serif)" }}>What are you seeking tonight?</h2>

          <div className="mt-6 flex flex-wrap gap-2">
            {PRESETS.map((preset) => (
              <button
                key={preset}
                onClick={() => {
                  setQuery(preset);
                  setShowCustomInput(false);
                }}
                className={`rounded-full px-4 py-2 text-sm border transition ${
                  query.toLowerCase() === preset.toLowerCase() && !showCustomInput
                    ? "border-indigo-400 bg-indigo-500/20 text-indigo-200"
                    : "border-zinc-700 bg-zinc-900/70 text-zinc-300 hover:border-zinc-500"
                }`}
              >
                {preset}
              </button>
            ))}
            <button
              onClick={() => setShowCustomInput((v) => !v)}
              className={`rounded-full px-4 py-2 text-sm border transition ${
                showCustomInput
                  ? "border-fuchsia-300 bg-fuchsia-500/20 text-fuchsia-100"
                  : "border-fuchsia-400/60 bg-fuchsia-500/10 text-fuchsia-200 hover:bg-fuchsia-500/20"
              }`}
            >
              {showCustomInput ? "Hide custom" : "Enter your own"}
            </button>
          </div>

          {showCustomInput && (
            <input
              className="mt-4 w-full rounded-xl border border-fuchsia-400/40 bg-zinc-900 px-4 py-3 outline-none"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type your own intention..."
              autoFocus
            />
          )}

          <div className="mt-6 flex gap-3">
            <button
              className="rounded-xl bg-indigo-500 hover:bg-indigo-400 px-5 py-3 font-medium"
              onClick={async () => {
                await startSearch();
                setStage("journey");
              }}
            >
              Enter the field
            </button>
            <button className="rounded-xl border border-zinc-700 px-5 py-3" onClick={() => setStage("intro")}>
              Back
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#05060a] text-zinc-100 p-4 md:p-6">
      <div className="relative mx-auto max-w-7xl h-[94vh] rounded-2xl border border-white/10 overflow-hidden">
        <canvas
          ref={canvasRef}
          width={1600}
          height={980}
          onPointerMove={onPointerMove}
          onClick={onClick}
          className={`w-full h-full ${hoveringHotspot ? "cursor-grab" : "cursor-crosshair"}`}
        />

        <div className="absolute left-4 top-4 rounded-full border border-white/20 bg-black/40 px-3 py-1 text-xs tracking-widest uppercase">
          Journey Mode · {query}
        </div>
        <div className="absolute right-4 top-4 rounded-full border border-white/20 bg-black/40 px-3 py-1 text-xs">
          Bridge: {bridgeConnected ? "Connected" : "Not Connected"}
        </div>

        <div className="absolute left-4 bottom-4 right-4 md:right-auto md:w-[560px] rounded-2xl border border-white/15 bg-black/45 backdrop-blur-sm p-4 space-y-3">
          <p className="text-sm text-zinc-300">{hint}</p>
          {!pendingReveal ? (
            <p className="text-xs text-zinc-400">Move over the map, click where it feels strongest.</p>
          ) : (
            <button
              className="rounded-xl bg-indigo-500 hover:bg-indigo-400 px-5 py-3 font-medium"
              onClick={() => {
                setShowWaitlistModal(true);
              }}
            >
              Press Reveal
            </button>
          )}

          {selected && (
            <div className="rounded-xl border border-emerald-700/40 bg-emerald-950/30 p-3">
              <p className="text-xs uppercase tracking-wider text-emerald-300">Your signal</p>
              <h2 className="text-lg font-semibold">{selected.picked.name}</h2>
              <p className="text-zinc-300 text-sm">{selected.picked.address}</p>
              <a className="text-indigo-300 underline text-sm" href={selected.picked.mapsUrl} target="_blank">
                Open in Google Maps
              </a>
            </div>
          )}
        </div>

        {isRevealing && (
          <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px] grid place-items-center animate-pulse">
            <p className="tracking-[0.2em] uppercase text-sm">Listening for your signal...</p>
          </div>
        )}
      </div>

      {showWaitlistModal && (
        <div className="fixed inset-0 bg-black/60 grid place-items-center p-4">
          <div className="w-full max-w-lg rounded-2xl border border-white/15 bg-[#0d1120] p-6">
            <p className="text-xs uppercase tracking-[0.2em] text-indigo-300">Join the full journey</p>
            <h3 className="mt-2 text-2xl font-semibold">Get early access to global Sensa</h3>
            <p className="mt-2 text-zinc-300 text-sm">You felt one signal. Next, unlock the world.</p>

            <form onSubmit={joinWaitlist} className="mt-4 space-y-3">
              <input
                type="email"
                required
                value={waitlistEmail}
                onChange={(e) => setWaitlistEmail(e.target.value)}
                placeholder="you@email.com"
                className="w-full rounded-xl border border-white/15 bg-black/30 px-4 py-3 outline-none"
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={waitlistState === "loading"}
                  className="rounded-xl bg-indigo-500 hover:bg-indigo-400 disabled:opacity-70 px-4 py-2"
                >
                  {waitlistState === "loading" ? "Joining..." : "Join waitlist"}
                </button>
                <button
                  type="button"
                  className="rounded-xl border border-zinc-700 px-4 py-2"
                  onClick={() => setShowWaitlistModal(false)}
                >
                  Close
                </button>
              </div>
            </form>

            {waitlistState === "done" && <p className="mt-2 text-emerald-300 text-sm">You’re on the list.</p>}
            {waitlistState === "error" && <p className="mt-2 text-rose-300 text-sm">Couldn’t save that email. Try again.</p>}
          </div>
        </div>
      )}
    </main>
  );
}
