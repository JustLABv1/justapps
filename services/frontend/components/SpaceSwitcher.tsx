"use client";

import { Button, Dropdown, Label, Separator } from "@heroui/react";
import {
  Check,
  ChevronDown,
  Globe2,
  LockKeyhole,
  Plus,
  Settings2,
} from "lucide-react";
import { useRouter } from "next/navigation";

interface SpaceSwitcherProps {
  spaces: { id: string; name: string }[];
  spaceId: string;
  canCreate: boolean;
  onChange: (spaceId: string) => void;
}

export function SpaceSwitcher({
  spaces,
  spaceId,
  canCreate,
  onChange,
}: SpaceSwitcherProps) {
  const router = useRouter();
  const active = spaces.find((space) => space.id === spaceId);
  return (
    <Dropdown>
      <Button
        variant="secondary"
        size="sm"
        aria-label="Space wechseln"
        className="max-w-full justify-between gap-2 sm:max-w-64"
      >
        {spaceId ? (
          <LockKeyhole className="h-4 w-4 shrink-0 text-muted" />
        ) : (
          <Globe2 className="h-4 w-4 shrink-0 text-muted" />
        )}
        <span className="truncate">
          {spaceId ? active?.name || "Privater Space" : "Öffentlicher Katalog"}
        </span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted" />
      </Button>
      <Dropdown.Popover placement="bottom start">
        <Dropdown.Menu
          aria-label="Space auswählen"
          className="min-w-64"
          onAction={(key) => {
            const value = String(key);
            if (value === "manage") router.push("/spaces");
            else if (value === "create")
              router.push(
                `/meine-apps/new?spaceId=${encodeURIComponent(spaceId)}`,
              );
            else onChange(value === "public" ? "" : value.slice(6));
          }}
        >
          <Dropdown.Item id="public" textValue="Öffentlicher Katalog">
            <Globe2 className="h-4 w-4 text-muted" />
            <Label>Öffentlicher Katalog</Label>
            {!spaceId && <Check className="ml-auto h-4 w-4 text-accent" />}
          </Dropdown.Item>
          {spaces.map((space) => (
            <Dropdown.Item
              key={space.id}
              id={`space:${space.id}`}
              textValue={space.name}
            >
              <LockKeyhole className="h-4 w-4 text-muted" />
              <Label className="max-w-52 truncate">{space.name}</Label>
              {space.id === spaceId && (
                <Check className="ml-auto h-4 w-4 text-accent" />
              )}
            </Dropdown.Item>
          ))}
          <Separator />
          {spaceId && canCreate && (
            <Dropdown.Item id="create" textValue="Private App erstellen">
              <Plus className="h-4 w-4 text-muted" />
              <Label>Private App erstellen</Label>
            </Dropdown.Item>
          )}
          <Dropdown.Item id="manage" textValue="Spaces verwalten">
            <Settings2 className="h-4 w-4 text-muted" />
            <Label>Spaces verwalten</Label>
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
