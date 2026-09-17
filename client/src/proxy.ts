import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";
import { NextResponse } from "next/server";

const isSignInPage = createRouteMatcher(["/auth"]);
const isApiRoute = createRouteMatcher(["/api(.*)", "/trpc(.*)"]);

const proxy = convexAuthNextjsMiddleware(async (request, { convexAuth }) => {
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

export default proxy;

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};