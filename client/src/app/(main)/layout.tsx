import type { Metadata } from "next";
import Header from "@/components/layout/header";

export const metadata: Metadata = {
  title: "Offerwell",
  description: "",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="min-h-screen bg-background text-foreground [font-family:var(--font-geist-sans)]">
      <Header />
      {children}
    </div>
  );
}
