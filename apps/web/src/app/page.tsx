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

const PRESETS = ["Brisket", "Breakfast", "Climbing", "Muay Thai"];

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [query, setQuery] = useState("Brisket");
  const [sessionId, setSessionId] = useState("");
  const [points, setPoints] = useState<Masked[]>([]);
  const [selected, setSelected] = useState<ResolveData | null>(null);
  const [hint, setHint] = useState("Move your cursor slowly and feel for stronger pulses.");
  const [isRevealing, setIsRevealing] = useState(false);
  const [waitlistEmail, setWaitlistEmail] = useState("");
  const [waitlistState, setWaitlistState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const bridgeRef = useRef<WebSocket | null>(null);

  const canFeel = useMemo(() => typeof navigator !== "undefined" && "vibrate" in navigator, []);

  async function startSearch(nextQuery?: string) {
    setSelected(null);
    const effectiveQuery = nextQuery ?? query;
    const res = await fetch("/api/search", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        query: effectiveQuery,
        center: { lat: 41.8857, lng: -87.6472 },
        radiusMeters: 2500,
        limit: 32,
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
      setIsRevealing(false);
      playRevealTone();
      const rnwv = (window as typeof window & { ReactNativeWebView?: { postMessage: (s: string) => void } }).ReactNativeWebView;
      rnwv?.postMessage?.(JSON.stringify({ type: "reveal" }));
    }, 450);
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
    o1.frequency.value = 220;
    o2.frequency.value = 330;

    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.09, ctx.currentTime + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);

    o1.connect(gain);
    o2.connect(gain);
    gain.connect(ctx.destination);

    o1.start();
    o2.start();
    o1.stop(ctx.currentTime + 0.36);
    o2.stop(ctx.currentTime + 0.36);
  }

  useEffect(() => {
    void startSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const ws = new WebSocket("ws://127.0.0.1:8787");
    bridgeRef.current = ws;
    ws.onopen = () => {
      // connected to desktop bridge
    };
    ws.onerror = () => {
      // bridge optional; ignore errors
    };
    return () => {
      ws.close();
      bridgeRef.current = null;
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || points.length === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const img = ctx.createImageData(width, height);

    for (let py = 0; py < height; py++) {
      for (let px = 0; px < width; px++) {
        const nx = px / width;
        const ny = py / height;
        const base = fieldAt(nx, ny, points) * 255;
        const noise = (Math.sin(px * 0.09) + Math.cos(py * 0.07)) * 9;
        const ripple = Math.sin((px + py) * 0.02) * 7;
        const v = Math.max(8, Math.min(245, base + 28 + noise + ripple));
        const idx = (py * width + px) * 4;
        img.data[idx] = v * 0.46;
        img.data[idx + 1] = v * 0.63;
        img.data[idx + 2] = v;
        img.data[idx + 3] = 255;
      }
    }

    ctx.putImageData(img, 0, 0);
  }, [points]);

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (points.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const intensity = fieldAt(x, y, points);

    setHint(intensity > 0.68 ? "Strong pull here… tap to reveal." : "Scan slowly. Trust your gut.");

    if (canFeel && intensity > 0.14) {
      const duration = Math.floor(8 + intensity * 30);
      navigator.vibrate(duration);
    }

    const payload = {
      type: "haptic.update",
      intensity,
      pulseHz: 3 + intensity * 8,
      texture: intensity > 0.6 ? "dense" : "grain",
    };

    const ws = bridgeRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
    }

    const rnwv = (window as typeof window & { ReactNativeWebView?: { postMessage: (s: string) => void } }).ReactNativeWebView;
    if (rnwv?.postMessage) {
      rnwv.postMessage(JSON.stringify(payload));
    }
  }

  function onClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    void resolveTap(x, y);
  }

  return (
    <main className="min-h-screen bg-[#06070b] text-zinc-100 p-6 md:p-10">
      <div className="mx-auto max-w-5xl space-y-8">
        <section className="rounded-3xl border border-white/10 bg-gradient-to-b from-[#0f1222] to-[#070912] p-6 md:p-9 shadow-[0_0_80px_rgba(99,102,241,0.15)]">
          <p className="text-xs uppercase tracking-[0.22em] text-indigo-300/90">Sensa</p>
          <h1 className="mt-2 text-4xl md:text-5xl font-semibold leading-tight">
            Feel your way to the right place.
          </h1>
          <p className="mt-3 text-zinc-300 max-w-2xl">
            Search for food, climbing, or training. Explore an abstract field around West Loop Chicago.
            Don’t overthink reviews — move, feel, choose.
          </p>

          <form onSubmit={joinWaitlist} className="mt-6 flex flex-col md:flex-row gap-3 max-w-xl">
            <input
              type="email"
              required
              value={waitlistEmail}
              onChange={(e) => setWaitlistEmail(e.target.value)}
              placeholder="you@email.com"
              className="flex-1 rounded-xl border border-white/15 bg-black/30 px-4 py-3 outline-none"
            />
            <button
              type="submit"
              disabled={waitlistState === "loading"}
              className="rounded-xl bg-indigo-500 hover:bg-indigo-400 disabled:opacity-70 px-5 py-3 font-medium"
            >
              {waitlistState === "loading" ? "Joining..." : "Join waitlist"}
            </button>
          </form>
          {waitlistState === "done" && <p className="mt-2 text-emerald-300 text-sm">You’re on the list.</p>}
          {waitlistState === "error" && <p className="mt-2 text-rose-300 text-sm">Couldn’t save that email. Try again.</p>}
        </section>

        <section className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((preset) => (
              <button
                key={preset}
                onClick={() => {
                  setQuery(preset);
                  void startSearch(preset);
                }}
                className={`rounded-full px-4 py-2 text-sm border ${
                  query.toLowerCase() === preset.toLowerCase()
                    ? "border-indigo-400 bg-indigo-500/20 text-indigo-200"
                    : "border-zinc-700 bg-zinc-900/70 text-zinc-300 hover:border-zinc-500"
                }`}
              >
                {preset}
              </button>
            ))}
          </div>

          <div className="flex flex-col md:flex-row gap-3">
            <input
              className="flex-1 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 outline-none"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Try: breakfast, brisket, bouldering, muay thai"
            />
            <button
              className="rounded-xl bg-indigo-500 hover:bg-indigo-400 px-5 py-3 font-medium"
              onClick={() => void startSearch()}
            >
              Regenerate Field
            </button>
          </div>

          <div className="relative">
            <canvas
              ref={canvasRef}
              width={1000}
              height={560}
              onPointerMove={onPointerMove}
              onClick={onClick}
              className="w-full rounded-2xl border border-zinc-700 bg-zinc-900 cursor-crosshair"
            />
            {isRevealing && (
              <div className="absolute inset-0 rounded-2xl bg-black/50 backdrop-blur-[2px] grid place-items-center animate-pulse">
                <p className="text-zinc-200 tracking-widest uppercase text-sm">Revealing signal...</p>
              </div>
            )}
          </div>

          <p className="text-sm text-zinc-400">{hint}</p>

          {selected && (
            <section className="rounded-2xl border border-emerald-700/40 bg-emerald-950/30 p-4 space-y-1">
              <p className="text-xs uppercase tracking-wider text-emerald-300">Your pick</p>
              <h2 className="text-xl font-semibold">{selected.picked.name}</h2>
              <p className="text-zinc-300">{selected.picked.address}</p>
              <p className="text-zinc-400">~{selected.distanceMeters} m from your center point</p>
              <a className="text-indigo-300 underline" href={selected.picked.mapsUrl} target="_blank">
                Open in Google Maps
              </a>
            </section>
          )}
        </section>
      </div>
    </main>
  );
}
