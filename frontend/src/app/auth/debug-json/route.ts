import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    { ok: true, source: "debug-json" },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
        "X-IDR-Origin": "debug-json",
      },
    }
  );
}
