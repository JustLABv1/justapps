"use client";

import {
  APP_STATUS_OPTIONS,
  DRAFT_STATUS,
  getAppStatusLabel,
} from "@/lib/appStatus";
import { Label, Radio, RadioGroup, Surface } from "@heroui/react";

interface EditorStatusPickerProps {
  isDisabled?: boolean;
  onChange: (status: string) => void;
  value?: string;
}

export function EditorStatusPicker({
  isDisabled = false,
  onChange,
  value,
}: EditorStatusPickerProps) {
  const currentValue = value?.trim() || DRAFT_STATUS;
  const canonicalValue = getAppStatusLabel(currentValue) || currentValue;
  const hasKnownStatus = APP_STATUS_OPTIONS.includes(
    canonicalValue as (typeof APP_STATUS_OPTIONS)[number],
  );
  const options = hasKnownStatus
    ? APP_STATUS_OPTIONS
    : [...APP_STATUS_OPTIONS, currentValue];

  return (
    <Surface
      variant="default"
      className="rounded-2xl border border-border p-4 shadow-sm"
    >
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted/70">
            Arbeitsstand
          </p>
          <h2 className="mt-1 text-sm font-semibold text-foreground">
            Status der App
          </h2>
        </div>
        <p className="text-xs text-muted">
          Für einen Status außerhalb von Entwurf sind Kategorie und
          Kurzbeschreibung erforderlich.
        </p>
      </div>

      <RadioGroup
        aria-label="Status der App"
        className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6"
        isDisabled={isDisabled}
        onChange={onChange}
        orientation="horizontal"
        value={canonicalValue}
        variant="secondary"
      >
        {options.map((status) => {
          const isCustomStatus = !APP_STATUS_OPTIONS.includes(
            status as (typeof APP_STATUS_OPTIONS)[number],
          );
          const label = isCustomStatus
            ? `Bestehend: ${status}`
            : getAppStatusLabel(status) || status;

          return (
            <Radio
              key={status}
              value={status}
              className="group min-w-0 cursor-pointer rounded-xl border border-border bg-surface px-3 py-2 text-sm transition-[border-color,background-color,transform] duration-150 ease-out hover:border-accent/50 data-[selected=true]:border-accent data-[selected=true]:bg-accent/10 data-[selected=true]:text-foreground data-[disabled=true]:cursor-not-allowed"
            >
              <Radio.Control className="border-border group-data-[selected=true]:border-accent group-data-[selected=true]:bg-accent">
                <Radio.Indicator />
              </Radio.Control>
              <Radio.Content className="min-w-0">
                <Label className="truncate text-xs font-semibold">
                  {label}
                </Label>
              </Radio.Content>
            </Radio>
          );
        })}
      </RadioGroup>
    </Surface>
  );
}
