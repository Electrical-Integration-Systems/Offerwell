import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";
import { NextResponse, type NextRequest, type NextFetchEvent } from "next/server";

const isSignInPage = createRouteMatcher(["/auth"]);
const isApiRoute = createRouteMatcher(["/api(.*)", "/trpc(.*)"]);

const authProxy = convexAuthNextjsMiddleware(async (request, { convexAuth }) => {
  const isAuthenticated = await convexAuth.isAuthenticated();

  if (isSignInPage(request)) {
    if (isAuthenticated) {
      return nextjsMiddlewareRedirect(request, "/");
    }
    return;
  }

  if (!isAuthenticated) {
    if (isApiRoute(request)) {
      return NextResponse.json({ error: "Autentificarea este necesara." }, { status: 401 });
    }
    return nextjsMiddlewareRedirect(request, "/auth");
  }
});

export default function proxy(request: NextRequest, event: NextFetchEvent) {
  if (!process.env.NEXT_PUBLIC_CONVEX_URL?.trim()) {
    if (isApiRoute(request)) {
      return NextResponse.json(
        { error: "Autentificarea nu este configurata." },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }
    return new NextResponse("Serviciu temporar indisponibil. Contactati administratorul.", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  }
  return authProxy(request, event);
}

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};