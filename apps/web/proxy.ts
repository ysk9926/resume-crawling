import { NextResponse, type NextRequest } from "next/server";

import { isPublicPath, SESSION_COOKIE_NAME } from "@/lib/session";


function isIgnoredPath(pathname: string) {
  return (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    /\.[a-zA-Z0-9]+$/.test(pathname)
  );
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isIgnoredPath(pathname)) {
    return NextResponse.next();
  }

  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const publicPath = isPublicPath(pathname);

  if (!sessionToken && !publicPath) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (sessionToken && (pathname === "/login" || pathname === "/signup")) {
    return NextResponse.redirect(new URL("/calendar", request.url));
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-rw-pathname", pathname);

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}
