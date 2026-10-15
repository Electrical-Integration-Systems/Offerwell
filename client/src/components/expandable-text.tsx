"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

export default function ExpandableText({ text, children }: { text: string; children?: ReactNode }) {
  const id = useId();
  const content = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);

  useEffect(() => {
    if (expanded || !content.current) return;
    const element = content.current;
    const observer = new ResizeObserver(() => setOverflows(element.scrollHeight > element.clientHeight + 1));
    observer.observe(element);
    return () => observer.disconnect();
  }, [text, expanded]);

  return <div>
    <div ref={content} id={id} className={`break-words whitespace-normal leading-6 ${expanded ? "" : "line-clamp-2"}`}>{children ?? text}</div>
    {overflows && <button type="button" aria-expanded={expanded} aria-controls={id}
      onClick={() => setExpanded((value) => !value)}
      className="mt-1 cursor-pointer rounded text-xs font-medium text-blue-600 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-ring dark:text-blue-400">
      {expanded ? "Restrânge" : "Extinde"}
    </button>}
  </div>;
}
