"use client";
import { Tabs } from "@heroui/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
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
  const selected =
    tabs.find((tab) => tab.key === requested)?.key || tabs[0].key;
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">
          {description}
        </p>
      </header>
      <Tabs
        selectedKey={selected}
        onSelectionChange={(key) => {
          const query = new URLSearchParams(params.toString());
          if (key === tabs[0].key) query.delete("bereich");
          else query.set("bereich", String(key));
          router.replace(`${pathname}${query.size ? `?${query}` : ""}`, {
            scroll: false,
          });
        }}
      >
        <Tabs.ListContainer className="mb-6 overflow-x-auto border-b border-border">
          <Tabs.List aria-label={title}>
            {tabs.map((tab) => (
              <Tabs.Tab key={tab.key} id={tab.key}>
                {tab.label}
                <Tabs.Indicator />
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs.ListContainer>
        {tabs.map((tab) => (
          <Tabs.Panel key={tab.key} id={tab.key}>
            {tab.content}
          </Tabs.Panel>
        ))}
      </Tabs>
    </div>
  );
}
