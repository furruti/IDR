import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

const authRoutePrefix = '/api/auth';
const nextRoutePrefix = '/_next';
const ssoRoute = '/auth/sso';
const publicFiles = new Set(['/favicon.ico']);
const publicFilePattern = /\.(?:avif|css|gif|ico|jpg|jpeg|js|map|png|svg|txt|webmanifest|webp|woff|woff2)$/i;

export const proxy = auth((request) => {
  const { nextUrl } = request;
  const isAuthenticated = Boolean(request.auth);
  const isAllowedWithoutSession =
    nextUrl.pathname.startsWith(authRoutePrefix) ||
    nextUrl.pathname.startsWith(nextRoutePrefix) ||
    nextUrl.pathname === ssoRoute ||
    nextUrl.pathname === '/auth/reauth' ||
    publicFiles.has(nextUrl.pathname) ||
    publicFilePattern.test(nextUrl.pathname);

  if (!isAuthenticated && !isAllowedWithoutSession) {
    const ssoUrl = new URL(ssoRoute, nextUrl);
    ssoUrl.searchParams.set('callbackUrl', `${nextUrl.pathname}${nextUrl.search}`);
    return NextResponse.redirect(ssoUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!.*\\.(?:avif|css|gif|ico|jpg|jpeg|js|map|png|svg|txt|webmanifest|webp|woff|woff2)$).*)'],
};
