import { NextRequest, NextResponse } from "next/server";
import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const email = String(body?.email || "").trim().toLowerCase();

  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  const dir = path.join(process.cwd(), "data");
  const file = path.join(dir, "waitlist.csv");

  await mkdir(dir, { recursive: true });
  await appendFile(file, `${new Date().toISOString()},${email}\n`, "utf8");

  return NextResponse.json({ ok: true });
}
