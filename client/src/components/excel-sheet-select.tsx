"use client";

import { Select, ListBox } from "@heroui/react";
import { Check, Sheet } from "lucide-react";

export default function ExcelSheetSelect({ sheets, value, disabled, onChange }: {
  sheets: string[];
  value?: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return <Select aria-label="Foaie de calcul" value={value} onChange={(key: unknown) => { if (typeof key === "string") onChange(key); }} isDisabled={disabled} className="w-full min-w-48 sm:w-64">
    <Select.Trigger className="flex w-full items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm shadow-sm hover:bg-secondary focus-visible:outline-2 focus-visible:outline-ring">
      <Sheet className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <Select.Value className="min-w-0 flex-1 truncate text-left" />
      <Select.Indicator />
    </Select.Trigger>
    <Select.Popover placement="bottom start" className="z-50 min-w-[var(--trigger-width)] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-border bg-background p-1 text-foreground shadow-xl">
      <ListBox aria-label="Foi de calcul" className="max-h-72 overflow-y-auto outline-none">
        {sheets.map((name) => <ListBox.Item key={name} id={name} textValue={name}
          className="flex cursor-pointer items-center justify-between gap-4 rounded-lg px-3 py-2.5 text-sm outline-none data-[focused]:bg-secondary data-[hovered]:bg-secondary data-[selected]:bg-secondary data-[selected]:font-semibold">
          <span className="min-w-0 break-words">{name}</span>
          <ListBox.ItemIndicator><Check className="size-4 shrink-0" aria-hidden="true" /></ListBox.ItemIndicator>
        </ListBox.Item>)}
      </ListBox>
    </Select.Popover>
  </Select>;
}
