"use client";

import { AlertDialog } from "@/components/panelui/alert-dialog";
import { Badge } from "@/components/panelui/badge";
import { Button } from "@/components/panelui/button";
import { Dialog } from "@/components/panelui/dialog";
import { RadioGroup } from "@/components/panelui/radio-group";
import { Select } from "@/components/panelui/select";
import { Switch } from "@/components/panelui/switch";
import { APP_STATUS_OPTIONS, DRAFT_STATUS, getAppStatusLabel, isDraftStatus } from "@/lib/appStatus";
import { ArrowRight, Check, Circle, Rocket, Undo2, X } from "lucide-react";
import { useState } from "react";
import type { ReadinessItem, SectionId } from "./readiness";
import { type AppDraft, EditorCard, SettingRow, type UpdateApp } from "./shared";

const MATURITY: Record<string, string> = {
  POC: "Machbarkeitsnachweis, noch nicht für den Einsatz gedacht.",
  MVP: "Erste nutzbare Version mit den wichtigsten Funktionen.",
  Sandbox: "Zum Ausprobieren in einer Testumgebung, nicht produktiv.",
  "In Erprobung": "Im Pilotbetrieb bei ersten Stellen.",
  Etabliert: "Im produktiven Einsatz und gepflegt.",
};
const PUBLISHED_STATUSES = APP_STATUS_OPTIONS.filter((status) => status !== DRAFT_STATUS);

function ChecklistRow({ item, onOpen }: { item: ReadinessItem; onOpen: () => void }) {
  return (
    <li className="flex items-center gap-3 py-2.5">
      <span
        aria-hidden="true"
        className={`flex size-5 shrink-0 items-center justify-center rounded-full ${item.done ? "bg-success text-white" : item.required ? "bg-destructive/15 text-destructive" : "border text-muted-foreground"}`}
      >
        {item.done ? <Check className="size-3" /> : item.required ? <X className="size-3" /> : <Circle className="size-2 fill-current" />}
      </span>
      <span className={`min-w-0 flex-1 text-sm ${item.done ? "text-muted-foreground" : ""}`}>
        {item.label}
        <span className="sr-only">{item.done ? ", erledigt" : item.required ? ", fehlt" : ", offen"}</span>
      </span>
      {!item.done && (
        <Button variant="ghost" size="sm" onClick={onOpen}>
          Ergänzen
          <ArrowRight />
        </Button>
      )}
    </li>
  );
}

export function OverviewSection({
  app,
  update,
  readiness,
  isAdmin,
  busy,
  onNavigate,
  onPublish,
  onUnpublish,
}: {
  app: AppDraft;
  update: UpdateApp;
  readiness: ReadinessItem[];
  isAdmin: boolean;
  busy: boolean;
  onNavigate: (section: SectionId) => void;
  onPublish: (status: string) => Promise<boolean>;
  onUnpublish: () => Promise<boolean>;
}) {
  const draft = isDraftStatus(app.status || DRAFT_STATUS);
  const required = readiness.filter((item) => item.required);
  const recommended = readiness.filter((item) => !item.required);
  const missingRequired = required.filter((item) => !item.done);
  const [publishOpen, setPublishOpen] = useState(false);
  const [maturity, setMaturity] = useState<string>("MVP");
  const [publishing, setPublishing] = useState(false);

  const publish = async () => {
    setPublishing(true);
    const ok = await onPublish(maturity);
    setPublishing(false);
    if (ok) setPublishOpen(false);
  };

  return (
    <>
      {draft ? (
        <EditorCard
          title="Veröffentlichung"
          description={missingRequired.length ? `Noch ${missingRequired.length} ${missingRequired.length === 1 ? "Angabe" : "Angaben"} bis zur Veröffentlichung.` : "Alle Pflichtangaben sind da. Die App kann veröffentlicht werden."}
          action={<Badge variant="secondary" size="lg">Entwurf</Badge>}
          footer={
            <div className="flex w-full flex-wrap items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground">Entwürfe sehen nur du, Bearbeiter und Moderatoren.</span>
              <Button disabled={missingRequired.length > 0 || busy} onClick={() => setPublishOpen(true)}>
                <Rocket />
                Veröffentlichen
              </Button>
            </div>
          }
        >
          <ul className="-my-2.5 divide-y" aria-label="Pflichtangaben">
            {required.map((item) => <ChecklistRow key={item.id} item={item} onOpen={() => onNavigate(item.section)} />)}
          </ul>
        </EditorCard>
      ) : (
        <EditorCard
          title="Veröffentlichung"
          description="Die App ist im Katalog sichtbar. Der Reifegrad zeigt anderen, wie weit sie ist."
          action={<Badge variant="success" size="lg" dot>Veröffentlicht</Badge>}
          footer={
            <div className="flex w-full flex-wrap items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground">Ein geänderter Reifegrad wird mit „Speichern“ übernommen.</span>
              <AlertDialog>
                <AlertDialog.Trigger render={<Button variant="ghost" size="sm" disabled={busy} />}>
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
          <div className="flex flex-col gap-2 sm:max-w-xs">
            <span className="text-sm font-medium">Reifegrad</span>
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
          {missingRequired.length > 0 && (
            <ul className="-mb-2.5 divide-y" aria-label="Fehlende Pflichtangaben">
              {missingRequired.map((item) => <ChecklistRow key={item.id} item={item} onOpen={() => onNavigate(item.section)} />)}
            </ul>
          )}
        </EditorCard>
      )}

      <EditorCard title="Empfehlungen" description="Keine Pflicht, aber sie helfen anderen, die App einzuschätzen und einzusetzen.">
        <ul className="-my-2.5 divide-y" aria-label="Empfehlungen">
          {recommended.map((item) => <ChecklistRow key={item.id} item={item} onOpen={() => onNavigate(item.section)} />)}
        </ul>
      </EditorCard>

      <EditorCard title="Sichtbarkeit">
        <SettingRow
          title="Vorübergehend verstecken"
          description="Solange die App versteckt ist, sehen sie nur Eigentümer, Bearbeiter und Moderatoren."
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

      <Dialog open={publishOpen} onOpenChange={setPublishOpen}>
        <Dialog.Content>
          <Dialog.Header title="App veröffentlichen" description="Wähle, wie weit die App ist. Den Reifegrad kannst du jederzeit ändern." />
          <Dialog.Body>
            <RadioGroup value={maturity} onValueChange={(value) => setMaturity(value as string)} aria-label="Reifegrad">
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
    </>
  );
}
