import { WebSocketServer } from "ws";

const PORT = Number(process.env.SENSA_BRIDGE_PORT || 8787);
const wss = new WebSocketServer({ port: PORT });

console.log(`[sensa-bridge] listening on ws://127.0.0.1:${PORT}`);

wss.on("connection", (socket) => {
  socket.send(JSON.stringify({ ok: true, type: "bridge.ready" }));

  socket.on("message", (raw) => {
    try {
      const msg = JSON.parse(String(raw));
      if (msg.type !== "haptic.update") return;

      const intensity = Math.max(0, Math.min(1, Number(msg.intensity ?? 0)));
      const pulseHz = Number(msg.pulseHz ?? 6);
      const texture = String(msg.texture ?? "grain");

      // Placeholder device bridge: replace with Logitech SDK / HID integration.
      // For now we log the mapped values and acknowledge.
      console.log(`[haptic] intensity=${intensity.toFixed(2)} pulseHz=${pulseHz.toFixed(1)} texture=${texture}`);

      socket.send(
        JSON.stringify({
          ok: true,
          type: "haptic.ack",
          applied: { intensity, pulseHz, texture },
          ts: Date.now(),
        }),
      );
    } catch (error) {
      socket.send(JSON.stringify({ ok: false, error: String(error) }));
    }
  });
});
