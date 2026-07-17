import { NextResponse } from "next/server";

export async function GET() {
  const redirectB64 = Buffer.from(
    "https://sso-desa.hcdn.gob.ar/realms/hcdn/protocol/openid-connect/logout?client_id=sder-idr",
    "utf8"
  ).toString("base64");

  return NextResponse.json(
    { ok: true, source: "debug-b64", redirectB64 },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
        "X-IDR-Origin": "debug-b64",
      },
    }
  );
}
