"use client";

import { AlertDialog } from "@/components/panelui/alert-dialog";
import { Avatar } from "@/components/panelui/avatar";
import { Button } from "@/components/panelui/button";
import { Card } from "@/components/panelui/card";
import { Field } from "@/components/panelui/field";
import { Textarea } from "@/components/panelui/textarea";
import { useAuth } from "@/context/AuthContext";
import { fetchApi } from "@/lib/api";
import { toast } from "@/lib/toast";
import { MessageSquare, Pencil, Star, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

interface Rating {
  id: string;
  userId: string;
  username: string;
  rating: number;
  comment: string;
  createdAt: string;
}

const LABELS = ["", "Schlecht", "Mäßig", "Ordentlich", "Gut", "Sehr gut"];

function Stars({ value, size = "size-4" }: { value: number; size?: string }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value.toFixed(1).replace(".", ",")} von 5 Sternen`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          aria-hidden="true"
          className={`${size} ${value >= star - 0.25 ? "fill-gov-gold text-gov-gold" : "text-muted-foreground/30"}`}
        />
      ))}
    </span>
  );
}

function StarPicker({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <div className="flex items-center gap-3">
      <div role="radiogroup" aria-label="Sterne" className="flex items-center" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={value === star}
            aria-label={`${star} ${star === 1 ? "Stern" : "Sterne"}`}
            onMouseEnter={() => setHover(star)}
            onClick={() => onChange(star)}
            className="cursor-pointer rounded-md p-1 outline-none transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Star className={`size-6 ${shown >= star ? "fill-gov-gold text-gov-gold" : "text-muted-foreground/30"}`} />
          </button>
        ))}
      </div>
      <span className="text-sm text-muted-foreground">{shown ? LABELS[shown] : "Sterne wählen"}</span>
    </div>
  );
}

const formatDate = (value: string) => new Date(value).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });

export function RatingSection({ appId, onChange }: { appId: string; onChange?: () => void }) {
  const { user } = useAuth();
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState(false);
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
  const others = ratings.filter((rating) => rating !== own);
  const average = ratings.length ? ratings.reduce((sum, rating) => sum + rating.rating, 0) / ratings.length : 0;
  const showForm = !!user && (!own || editing);

  const startEdit = () => {
    if (!own) return;
    setStars(own.rating);
    setComment(own.comment || "");
    setEditing(true);
  };

  const submit = async () => {
    if (!user || stars === 0) return;
    setSubmitting(true);
    try {
      const response = await fetchApi(`/apps/${appId}/ratings`, { method: "POST", body: JSON.stringify({ rating: stars, comment }) });
      if (!response.ok) throw new Error();
      setEditing(false);
      setStars(0);
      setComment("");
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
      if (rating === own) setEditing(false);
      toast.success("Bewertung gelöscht.");
      await load();
      onChange?.();
    } catch {
      toast.danger("Die Bewertung konnte nicht gelöscht werden.");
    }
  };

  const deleteButton = (rating: Rating) => (
    <AlertDialog>
      <AlertDialog.Trigger render={<Button variant="ghost" size="icon-sm" aria-label="Bewertung löschen" />}>
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

  const renderRating = (rating: Rating, isOwn = false) => (
    <li key={rating.id} className="flex gap-3 py-5 first:pt-0">
      <Avatar name={rating.username || "Anonym"} size="sm" />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-sm font-medium">{isOwn ? "Deine Bewertung" : rating.username || "Anonymer Nutzer"}</span>
          <Stars value={rating.rating} size="size-3.5" />
          <time dateTime={rating.createdAt} className="text-xs text-muted-foreground">{formatDate(rating.createdAt)}</time>
          <span className="ms-auto flex items-center gap-1">
            {isOwn && (
              <Button variant="ghost" size="sm" onClick={startEdit}>
                <Pencil />
                Bearbeiten
              </Button>
            )}
            {(isOwn || user?.role === "admin") && deleteButton(rating)}
          </span>
        </div>
        {rating.comment && <p className="text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">{rating.comment}</p>}
      </div>
    </li>
  );

  return (
    <div className="flex flex-col gap-8">
      {ratings.length > 0 && (
        <div className="grid gap-6 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center sm:gap-10">
          <div className="flex flex-col gap-1">
            <span className="text-4xl font-semibold tracking-tight tabular-nums">{average.toFixed(1).replace(".", ",")}</span>
            <Stars value={average} />
            <span className="text-sm text-muted-foreground">{ratings.length} {ratings.length === 1 ? "Bewertung" : "Bewertungen"}</span>
          </div>
          <ul className="flex flex-col gap-1.5" aria-label="Verteilung der Sterne">
            {[5, 4, 3, 2, 1].map((star) => {
              const count = ratings.filter((rating) => rating.rating === star).length;
              return (
                <li key={star} className="grid grid-cols-[1.5rem_minmax(0,1fr)_2rem] items-center gap-2 text-sm text-muted-foreground">
                  <span className="tabular-nums">{star}★</span>
                  <span className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <span className="block h-full rounded-full bg-gov-gold" style={{ width: `${(count / ratings.length) * 100}%` }} />
                  </span>
                  <span className="text-end tabular-nums">{count}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {showForm ? (
        <Card>
          <Card.Header>
            <Card.Title as="h3" className="text-base">{own ? "Bewertung bearbeiten" : "Wie ist deine Erfahrung mit der App?"}</Card.Title>
          </Card.Header>
          <Card.Content className="flex flex-col gap-4">
            <StarPicker value={stars} onChange={setStars} />
            <Field>
              <Field.Label optional>Kommentar</Field.Label>
              <Textarea value={comment} onChange={(event) => setComment(event.target.value)} rows={3} placeholder="Was hat gut funktioniert, was fehlt?" />
            </Field>
          </Card.Content>
          <Card.Footer variant="panel" className="justify-end gap-2">
            {editing && <Button variant="ghost" onClick={() => setEditing(false)}>Abbrechen</Button>}
            <Button disabled={stars === 0} loading={submitting} onClick={() => void submit()}>
              {own ? "Änderungen speichern" : "Bewertung abschicken"}
            </Button>
          </Card.Footer>
        </Card>
      ) : !user ? (
        <p className="text-sm text-muted-foreground">
          <a href="/login" className="font-medium text-foreground underline underline-offset-4">Anmelden</a>, um die App zu bewerten.
        </p>
      ) : null}

      {loaded && ratings.length === 0 && !showForm && (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-12 text-center text-muted-foreground">
          <MessageSquare className="size-6 opacity-40" />
          <p className="text-sm">Noch keine Bewertungen.</p>
        </div>
      )}

      {(own && !editing) || others.length > 0 ? (
        <ul className="flex flex-col divide-y">
          {own && !editing && renderRating(own, true)}
          {others.map((rating) => renderRating(rating))}
        </ul>
      ) : null}
    </div>
  );
}
