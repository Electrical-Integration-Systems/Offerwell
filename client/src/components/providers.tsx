// components/providers.tsx
"use client";

import { Toast } from "@heroui/react";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* 
        Adăugăm Toast.Provider conform documentației. 
        Este self-closing și se plasează alături de children.
      */}
      <Toast.Provider />
      {children}
    </>
  );
}