import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function GET(request: NextRequest) {
  const isBypass = process.env.NEXT_PUBLIC_BYPASS_AUTH === 'true';
  const appOrigin = (
    process.env.AUTH_URL ||
    process.env.NEXTAUTH_URL ||
    request.nextUrl.origin
  ).replace(/\/$/, '');
  console.log('[Logout] appOrigin:', appOrigin);

  let response: NextResponse;

  const requestCookieNames = request.cookies.getAll().map(cookie => cookie.name);

  console.log(
    '[Logout] Cookies recibidas Auth:',
    requestCookieNames.filter(name =>
      name.includes('authjs') || name.includes('next-auth')
    )
  );

  const authSecret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;

  const token =
    await getToken({
      req: request,
      secret: authSecret,
      secureCookie: true,
      cookieName: '__Secure-authjs.session-token',
    }) ??
    await getToken({
      req: request,
      secret: authSecret,
      secureCookie: true,
      cookieName: 'authjs.session-token',
    }) ??
    await getToken({
      req: request,
      secret: authSecret,
      secureCookie: true,
      cookieName: '__Host-authjs.session-token',
    }) ??
    await getToken({
      req: request,
      secret: authSecret,
      secureCookie: true,
      cookieName: '__Secure-next-auth.session-token',
    }) ??
    await getToken({
      req: request,
      secret: authSecret,
      secureCookie: true,
      cookieName: 'next-auth.session-token',
    });

  console.log('[Logout] JWT encontrado:', Boolean(token));
  console.log('[Logout] JWT keys:', token ? Object.keys(token) : []);

  if (isBypass) {
    const fallbackUrl = `${appOrigin}/auth/sso`;
    const encodedTarget = Buffer.from(fallbackUrl, 'utf8').toString('base64');
    response = NextResponse.json({ ok: true, redirectB64: encodedTarget }, { status: 200 });
  } else {
    const issuer = process.env.KEYCLOAK_ISSUER_URL ?? process.env.KEYCLOAK_ISSUER;
    const clientId = process.env.KEYCLOAK_CLIENT_ID || 'sder-idr';
    
    if (issuer) {
      const keycloakLogoutUrl = new URL(`${issuer}/protocol/openid-connect/logout`);
      keycloakLogoutUrl.searchParams.set("client_id", clientId);

      const encodedTarget = Buffer.from(keycloakLogoutUrl.toString(), 'utf8').toString('base64');

      response = NextResponse.json(
        {
          ok: true,
          redirectB64: encodedTarget,
        },
        {
          status: 200,
        }
      );
    } else {
      const fallbackUrl = `${appOrigin}/auth/sso`;
      const encodedTarget = Buffer.from(fallbackUrl, 'utf8').toString('base64');
      response = NextResponse.json({ ok: true, redirectB64: encodedTarget }, { status: 200 });
    }
  }
  
  // Cookies base mínimas que siempre intentamos borrar
  const minimalBaseCookies = [
    '__Secure-authjs.session-token',
    'authjs.session-token',
    '__Host-authjs.session-token',
    '__Host-authjs.csrf-token',
    '__Secure-authjs.callback-url',
  ];

  // Prefijos para detectar dinámicamente cookies auth presentes en el request
  const authCookiePrefixes = [
    'authjs.',
    '__Secure-authjs.',
    '__Host-authjs.',
    'next-auth.',
    '__Secure-next-auth.',
    '__Host-next-auth.',
  ];

  // Detectar solo las cookies auth que realmente vinieron en el request
  const detectedAuthCookies = request.cookies
    .getAll()
    .filter(cookie =>
      authCookiePrefixes.some(prefix => cookie.name.startsWith(prefix))
    )
    .map(cookie => cookie.name);

  // Unir base mínima + detectadas (sin duplicados)
  const cookiesToDelete = new Set([
    ...minimalBaseCookies,
    ...detectedAuthCookies,
  ]);

  console.log('[Logout] Cookies eliminadas count:', cookiesToDelete.size);
  console.log('[Logout] Cookies eliminadas:', Array.from(cookiesToDelete));

  for (const cookieName of cookiesToDelete) {
    response.cookies.set({
      name: cookieName,
      value: '',
      path: '/',
      maxAge: 0,
      expires: new Date(0),
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
    });
  }

  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');

  return response;
}
