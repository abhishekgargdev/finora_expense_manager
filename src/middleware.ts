import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from './lib/auth';

const protectedPrefixes = [
  '/dashboard',
  '/income',
  '/expenses',
  '/investments',
  '/lending',
  '/credit-cards',
  '/bank-accounts',
  '/import-export',
  '/settings',
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // allow public api auth routes
  if (pathname.startsWith('/api/auth')) return NextResponse.next();

  // redirect /login to dashboard if already authenticated
  if (pathname === '/login') {
    const cookie = req.cookies.get('session')?.value ?? null;
    const payload = await verifySession(cookie);
    if (payload) {
      const url = req.nextUrl.clone();
      url.pathname = '/dashboard';
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // protect paths
  for (const prefix of protectedPrefixes) {
    if (pathname === prefix || pathname.startsWith(prefix + '/')) {
      const cookie = req.cookies.get('session')?.value ?? null;
      const payload = await verifySession(cookie);
      if (!payload) {
        const url = req.nextUrl.clone();
        url.pathname = '/login';
        return NextResponse.redirect(url);
      }
      return NextResponse.next();
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/income/:path*',
    '/expenses/:path*',
    '/investments/:path*',
    '/lending/:path*',
    '/credit-cards/:path*',
    '/bank-accounts/:path*',
    '/import-export/:path*',
    '/settings/:path*',
    '/login',
  ],
};
