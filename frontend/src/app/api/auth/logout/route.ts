import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const keycloakLogoutUrl = new URL(
    "https://sso-desa.hcdn.gob.ar/realms/hcdn/protocol/openid-connect/logout"
  );

  keycloakLogoutUrl.searchParams.set(
    "client_id",
    process.env.KEYCLOAK_CLIENT_ID || 'sder-idr'
  );

  keycloakLogoutUrl.searchParams.set(
    "post_logout_redirect_uri",
    "https://sder-idr-desa.hcdn.gob.ar/auth/reauth"
  );

  const response = NextResponse.redirect(keycloakLogoutUrl);
  
  const authCookies = [
    'authjs.session-token',
    '__Secure-authjs.session-token',
    'authjs.csrf-token',
    '__Host-authjs.csrf-token',
    'authjs.callback-url',
    '__Secure-authjs.callback-url',
    'next-auth.session-token',
    '__Secure-next-auth.session-token',
    'next-auth.csrf-token',
    '__Host-next-auth.csrf-token',
    'next-auth.callback-url',
    '__Secure-next-auth.callback-url',
  ];

  authCookies.forEach((cookieName) => {
    if (request.cookies.has(cookieName)) {
      response.cookies.delete(cookieName);
      
      response.cookies.set({
        name: cookieName,
        value: '',
        path: '/',
        maxAge: 0,
        expires: new Date(0),
      });
    }
  });

  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');

  return response;
}
