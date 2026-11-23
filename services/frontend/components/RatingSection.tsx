"use client";

import { AlertDialog } from "@/components/panelui/alert-dialog";
import { UserAvatar, authorName, authorOf } from "@/components/profile/UserAvatar";
import { Button } from "@/components/panelui/button";
import { Dialog } from "@/components/panelui/dialog";
import { Field } from "@/components/panelui/field";
import { Select } from "@/components/panelui/select";
import { Spinner } from "@/components/panelui/spinner";
import { Textarea } from "@/components/panelui/textarea";
import { useAuth } from "@/context/AuthContext";
import { fetchApi } from "@/lib/api";
import { toast } from "@/lib/toast";
import { ArrowUpDown, ChevronDown, Pencil, Star, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

interface Rating {
  id: string;
  userId: string;
  username: string;
  displayName?: string;
  avatarUrl?: string;
  rating: number;
  comment: string;
  createdAt: string;
}

type Sort = "newest" | "highest" | "lowest";

const LABELS = ["", "Schlecht", "Mäßig", "Ordentlich", "Gut", "Sehr gut"];
const SORT_ITEMS: { value: Sort; label: string }[] = [
  { value: "newest", label: "Neueste zuerst" },
  { value: "highest", label: "Beste zuerst" },
  { value: "lowest", label: "Kritischste zuerst" },
];

const relative = new Intl.RelativeTimeFormat("de", { numeric: "auto" });
function timeAgo(value: string) {
  const seconds = (new Date(value).getTime() - Date.now()) / 1000;
  if (Number.isNaN(seconds)) return "";
  const steps: [Intl.RelativeTimeFormatUnit, number][] = [["year", 31536000], ["month", 2592000], ["week", 604800], ["day", 86400], ["hour", 3600], ["minute", 60]];
  for (const [unit, size] of steps) {
    if (Math.abs(seconds) >= size) return relative.format(Math.round(seconds / size), unit);
  }
  return "gerade eben";
}
const fullDate = (value: string) => new Date(value).toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" });

function Stars({ value, size = "size-4" }: { value: number; size?: string }) {
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={`${value.toFixed(1).replace(".", ",")} von 5 Sternen`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star key={star} aria-hidden="true" className={`${size} ${value >= star - 0.25 ? "fill-gov-gold text-gov-gold" : "text-muted-foreground/30"}`} />
      ))}
    </span>
  );
}

/** Five stars to choose from; `onChoose` fires on every press. */
function StarPicker({ value, onChoose, size = "size-7", label = "Sterne" }: { value: number; onChoose: (value: number) => void; size?: string; label?: string }) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <div role="radiogroup" aria-label={label} className="flex items-center" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          role="radio"
          aria-checked={value === star}
          aria-label={`${star} ${star === 1 ? "Stern" : "Sterne"} – ${LABELS[star]}`}
          onMouseEnter={() => setHover(star)}
          onClick={() => onChoose(star)}
          className="cursor-pointer rounded-md p-0.5 outline-none transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none motion-reduce:hover:scale-100"
        >
          <Star className={`${size} transition-colors ${shown >= star ? "fill-gov-gold text-gov-gold" : "text-muted-foreground/40"}`} />
        </button>
      ))}
    </div>
  );
}

/** A comment cut to three lines when it is long, with a way to read it all. */
function Comment({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const long = text.length > 280 || text.split("\n").length > 3;
  return (
    <div className="flex flex-col items-start gap-1">
      <p className={`text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground ${long && !open ? "line-clamp-3" : ""}`}>{text}</p>
      {long && (
        <button type="button" onClick={() => setOpen(!open)} className="cursor-pointer text-sm font-medium underline-offset-4 hover:underline">
          {open ? "Weniger" : "Mehr lesen"}
        </button>
      )}
    </div>
  );
}

export function RatingSection({ appId, appName, onChange }: { appId: string; appName?: string; onChange?: () => void }) {
  const { user } = useAuth();
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [sort, setSort] = useState<Sort>("newest");
  const [filter, setFilter] = useState<number | null>(null);
  const [showBars, setShowBars] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetchApi(`/apps/${appId}/ratings`);
      if (response.ok) setRatings((await response.json()) || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoaded(true);
    }
  }, [appId]);

  useEffect(() => {
    const id = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(id);
  }, [load]);

  const own = user ? ratings.find((rating) => rating.userId === user.id) : undefined;
  const average = ratings.length ? ratings.reduce((sum, rating) => sum + rating.rating, 0) / ratings.length : 0;
  const counts = [5, 4, 3, 2, 1].map((star) => ({ star, count: ratings.filter((rating) => rating.rating === star).length }));

  const others = useMemo(() => {
    const list = ratings.filter((rating) => rating !== own && (filter === null || rating.rating === filter));
    return list.sort((a, b) => {
      if (sort === "highest" && b.rating !== a.rating) return b.rating - a.rating;
      if (sort === "lowest" && a.rating !== b.rating) return a.rating - b.rating;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [ratings, own, filter, sort]);

  const openDialog = (initialStars?: number) => {
    setStars(initialStars ?? own?.rating ?? 0);
    setComment(own?.comment ?? "");
    setDialogOpen(true);
  };

  const submit = async () => {
    if (!user || stars === 0) return;
    setSubmitting(true);
    try {
      const response = await fetchApi(`/apps/${appId}/ratings`, { method: "POST", body: JSON.stringify({ rating: stars, comment: comment.trim() }) });
      if (!response.ok) throw new Error();
      setDialogOpen(false);
      toast.success(own ? "Bewertung aktualisiert." : "Danke für deine Bewertung.");
      await load();
      onChange?.();
    } catch {
      toast.danger("Die Bewertung konnte nicht gespeichert werden.");
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (rating: Rating) => {
    try {
      const response = await fetchApi(`/apps/${appId}/ratings/${rating.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error();
      toast.success("Bewertung gelöscht.");
      await load();
      onChange?.();
    } catch {
      toast.danger("Die Bewertung konnte nicht gelöscht werden.");
    }
  };

  const deleteButton = (rating: Rating, label: string) => (
    <AlertDialog>
      <AlertDialog.Trigger render={<Button variant="ghost" size="icon-sm" aria-label={label} className="text-destructive hover:not-disabled:bg-destructive/10 hover:not-disabled:text-destructive" />}>
        <Trash2 />
      </AlertDialog.Trigger>
      <AlertDialog.Content tone="destructive">
        <AlertDialog.Title>Bewertung löschen?</AlertDialog.Title>
        <AlertDialog.Description>Die Bewertung wird unwiderruflich entfernt.</AlertDialog.Description>
        <AlertDialog.Footer>
          <AlertDialog.Cancel>Abbrechen</AlertDialog.Cancel>
          <AlertDialog.Action onClick={() => remove(rating)}>Löschen</AlertDialog.Action>
        </AlertDialog.Footer>
      </AlertDialog.Content>
    </AlertDialog>
  );

  const review = (rating: Rating, isOwn = false) => {
    const author = authorOf(rating, user);
    return (
    <article
      key={rating.id}
      aria-label={isOwn ? "Deine Bewertung" : `Bewertung von ${authorName(author)}`}
      className={isOwn ? "flex gap-3 rounded-xl border bg-muted/40 p-4" : "flex gap-3 py-5"}
    >
      <UserAvatar user={author} size="sm" />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-sm font-medium">{isOwn ? "Deine Bewertung" : authorName(author)}</span>
          <Stars value={rating.rating} size="size-3.5" />
          <time dateTime={rating.createdAt} title={fullDate(rating.createdAt)} className="text-xs text-muted-foreground">{timeAgo(rating.createdAt)}</time>
          <span className="ms-auto flex items-center gap-1">
            {isOwn && (
              <Button variant="ghost" size="sm" onClick={() => openDialog()}>
                <Pencil />
                Bearbeiten
              </Button>
            )}
            {(isOwn || user?.role === "admin") && deleteButton(rating, isOwn ? "Eigene Bewertung löschen" : "Bewertung löschen")}
          </span>
        </div>
        {rating.comment ? <Comment text={rating.comment} /> : !isOwn && <p className="text-sm text-muted-foreground/70 italic">Ohne Kommentar</p>}
      </div>
    </article>
    );
  };

  if (!loaded) {
    return (
      <div className="flex items-center justify-center gap-3 py-12 text-sm text-muted-foreground">
        <Spinner />
        Bewertungen werden geladen …
      </div>
    );
  }

  const invite = user ? (
    own ? (
      <div className="flex flex-col gap-1">
        <span className="text-sm text-muted-foreground">Deine Bewertung</span>
        <div className="flex items-center gap-2">
          <Stars value={own.rating} />
          <Button variant="link" size="sm" className="h-auto px-0" onClick={() => openDialog()}>Ändern</Button>
        </div>
      </div>
    ) : (
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Wie findest du die App?</span>
        <StarPicker value={0} onChoose={(value) => openDialog(value)} size="size-6" label="App bewerten" />
      </div>
    )
  ) : (
    <p className="text-sm text-muted-foreground">
      <a href="/login" className="font-medium text-foreground underline underline-offset-4">Anmelden</a>, um die App zu bewerten.
    </p>
  );

  const dialog = (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <Dialog.Content>
        <Dialog.Header
          title={own ? "Bewertung bearbeiten" : appName ? `${appName} bewerten` : "App bewerten"}
          description="Deine Bewertung ist für alle sichtbar, mit deinem Namen."
        />
        <Dialog.Body className="flex flex-col gap-5">
          <div className="flex flex-col items-center gap-2 py-2">
            <StarPicker value={stars} onChoose={setStars} size="size-9" />
            <span className="text-sm text-muted-foreground" aria-live="polite">{stars ? LABELS[stars] : "Sterne wählen"}</span>
          </div>
          <Field>
            <Field.Label optional>Kommentar</Field.Label>
            <Textarea value={comment} onChange={(event) => setComment(event.target.value)} rows={4} placeholder="Was hat gut funktioniert, was fehlt?" />
          </Field>
        </Dialog.Body>
        <Dialog.Footer>
          <Dialog.Close render={<Button variant="secondary" />}>Abbrechen</Dialog.Close>
          <Button disabled={stars === 0} loading={submitting} onClick={() => void submit()}>
            {own ? "Änderungen speichern" : "Bewertung abschicken"}
          </Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog>
  );

  // ── Nothing yet: one invitation, with the stars ready to press ──
  if (ratings.length === 0) {
    return (
      <>
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed px-6 py-14 text-center">
          <div className="flex flex-col gap-1">
            <h3 className="text-lg font-semibold">Noch keine Bewertungen</h3>
            <p className="text-sm text-muted-foreground">
              {user ? `Sei die erste Person, die ${appName || "diese App"} bewertet.` : "Bisher hat niemand diese App bewertet."}
            </p>
          </div>
          {user ? (
            <StarPicker value={0} onChoose={(value) => openDialog(value)} size="size-9" label="App bewerten" />
          ) : (
            invite
          )}
        </div>
        {dialog}
      </>
    );
  }

  const bars = (
    <ul className="flex flex-col gap-0.5" aria-label="Nach Sternen filtern">
      {counts.map(({ star, count }) => {
        const active = filter === star;
        return (
          <li key={star}>
            <button
              type="button"
              disabled={count === 0}
              aria-pressed={active}
              onClick={() => setFilter(active ? null : star)}
              className={`grid w-full cursor-pointer grid-cols-[1.75rem_minmax(0,1fr)_1.75rem] items-center gap-2 rounded-md px-1.5 py-1 text-sm transition-colors hover:bg-muted disabled:cursor-default disabled:hover:bg-transparent ${active ? "bg-muted text-foreground" : "text-muted-foreground"}`}
            >
              <span className="flex items-center gap-0.5 tabular-nums">{star}<Star aria-hidden="true" className="size-3" /></span>
              <span className="h-1.5 overflow-hidden rounded-full bg-muted">
                <span className="block h-full rounded-full bg-gov-gold" style={{ width: `${(count / ratings.length) * 100}%` }} />
              </span>
              <span className="text-end tabular-nums">{count}</span>
              <span className="sr-only">{active ? ", Filter aktiv" : `, nur ${star}-Sterne-Bewertungen zeigen`}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );

  return (
    <>
      <div className="grid gap-8 xl:grid-cols-[16rem_minmax(0,1fr)]">
        {/* ── Summary ── */}
        <aside aria-label="Zusammenfassung" className="flex flex-col gap-5 xl:sticky xl:top-32 xl:self-start">
          <div className="flex items-center justify-between gap-4 xl:flex-col xl:items-start xl:gap-1">
            <div className="flex items-center gap-3 xl:flex-col xl:items-start xl:gap-1">
              <span className="text-4xl font-semibold tracking-tight tabular-nums">{average.toFixed(1).replace(".", ",")}</span>
              <div className="flex flex-col gap-0.5">
                <Stars value={average} />
                <span className="text-sm text-muted-foreground">{ratings.length} {ratings.length === 1 ? "Bewertung" : "Bewertungen"}</span>
              </div>
            </div>
            <Button variant="ghost" size="sm" className="sm:hidden" aria-expanded={showBars} onClick={() => setShowBars(!showBars)}>
              Verteilung
              <ChevronDown className={`transition-transform ${showBars ? "rotate-180" : ""}`} />
            </Button>
          </div>
          <div className={showBars ? "" : "max-sm:hidden"}>{bars}</div>
          <div className="border-t pt-5">{invite}</div>
        </aside>

        {/* ── Reviews ── */}
        <div className="flex min-w-0 flex-col gap-4">
          {own && review(own, true)}

          <div className="flex flex-wrap items-center gap-2">
            {filter !== null ? (
              <Button variant="secondary" size="sm" shape="pill" onClick={() => setFilter(null)}>
                Nur {filter} {filter === 1 ? "Stern" : "Sterne"}
                <X />
              </Button>
            ) : (
              <span className="text-sm text-muted-foreground">
                {others.length} {own ? (others.length === 1 ? "weitere Bewertung" : "weitere Bewertungen") : others.length === 1 ? "Bewertung" : "Bewertungen"}
              </span>
            )}
            <Select items={SORT_ITEMS} value={sort} onValueChange={(value) => value && setSort(value as Sort)}>
              <Select.Trigger variant="ghost" size="sm" aria-label="Bewertungen sortieren" className="ms-auto">
                <ArrowUpDown />
                <Select.Value />
              </Select.Trigger>
              <Select.Content align="end">
                {SORT_ITEMS.map((item) => <Select.Item key={item.value} value={item.value}>{item.label}</Select.Item>)}
              </Select.Content>
            </Select>
          </div>

          {others.length > 0 ? (
            <div className="flex flex-col divide-y">{others.map((rating) => review(rating))}</div>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {filter !== null ? "Keine Bewertungen mit dieser Sternzahl." : "Noch keine weiteren Bewertungen."}
            </p>
          )}
        </div>
      </div>
      {dialog}
    </>
  );
}
