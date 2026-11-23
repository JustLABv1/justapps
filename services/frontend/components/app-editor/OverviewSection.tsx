"use client";

import { AppCard } from "@/components/AppCard";
import { AppLocationRow } from "@/components/MoveAppDialog";
import { AlertDialog } from "@/components/panelui/alert-dialog";
import { Button } from "@/components/panelui/button";
import { Card } from "@/components/panelui/card";
import { Dialog } from "@/components/panelui/dialog";
import { RadioGroup } from "@/components/panelui/radio-group";
import { Select } from "@/components/panelui/select";
import { Switch } from "@/components/panelui/switch";
import type { AppConfig } from "@/config/apps";
import { APP_MATURITY_DESCRIPTIONS, APP_STATUS_OPTIONS, DRAFT_STATUS, getAppStatusLabel, isDraftStatus } from "@/lib/appStatus";
import { ArrowRight, Check, CircleCheck, CircleDashed, CircleAlert, Rocket, Undo2 } from "lucide-react";
import { useState } from "react";
import type { ReadinessItem, SectionId } from "./readiness";
import { type AppDraft, EditorCard, SettingRow, type UpdateApp } from "./shared";

const MATURITY = APP_MATURITY_DESCRIPTIONS;
const PUBLISHED_STATUSES = APP_STATUS_OPTIONS.filter((status) => status !== DRAFT_STATUS);

/** A readiness item as one clickable row that jumps to where it is filled in. */
function ReadinessRow({ item, onOpen }: { item: ReadinessItem; onOpen: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="group flex w-full cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-start text-sm transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <span aria-hidden="true" className="flex size-5 shrink-0 items-center justify-center">
          {item.done ? (
            <Check className="size-4 text-success" />
          ) : item.required ? (
            <CircleAlert className="size-4 text-destructive" />
          ) : (
            <CircleDashed className="size-4 text-muted-foreground" />
          )}
        </span>
        <span className={`min-w-0 flex-1 ${item.done ? "text-muted-foreground" : ""}`}>
          {item.label}
          <span className="sr-only">{item.done ? ", erledigt" : item.required ? ", fehlt" : ", offen"}</span>
        </span>
        <ArrowRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
      </button>
    </li>
  );
}

/** Choosing the maturity an app is published with. Saving happens in `onPublish`. */
export function PublishDialog({
  open,
  onOpenChange,
  onPublish,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPublish: (status: string) => Promise<boolean>;
}) {
  const [maturity, setMaturity] = useState<string>("MVP");
  const [publishing, setPublishing] = useState(false);

  const publish = async () => {
    setPublishing(true);
    const ok = await onPublish(maturity);
    setPublishing(false);
    if (ok) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <Dialog.Content>
        <Dialog.Header
          title="App veröffentlichen"
          description="Wähle, wie weit die App ist. Offene Änderungen werden dabei mitgespeichert, den Reifegrad kannst du jederzeit ändern."
        />
        <Dialog.Body>
          <RadioGroup value={maturity} onValueChange={(value) => setMaturity(value as string)} aria-label="Reifegrad" className="pt-1">
            {PUBLISHED_STATUSES.map((status) => (
              <RadioGroup.Card key={status} value={status}>
                <RadioGroup.CardBody>
                  <RadioGroup.CardTitle>{status}</RadioGroup.CardTitle>
                  <RadioGroup.CardDescription>{MATURITY[status]}</RadioGroup.CardDescription>
                </RadioGroup.CardBody>
              </RadioGroup.Card>
            ))}
          </RadioGroup>
        </Dialog.Body>
        <Dialog.Footer>
          <Dialog.Close render={<Button variant="secondary" />}>Abbrechen</Dialog.Close>
          <Button loading={publishing} onClick={() => void publish()}>
            <Rocket />
            Veröffentlichen
          </Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog>
  );
}

export function OverviewSection({
  app,
  update,
  readiness,
  isAdmin,
  busy,
  onNavigate,
  onUnpublish,
  canMove,
}: {
  app: AppDraft;
  update: UpdateApp;
  readiness: ReadinessItem[];
  isAdmin: boolean;
  busy: boolean;
  onNavigate: (section: SectionId) => void;
  onUnpublish: () => Promise<boolean>;
  /** Owner or admin: may move the app between the catalog and spaces. */
  canMove: boolean;
}) {
  const draft = isDraftStatus(app.status || DRAFT_STATUS);
  const missingRequired = readiness.filter((item) => item.required && !item.done);
  const recommended = readiness.filter((item) => !item.required);
  const recommendedDone = recommended.filter((item) => item.done).length;

  const previewApp = {
    ...app,
    id: app.id || "app",
    name: app.name?.trim() || "Ohne Namen",
    description: app.description?.trim() || "Noch keine Kurzbeschreibung.",
    categories: app.categories || [],
  } as AppConfig;

  return (
    <>
      <Card>
        <Card.Content className="grid gap-8 md:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
          <div className="flex flex-col gap-2">
            <span className="text-sm text-muted-foreground">So erscheint die App im Katalog</span>
            {/* The real catalogue card, inert so it cannot be clicked from here. */}
            <div inert className="select-none">
              <AppCard app={previewApp} />
            </div>
          </div>

          <div className="flex min-w-0 flex-col gap-6">
            {missingRequired.length === 0 ? (
              <div className="flex items-start gap-3">
                <CircleCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-success" />
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium">{draft ? "Bereit zur Veröffentlichung" : "Alle Pflichtangaben vollständig"}</span>
                  <span className="text-sm text-muted-foreground">
                    {draft ? "Name, Kurzbeschreibung und Kategorie sind da. Veröffentlichen kannst du oben rechts." : "Die App erfüllt alles, was eine veröffentlichte App braucht."}
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium">
                    {missingRequired.length === 1 ? "Noch 1 Pflichtangabe fehlt" : `Noch ${missingRequired.length} Pflichtangaben fehlen`}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {draft ? "Danach kann die App veröffentlicht werden." : "Ohne sie kann die veröffentlichte App nicht gespeichert werden."}
                  </span>
                </div>
                <ul className="-mx-2 flex flex-col" aria-label="Fehlende Pflichtangaben">
                  {missingRequired.map((item) => <ReadinessRow key={item.id} item={item} onOpen={() => onNavigate(item.section)} />)}
                </ul>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-medium">Empfehlungen</span>
                <span className="text-sm text-muted-foreground tabular-nums">{recommendedDone} von {recommended.length}</span>
              </div>
              <ul className="-mx-2 flex flex-col" aria-label="Empfehlungen">
                {recommended.map((item) => <ReadinessRow key={item.id} item={item} onOpen={() => onNavigate(item.section)} />)}
              </ul>
            </div>
          </div>
        </Card.Content>
      </Card>

      {!draft && (
        <EditorCard
          title="Reifegrad"
          description="Zeigt anderen, wie weit die App ist. Eine Änderung wird mit „Speichern“ übernommen."
          footer={
            <div className="flex w-full justify-end">
              <AlertDialog>
                <AlertDialog.Trigger render={<Button variant="ghost" size="sm" disabled={busy} className="text-warning hover:not-disabled:bg-warning/10 hover:not-disabled:text-warning" />}>
                  <Undo2 />
                  Zurück zum Entwurf
                </AlertDialog.Trigger>
                <AlertDialog.Content tone="warning">
                  <AlertDialog.Title>App zurück auf Entwurf setzen?</AlertDialog.Title>
                  <AlertDialog.Description>
                    Sie verschwindet aus dem Katalog, bis sie erneut veröffentlicht wird. Ungespeicherte Änderungen werden dabei mitgespeichert.
                  </AlertDialog.Description>
                  <AlertDialog.Footer>
                    <AlertDialog.Cancel>Abbrechen</AlertDialog.Cancel>
                    <AlertDialog.Action onClick={async () => { if (!(await onUnpublish())) throw new Error(); }}>Zurück zum Entwurf</AlertDialog.Action>
                  </AlertDialog.Footer>
                </AlertDialog.Content>
              </AlertDialog>
            </div>
          }
        >
          <div className="sm:max-w-xs">
            <Select
              items={PUBLISHED_STATUSES.map((status) => ({ value: status, label: status }))}
              value={getAppStatusLabel(app.status) || app.status || null}
              onValueChange={(status) => status && update({ status })}
            >
              <Select.Trigger aria-label="Reifegrad">
                <Select.Value />
              </Select.Trigger>
              <Select.Content>
                {PUBLISHED_STATUSES.map((status) => (
                  <Select.Item key={status} value={status} description={MATURITY[status]}>{status}</Select.Item>
                ))}
              </Select.Content>
            </Select>
          </div>
        </EditorCard>
      )}

      <EditorCard title="Sichtbarkeit">
        {canMove && app.id && <AppLocationRow app={{ id: app.id, name: app.name || "App", status: app.status, spaceId: app.spaceId }} />}
        <SettingRow
          title="Vorübergehend verstecken"
          description={draft ? "Wirkt erst nach der Veröffentlichung: Die App bleibt dann nur für Eigentümer, Bearbeiter und Moderatoren sichtbar." : "Solange die App versteckt ist, sehen sie nur Eigentümer, Bearbeiter und Moderatoren."}
          control={<Switch label="Vorübergehend verstecken" checked={!!app.isHidden} onCheckedChange={(isHidden) => update({ isHidden })} />}
        />
        {isAdmin && (
          <SettingRow
            title="Auszeichnen"
            description="Hervorgehobene Apps erscheinen mit einer Markierung im Katalog."
            control={<Switch label="Auszeichnen" checked={!!app.isFeatured} onCheckedChange={(isFeatured) => update({ isFeatured })} />}
          />
        )}
      </EditorCard>
    </>
  );
}
