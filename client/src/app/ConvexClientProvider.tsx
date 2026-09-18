"use client";
 
import { ConvexAuthNextjsProvider } from "@convex-dev/auth/nextjs";
import { ConvexReactClient } from "convex/react";
import { ReactNode } from "react";
 
const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL?.trim();
const convex = convexUrl ? new ConvexReactClient(convexUrl) : null;
 
export function ConvexClientProvider({ children }: { children: ReactNode }) {
  if (!convex) {
    return (
      <main role="alert" className="mx-auto my-auto w-full max-w-sm px-4 py-10 text-center">
        <h1 className="mb-3 text-xl font-semibold">Serviciu temporar indisponibil</h1>
        <p>Autentificarea nu este configurata. Contactati administratorul.</p>
      </main>
    );
  }

  return (
    <ConvexAuthNextjsProvider client={convex}>
      {children}
    </ConvexAuthNextjsProvider>
  );
}
