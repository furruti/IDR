import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

const publicRoutes = ['/login'];
const authRoutePrefix = '/api/auth';
const nextRoutePrefix = '/_next';

export const proxy = auth((request) => {
  const { nextUrl } = request;
  const isAuthenticated = Boolean(request.auth);
  const isPublicRoute = publicRoutes.includes(nextUrl.pathname);
  const isAllowedWithoutSession =
    isPublicRoute ||
    nextUrl.pathname.startsWith(authRoutePrefix) ||
    nextUrl.pathname.startsWith(nextRoutePrefix) ||
    nextUrl.pathname === '/favicon.ico';

  if (isAuthenticated && isPublicRoute) {
    return NextResponse.redirect(new URL('/', nextUrl));
  }

  if (!isAuthenticated && !isAllowedWithoutSession) {
    const loginUrl = new URL('/login', nextUrl);
    loginUrl.searchParams.set('callbackUrl', `${nextUrl.pathname}${nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
};
