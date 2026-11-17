"use client";

import { Button } from "@/components/panelui/button";
import { Card } from "@/components/panelui/card";
import { Combobox } from "@/components/panelui/combobox";
import { Input } from "@/components/panelui/input";
import { Label } from "@/components/panelui/label";
import type { AppConfig } from "@/config/apps";
import { Plus, Trash2 } from "lucide-react";
import type { ReactNode } from "react";

export type AppDraft = Partial<AppConfig>;
export type UpdateApp = (patch: AppDraft | ((previous: AppDraft) => AppDraft)) => void;

/** One block of a section: a card with a title, an optional line and an action. */
export function EditorCard({
  title,
  description,
  action,
  children,
  footer,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <Card as="section">
      <Card.Header>
        <Card.Title as="h3" className="text-base">{title}</Card.Title>
        {description && <Card.Description>{description}</Card.Description>}
        {action && <Card.Action>{action}</Card.Action>}
      </Card.Header>
      {children && <Card.Content className="flex flex-col gap-5">{children}</Card.Content>}
      {footer && <Card.Footer variant="panel">{footer}</Card.Footer>}
    </Card>
  );
}

/** A switch with its name and a line of help, for a setting inside a card. */
export function SettingRow({ title, description, control }: { title: string; description: ReactNode; control: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-6">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-sm font-medium">{title}</span>
        <span className="text-sm text-muted-foreground">{description}</span>
      </div>
      <div className="shrink-0 pt-0.5">{control}</div>
    </div>
  );
}

/** Free-form values with suggestions: tags, technologies, categories. */
export function ValueListField({
  label,
  values,
  suggestions,
  onChange,
  placeholder,
}: {
  label: string;
  values: string[];
  suggestions: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
}) {
  const options = Array.from(new Set([...suggestions, ...values])).sort((a, b) => a.localeCompare(b, "de"));
  return (
    <Combobox
      mode="multiple"
      value={values}
      onValueChange={(next) => onChange(next.map((value) => value.trim()).filter(Boolean))}
      allowCustomValue
      placeholder={placeholder}
      accessibilityLabel={label}
      emptyMessage="Enter übernimmt den eingegebenen Wert"
    >
      {options.map((option) => (
        <Combobox.Item key={option} value={option} label={option} />
      ))}
    </Combobox>
  );
}

interface LinkItem {
  label: string;
  url: string;
}

/** A list of labelled links that can grow and shrink. */
export function LinkListField({
  title,
  description,
  items,
  onChange,
  labelPlaceholder,
}: {
  title: string;
  description: string;
  items: LinkItem[];
  onChange: (items: LinkItem[]) => void;
  labelPlaceholder: string;
}) {
  const set = (index: number, patch: Partial<LinkItem>) => onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  return (
    <div role="group" aria-label={title} className="flex flex-col gap-3">
      <div className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-0.5">
          <Label>{title}</Label>
          <span className="text-sm text-muted-foreground">{description}</span>
        </div>
        <Button variant="outline" size="sm" onClick={() => onChange([...items, { label: "", url: "" }])}>
          <Plus />
          Hinzufügen
        </Button>
      </div>
      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">Noch keine Einträge.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item, index) => (
            <li key={index} className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)_auto] items-center gap-2">
              <Input
                aria-label={`${title} ${index + 1}: Bezeichnung`}
                value={item.label}
                placeholder={labelPlaceholder}
                onChange={(event) => set(index, { label: event.target.value })}
              />
              <Input
                aria-label={`${title} ${index + 1}: Adresse`}
                type="url"
                inputMode="url"
                className="font-mono"
                value={item.url}
                placeholder="https://…"
                onChange={(event) => set(index, { url: event.target.value })}
              />
              <Button
                variant="ghost"
                size="icon"
                aria-label={`${title} ${index + 1} entfernen`}
                onClick={() => onChange(items.filter((_, i) => i !== index))}
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
