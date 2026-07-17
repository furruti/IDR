import { NextResponse } from "next/server";

const cookiesToExpire = [
  "__Secure-authjs.session-token",
  "__Secure-authjs.session-token.0",
  "__Secure-authjs.session-token.1",
  "__Host-authjs.csrf-token",
  "__Secure-authjs.callback-url",
];

export async function GET() {
  const response = NextResponse.json(
    { ok: true, source: "debug-cookie" },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
        "X-IDR-Origin": "debug-cookie",
      },
    }
  );

  for (const cookieName of cookiesToExpire) {
    response.cookies.set({
      name: cookieName,
      value: "",
      path: "/",
      maxAge: 0,
      expires: new Date(0),
      httpOnly: true,
      secure: true,
      sameSite: "lax",
    });
  }

  return response;
}
