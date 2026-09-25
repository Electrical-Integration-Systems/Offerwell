// components/providers.tsx
"use client";

import { Toast } from "@heroui/react";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Toast.Provider />
      {children}
    </>
  );
}