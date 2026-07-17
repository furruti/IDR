import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function GET(request: NextRequest) {
  const isBypass = process.env.NEXT_PUBLIC_BYPASS_AUTH === 'true';
  const appOrigin = (
    process.env.AUTH_URL ||
    process.env.NEXTAUTH_URL ||
    request.nextUrl.origin
  ).replace(/\/$/, '');
  const postLogoutUrl = `${appOrigin}/auth/reauth`;

  console.log('[Logout] appOrigin:', appOrigin);
  console.log('[Logout] postLogoutUrl:', postLogoutUrl);

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
  console.log('[Logout] id_token_hint presente:', Boolean(token?.idToken));

  const idToken = typeof token?.idToken === 'string' ? token.idToken : undefined;

  if (isBypass) {
    const encodedTarget = Buffer.from(postLogoutUrl, 'utf8').toString('base64');
    response = NextResponse.json({ ok: true, redirectB64: encodedTarget }, { status: 200 });
  } else {
    const issuer = process.env.KEYCLOAK_ISSUER_URL ?? process.env.KEYCLOAK_ISSUER;
    const clientId = process.env.KEYCLOAK_CLIENT_ID || 'sder-idr';
    
    if (issuer) {
      const keycloakLogoutUrl = new URL(`${issuer}/protocol/openid-connect/logout`);
      keycloakLogoutUrl.searchParams.set("client_id", clientId);
      keycloakLogoutUrl.searchParams.set("post_logout_redirect_uri", postLogoutUrl);

      if (idToken) {
        keycloakLogoutUrl.searchParams.set("id_token_hint", idToken);
      }

      console.log('[Logout] id_token_hint presente:', Boolean(idToken));

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
      const encodedTarget = Buffer.from(postLogoutUrl, 'utf8').toString('base64');
      response = NextResponse.json({ ok: true, redirectB64: encodedTarget }, { status: 200 });
    }
  }
  
  const knownAuthCookies = [
    'authjs.session-token',
    '__Secure-authjs.session-token',
    '__Host-authjs.session-token',
    'authjs.csrf-token',
    '__Host-authjs.csrf-token',
    'authjs.callback-url',
    '__Secure-authjs.callback-url',
    'next-auth.session-token',
    '__Secure-next-auth.session-token',
    '__Host-next-auth.session-token',
    'next-auth.csrf-token',
    '__Host-next-auth.csrf-token',
    'next-auth.callback-url',
    '__Secure-next-auth.callback-url',
  ];

  const sessionCookieBases = [
    'authjs.session-token',
    '__Secure-authjs.session-token',
    '__Host-authjs.session-token',
    'next-auth.session-token',
    '__Secure-next-auth.session-token',
    '__Host-next-auth.session-token',
  ];

  const chunkedSessionCookies = sessionCookieBases.flatMap((base) => [
    base,
    ...Array.from({ length: 10 }, (_, index) => `${base}.${index}`),
  ]);

  const authCookiePrefixes = [
    'authjs.',
    '__Secure-authjs.',
    '__Host-authjs.',
    'next-auth.',
    '__Secure-next-auth.',
    '__Host-next-auth.',
  ];

  const detectedAuthCookies = request.cookies
    .getAll()
    .filter(cookie =>
      authCookiePrefixes.some(prefix => cookie.name.startsWith(prefix))
    );

  const cookiesToDelete = new Set([
    ...knownAuthCookies,
    ...chunkedSessionCookies,
    ...detectedAuthCookies.map(cookie => cookie.name)
  ]);

  const deletedCookiesArray = Array.from(cookiesToDelete);

  console.log('[Logout] Cookies eliminadas:', deletedCookiesArray);

  for (const cookieName of deletedCookiesArray) {
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
