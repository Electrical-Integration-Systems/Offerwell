"use client";

import { motion, useMotionValue, useSpring, useTransform } from "motion/react";
import { useRef, useSyncExternalStore, type ReactNode } from "react";
import { Zap, Lightbulb, Flame, Plug, Camera, Server, Shield } from "lucide-react";

export type FacetCategory = {
  id: string;
  label: string;
  query: string;
  rotate: number;
  icon: ReactNode;
};

// Fațete actualizate pentru a acoperi și curenții slabi / IT / Securitate
export const FACETS: FacetCategory[] = [
  { id: "cabluri", label: "Cabluri", query: "cablu", rotate: -8, icon: <Zap className="size-5 text-yellow-500" /> },
  { id: "iluminat", label: "Iluminat", query: "iluminat", rotate: 6, icon: <Lightbulb className="size-5 text-orange-400" /> },
  { id: "incendiu", label: "Incendiu", query: "incendiu", rotate: -4, icon: <Flame className="size-5 text-red-500" /> },
  { id: "securitate", label: "Securitate", query: "video", rotate: 7, icon: <Camera className="size-5 text-blue-600" /> },
  { id: "retea", label: "Rețelistică", query: "rack", rotate: -6, icon: <Server className="size-5 text-indigo-500" /> },
  { id: "aparataj", label: "Aparataj", query: "priză", rotate: 5, icon: <Plug className="size-5 text-teal-500" /> },
  { id: "impamantare", label: "Împământ.", query: "platbanda", rotate: -5, icon: <Shield className="size-5 text-green-600" /> },
];

const EASE = [0.22, 1, 0.36, 1] as const;

function PolaroidCard({
  facet,
  index,
  onSelect
}: {
  facet: FacetCategory;
  index: number;
  onSelect: (query: string) => void;
}): ReactNode {
  const ref = useRef<HTMLDivElement | null>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 220, damping: 18, mass: 0.6 });
  const sy = useSpring(my, { stiffness: 220, damping: 18, mass: 0.6 });
  const tx = useTransform(sx, (v) => `${v}px`);
  const ty = useTransform(sy, (v) => `${v}px`);

  const handleMove = (e: React.PointerEvent<HTMLDivElement>): void => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    const max = 18;
    const k = 0.25;
    mx.set(Math.max(-max, Math.min(max, dx * k)));
    my.set(Math.max(-max, Math.min(max, dy * k)));
  };

  const handleLeave = (): void => {
    mx.set(0);
    my.set(0);
  };

  return (
    <motion.div
      ref={ref}
      onPointerMove={handleMove}
      onPointerLeave={handleLeave}
      onClick={() => onSelect(facet.query)}
      initial={{ opacity: 0, y: -120, filter: "blur(18px)", rotate: facet.rotate }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)", rotate: facet.rotate }}
      transition={{
        duration: 0.9,
        delay: 0.05 + index * 0.08,
        ease: EASE,
      }}
      style={{ x: tx, y: ty, rotate: facet.rotate }}
      // Lățime adaptată (5.5rem) pentru a încapea textul
      className="relative flex flex-col aspect-[3.5/4] w-[clamp(4.5rem,4.5vw,4.5rem)] shrink-0 overflow-hidden rounded-xl border border-neutral-200/60 shadow-sm bg-white p-1.5 dark:border-white/15 dark:bg-neutral-900 cursor-pointer hover:shadow-md transition-shadow"
    >
      <div className="flex-1 w-full bg-neutral-100 dark:bg-neutral-800 rounded-sm flex items-center justify-center">
         {facet.icon}
      </div>
      <div className="mt-1.5 text-[0.65rem] sm:text-[0.7rem] font-bold text-center text-neutral-700 dark:text-neutral-300 truncate">
         {facet.label}
      </div>
    </motion.div>
  );
}

export function PolaroidStrip({ onSelect }: { onSelect: (query: string) => void }): ReactNode {
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  if (!mounted) {
    return <div aria-hidden="true" className="h-[clamp(4.55rem,4.5vw,4.55rem)] w-full" />;
  }

  return (
    <div className="flex flex-wrap w-full items-start gap-1 px-4 sm:gap-2 sm:px-8 justify-end">
      {FACETS.map((facet, i) => (
        <PolaroidCard key={facet.id} facet={facet} index={i} onSelect={onSelect} />
      ))}
    </div>
  );
}
