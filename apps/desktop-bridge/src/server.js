import { execSync } from "node:child_process";
import { WebSocketServer } from "ws";

const PORT = Number(process.env.SENSA_BRIDGE_PORT || 8787);
const wss = new WebSocketServer({ port: PORT });

function sh(cmd) {
  try {
    return execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}

function scanUsbDevices() {
  const out = sh("lsusb");
  const rows = out.split("\n").filter(Boolean);
  return rows.map((row) => {
    const m = row.match(/ID\s+([0-9a-f]{4}):([0-9a-f]{4})\s+(.+)$/i);
    if (!m) return { raw: row, vendorId: null, productId: null, name: row };
    return {
      raw: row,
      vendorId: m[1].toLowerCase(),
      productId: m[2].toLowerCase(),
      name: m[3],
    };
  });
}

function scanHidraw() {
  const list = sh("ls /dev/hidraw* 2>/dev/null");
  if (!list) return [];
  return list.split("\n").map((dev) => {
    const props = sh(`udevadm info -q property -n ${dev}`);
    return {
      path: dev,
      vendor: (props.match(/ID_VENDOR_FROM_DATABASE=(.*)/)?.[1] || "Unknown").trim(),
      model: (props.match(/ID_MODEL_FROM_DATABASE=(.*)/)?.[1] || "Unknown").trim(),
      props,
    };
  });
}

function detectLogitechCapability() {
  const usb = scanUsbDevices();
  const hidraw = scanHidraw();

  const logitechUsb = usb.filter((d) => d.vendorId === "046d");
  const hasAnyLogitech = logitechUsb.length > 0;

  // IMPORTANT: many mice do not expose programmable haptics on Linux, even when present.
  const supported = false;
  const reason = !hasAnyLogitech
    ? "No Logitech USB device visible to this VM (likely USB passthrough issue)."
    : "Logitech device detected, but programmable haptic API path is not available in this bridge yet.";

  return {
    supported,
    reason,
    usb,
    hidraw,
    logitechUsb,
    ts: Date.now(),
  };
}

let lastScan = detectLogitechCapability();

console.log(`[sensa-bridge] listening on ws://127.0.0.1:${PORT}`);
if (!lastScan.supported) {
  console.log(`[sensa-bridge] haptics unavailable: ${lastScan.reason}`);
}

wss.on("connection", (socket) => {
  socket.send(
    JSON.stringify({
      ok: true,
      type: "bridge.ready",
      haptics: { supported: lastScan.supported, reason: lastScan.reason },
    }),
  );

  socket.on("message", (raw) => {
    try {
      const msg = JSON.parse(String(raw));

      if (msg.type === "bridge.scan") {
        lastScan = detectLogitechCapability();
        socket.send(JSON.stringify({ ok: true, type: "bridge.scan.result", data: lastScan }));
        return;
      }

      if (msg.type === "bridge.status") {
        socket.send(
          JSON.stringify({
            ok: true,
            type: "bridge.status.result",
            haptics: { supported: lastScan.supported, reason: lastScan.reason },
          }),
        );
        return;
      }

      if (msg.type !== "haptic.update") return;

      const intensity = Math.max(0, Math.min(1, Number(msg.intensity ?? 0)));
      const pulseHz = Number(msg.pulseHz ?? 6);
      const texture = String(msg.texture ?? "grain");

      if (!lastScan.supported) {
        socket.send(
          JSON.stringify({
            ok: false,
            type: "haptic.unavailable",
            reason: lastScan.reason,
            applied: { intensity, pulseHz, texture },
          }),
        );
        return;
      }

      // Placeholder for future real device write path.
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
