"use client";

import { Badge } from "@/components/panelui/badge";
import { Button } from "@/components/panelui/button";
import { Menu } from "@/components/panelui/menu";
import {
  ChevronDown,
  Globe2,
  LockKeyhole,
  Plus,
  Settings2,
  UserPlus,
} from "lucide-react";
import { useRouter } from "next/navigation";

interface SpaceSwitcherProps {
  spaces: { id: string; name: string }[];
  spaceId: string;
  invitationCount: number;
  canCreate: boolean;
  onChange: (spaceId: string) => void;
}

export function SpaceSwitcher({
  spaces,
  spaceId,
  invitationCount,
  canCreate,
  onChange,
}: SpaceSwitcherProps) {
  const router = useRouter();
  const active = spaces.find((space) => space.id === spaceId);
  const go = (value: string) => {
    if (value === "manage" || value === "invitations") router.push("/spaces");
    else if (value === "create")
      router.push(`/meine-apps/new?spaceId=${encodeURIComponent(spaceId)}`);
  };
  return (
    <Menu>
      <Menu.Trigger
        render={
          <Button
            variant="outline"
            size="sm"
            aria-label={invitationCount > 0 ? `Space wechseln, ${invitationCount} offene Einladungen` : "Space wechseln"}
            className="max-w-full sm:max-w-64"
          />
        }
      >
        {spaceId ? <LockKeyhole /> : <Globe2 />}
        <span className="truncate">
          {spaceId ? active?.name || "Privater Space" : "Öffentlicher Katalog"}
        </span>
        {invitationCount > 0 && (
          <Badge size="sm" variant="info">
            {invitationCount}
          </Badge>
        )}
        <ChevronDown />
      </Menu.Trigger>
      <Menu.Content aria-label="Space auswählen" className="min-w-64">
        <Menu.Group>
          <Menu.GroupLabel>Katalog</Menu.GroupLabel>
          <Menu.RadioGroup
            value={spaceId}
            onValueChange={(value: string) => {
              if (value !== spaceId) onChange(value);
            }}
          >
            <Menu.RadioItem value="">
              <Globe2 />
              Öffentlicher Katalog
            </Menu.RadioItem>
            {spaces.map((space) => (
              <Menu.RadioItem key={space.id} value={space.id}>
                <LockKeyhole />
                <span className="truncate">{space.name}</span>
              </Menu.RadioItem>
            ))}
          </Menu.RadioGroup>
        </Menu.Group>
        <Menu.Separator />
        {invitationCount > 0 && (
          <Menu.Item onClick={() => go("invitations")}>
            <UserPlus />
            Einladungen
            <Menu.Badge>{invitationCount}</Menu.Badge>
          </Menu.Item>
        )}
        {spaceId && canCreate && (
          <Menu.Item onClick={() => go("create")}>
            <Plus />
            Private App erstellen
          </Menu.Item>
        )}
        <Menu.Item onClick={() => go("manage")}>
          <Settings2 />
          Spaces verwalten
        </Menu.Item>
      </Menu.Content>
    </Menu>
  );
}
