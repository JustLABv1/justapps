"use client";

import { Tabs } from "@/components/panelui/tabs";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";

/** A settings page in sections, the chosen one kept in `?bereich=` so it can be linked to. */
export function AdminSettingsTabs({
  title,
  description,
  tabs,
}: {
  title: string;
  description: string;
  tabs: { key: string; label: string; content: ReactNode }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const requested = params.get("bereich");
  const selected = tabs.find((tab) => tab.key === requested)?.key || tabs[0].key;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        <p className="max-w-3xl text-pretty text-muted-foreground">{description}</p>
      </header>
      <Tabs
        variant="underline"
        value={selected}
        onValueChange={(key) => {
          const query = new URLSearchParams(params.toString());
          if (key === tabs[0].key) query.delete("bereich");
          else query.set("bereich", String(key));
          router.replace(`${pathname}${query.size ? `?${query}` : ""}`, { scroll: false });
        }}
      >
        <Tabs.List aria-label={title}>
          {tabs.map((tab) => (
            <Tabs.Trigger key={tab.key} value={tab.key}>{tab.label}</Tabs.Trigger>
          ))}
        </Tabs.List>
        {tabs.map((tab) => (
          <Tabs.Content key={tab.key} value={tab.key} className="pt-6">
            {tab.content}
          </Tabs.Content>
        ))}
      </Tabs>
    </div>
  );
}
