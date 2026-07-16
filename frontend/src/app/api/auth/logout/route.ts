import { NextRequest, NextResponse } from 'next/server';

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

  if (isBypass) {
    response = NextResponse.redirect(postLogoutUrl);
  } else {
    const issuer = process.env.KEYCLOAK_ISSUER_URL ?? process.env.KEYCLOAK_ISSUER;
    const clientId = process.env.KEYCLOAK_CLIENT_ID || 'sder-idr';
    
    if (issuer) {
      const keycloakLogoutUrl = new URL(`${issuer}/protocol/openid-connect/logout`);
      keycloakLogoutUrl.searchParams.set("client_id", clientId);
      
      response = NextResponse.redirect(keycloakLogoutUrl);
    } else {
      response = NextResponse.redirect(postLogoutUrl);
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
    });
  }

  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');

  return response;
}
