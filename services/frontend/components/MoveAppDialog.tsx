'use client';

import { Alert } from '@/components/panelui/alert';
import { Button } from '@/components/panelui/button';
import { Dialog } from '@/components/panelui/dialog';
import { RadioGroup } from '@/components/panelui/radio-group';
import { Spinner } from '@/components/panelui/spinner';
import { fetchApi } from '@/lib/api';
import { isDraftStatus } from '@/lib/appStatus';
import { toast } from '@/lib/toast';
import { FolderInput, Globe, Lock } from 'lucide-react';
import { useEffect, useState } from 'react';

interface MovableApp {
  id: string;
  name: string;
  status?: string;
  spaceId?: string | null;
}

interface SpaceOption {
  id: string;
  name: string;
  accepted: boolean;
}

/** The value of the "public catalog" choice; spaces use their id. */
const CATALOG = 'catalog';

/** What a move changes for whom, spelled out before it happens. */
function MoveWarning({ app, from, to }: { app: MovableApp; from: string; to: string }) {
  const draft = isDraftStatus(app.status);

  if (to === CATALOG) {
    return (
      <Alert variant="plain" tone="warning">
        <Alert.Icon />
        <Alert.Title>Die App wird öffentlich</Alert.Title>
        <Alert.Description>
          {draft
            ? 'Sie bleibt ein Entwurf und erscheint erst im Katalog, wenn sie veröffentlicht wird. Danach sehen sie alle Nutzer.'
            : 'Sie erscheint sofort im öffentlichen Katalog und ist für alle Nutzer sichtbar.'}
          {' '}Mitglieder von „{from}“ behalten den Zugriff.
        </Alert.Description>
      </Alert>
    );
  }

  if (!app.spaceId) {
    return (
      <Alert variant="plain" tone="destructive">
        <Alert.Icon />
        <Alert.Title>Die App verschwindet aus dem öffentlichen Katalog</Alert.Title>
        <Alert.Description>
          <ul className="list-disc ps-4">
            <li>Nur noch Mitglieder von „{to}“ können sie sehen.</li>
            <li>Bearbeiter außerhalb des Space verlieren den Zugriff, ebenso alle, die sie als Favorit gespeichert oder abonniert haben.</li>
            <li>Sie wird nicht mehr bei verknüpften Bedarfsmeldungen und im Wochenrückblick angezeigt.</li>
          </ul>
        </Alert.Description>
      </Alert>
    );
  }

  return (
    <Alert variant="plain" tone="warning">
      <Alert.Icon />
      <Alert.Title>Der Zugriff ändert sich</Alert.Title>
      <Alert.Description>
        Danach sehen nur noch Mitglieder von „{to}“ die App. Wer nur in „{from}“ Mitglied ist, verliert den Zugriff, auch als Bearbeiter.
      </Alert.Description>
    </Alert>
  );
}

/**
 * Moves an app between the public catalog and the viewer's spaces, in any direction.
 * Only offered to the app's owner and to admins; the server checks the same.
 */
export function MoveAppDialog({
  app,
  open,
  onOpenChange,
  onMoved,
}: {
  app: MovableApp | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the new space (null for the catalog) once the move went through. */
  onMoved: (spaceId: string | null) => void;
}) {
  const [spaces, setSpaces] = useState<SpaceOption[] | null>(null);
  const [target, setTarget] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);

  useEffect(() => {
    if (!open) return;
    let active = true;
    fetchApi('/spaces')
      .then((response) => (response.ok ? response.json() : []))
      .then((data: unknown) => {
        if (active) setSpaces(Array.isArray(data) ? (data as SpaceOption[]).filter((space) => space.accepted) : []);
      })
      .catch(() => { if (active) setSpaces([]); });
    return () => { active = false; };
  }, [open]);

  const current = app?.spaceId || CATALOG;
  const nameOf = (value: string) => (value === CATALOG ? 'Öffentlicher Katalog' : spaces?.find((space) => space.id === value)?.name || 'unbekannter Space');
  const chosen = target && target !== current ? target : null;

  const close = (next: boolean) => {
    if (!next) setTarget(null);
    onOpenChange(next);
  };

  const move = async () => {
    if (!app || !chosen) return;
    setMoving(true);
    const response = await fetchApi(`/apps/${encodeURIComponent(app.id)}/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ spaceId: chosen === CATALOG ? null : chosen }),
    }).catch(() => null);
    setMoving(false);
    if (!response?.ok) {
      const body = await response?.json().catch(() => ({})) as { message?: string } | undefined;
      toast.danger(body?.message || 'Die App konnte nicht verschoben werden.');
      return;
    }
    toast.success(`„${app.name}“ ist jetzt in ${chosen === CATALOG ? 'dem öffentlichen Katalog' : `„${nameOf(chosen)}“`}.`);
    setTarget(null);
    onOpenChange(false);
    onMoved(chosen === CATALOG ? null : chosen);
  };

  const options = [{ id: CATALOG, name: 'Öffentlicher Katalog' }, ...(spaces ?? [])];

  return (
    <Dialog open={open} onOpenChange={close}>
      <Dialog.Content>
        <Dialog.Header
          title={`„${app?.name ?? ''}“ verschieben`}
          description="Wähle, wo die App liegen soll. Wer sie sehen kann, hängt davon ab."
        />
        <Dialog.Body>
          {/* A little room on top: the body scrolls, and a focused card's ring would be cut off at its edge. */}
          <div className="flex flex-col gap-4 pt-1">
          {spaces === null ? (
            <div className="flex justify-center py-6"><Spinner /></div>
          ) : (
            <RadioGroup value={target ?? ''} onValueChange={(value) => setTarget(value as string)} aria-label="Ziel">
              {options.map((option) => (
                <RadioGroup.Card key={option.id} value={option.id} disabled={option.id === current}>
                  <RadioGroup.CardBody>
                    <RadioGroup.CardTitle className="flex items-center gap-2">
                      {option.id === CATALOG ? <Globe className="size-4 text-muted-foreground" /> : <Lock className="size-4 text-muted-foreground" />}
                      {option.name}
                      {option.id === current && <span className="text-xs font-normal text-muted-foreground">· aktuell</span>}
                    </RadioGroup.CardTitle>
                    <RadioGroup.CardDescription>
                      {option.id === CATALOG ? 'Für alle Nutzer sichtbar.' : 'Nur für Mitglieder dieses Space sichtbar.'}
                    </RadioGroup.CardDescription>
                  </RadioGroup.CardBody>
                </RadioGroup.Card>
              ))}
            </RadioGroup>
          )}
          {spaces !== null && spaces.length === 0 && !app?.spaceId && (
            <p className="text-sm text-muted-foreground">Du bist in keinem Space Mitglied. Lege unter „Spaces“ einen an, um Apps privat zu halten.</p>
          )}
          {app && chosen && <MoveWarning app={app} from={nameOf(current)} to={nameOf(chosen)} />}
          </div>
        </Dialog.Body>
        <Dialog.Footer>
          <Dialog.Close render={<Button variant="secondary" />}>Abbrechen</Dialog.Close>
          <Button variant={chosen && chosen !== CATALOG && !app?.spaceId ? 'destructive' : 'default'} disabled={!chosen} loading={moving} onClick={() => void move()}>
            <FolderInput />
            Verschieben
          </Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog>
  );
}

/**
 * Where an app lives and a way to move it, as one row for a settings card.
 * Keeps the location itself, so a move shows at once without touching the editor's unsaved changes.
 */
export function AppLocationRow({ app }: { app: MovableApp }) {
  const [spaceId, setSpaceId] = useState<string | null>(app.spaceId || null);
  const [spaceName, setSpaceName] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!spaceId) return;
    let active = true;
    fetchApi('/spaces')
      .then((response) => (response.ok ? response.json() : []))
      .then((data: unknown) => {
        const match = Array.isArray(data) ? (data as SpaceOption[]).find((space) => space.id === spaceId) : undefined;
        if (active) setSpaceName(match?.name ?? null);
      })
      .catch(() => {});
    return () => { active = false; };
  }, [spaceId]);

  return (
    <div data-search-target className="flex items-start justify-between gap-6 rounded-lg">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span data-search-label="Ablageort" data-search-keywords="Space Spaces privat öffentlich Katalog verschieben" className="text-sm font-medium">Ablageort</span>
        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
          {spaceId ? <Lock className="size-3.5 shrink-0" /> : <Globe className="size-3.5 shrink-0" />}
          {spaceId ? `Space „${spaceName ?? '…'}“, nur für Mitglieder sichtbar` : 'Öffentlicher Katalog, für alle sichtbar'}
        </span>
      </div>
      <Button variant="outline" size="sm" className="shrink-0" onClick={() => setOpen(true)}>
        <FolderInput />
        Verschieben …
      </Button>
      <MoveAppDialog
        app={{ ...app, spaceId }}
        open={open}
        onOpenChange={setOpen}
        onMoved={(next) => { setSpaceName(null); setSpaceId(next); }}
      />
    </div>
  );
}
