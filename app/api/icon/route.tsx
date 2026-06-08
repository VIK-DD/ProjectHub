import { NextResponse } from "next/server";

// Pure SVG icon — no native binaries, works on any platform including Pi.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const size = Math.min(1024, Math.max(32, Number(searchParams.get("size") ?? 512)));
  const r = Math.round(size * 0.22);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  <rect width="${size}" height="${size}" rx="${r}" fill="#6d5ef0"/>
  <text x="${size / 2}" y="${Math.round(size * 0.72)}" font-family="system-ui,sans-serif" font-size="${Math.round(size * 0.58)}" font-weight="700" text-anchor="middle" fill="white">P</text>
</svg>`;

  return new NextResponse(svg, {
    headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=86400" },
  });
}
