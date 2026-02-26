'use client';

import { useAuth } from "@/context/AuthContext";
import { AlertDialog, Button, Card, Label, TextArea, TextField } from "@heroui/react";
import { MessageSquare, Star, User } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { fetchApi } from "../lib/api";

interface Rating {
  id: string;
  userId: string;
  username: string;
  rating: number;
  comment: string;
  createdAt: string;
}

export function RatingSection({ appId }: { appId: string }) {
  const { user } = useAuth();
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [userRating, setUserRating] = useState(0);
  const [comment, setComment] = useState("");
  const [hoverRating, setHoverRating] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);

  const fetchRatings = useCallback(async () => {
    try {
      const res = await fetchApi(`/apps/${appId}/ratings`);
      if (res.ok) {
        const data = await res.json();
        const ratingsArray = data || [];
        setRatings(ratingsArray);
        
        // If user already has a rating, pre-fill for potentially invisible "edit" mode
        if (user) {
          const existing = ratingsArray.find((r: Rating) => r.userId === user.id);
          if (existing && !isEditing) {
            setUserRating(existing.rating);
            setComment(existing.comment);
          }
        }
      }
    } catch (err) {
      console.error(err);
    }
  }, [appId, user, isEditing]);

  useEffect(() => {
    fetchRatings();
  }, [fetchRatings]);

  const handleSubmit = async () => {
    if (!user || userRating === 0) return;
    setSubmitting(true);

    try {
       const res = await fetchApi(`/apps/${appId}/ratings`, {
        method: 'POST',
        body: JSON.stringify({
          userId: user.id,
          username: user.username,
          rating: userRating,
          comment: comment
        })
      });

      if (res.ok) {
        if (!isEditing) {
          setComment("");
          setUserRating(0);
        }
        setIsEditing(false);
        fetchRatings();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (ratingId: string) => {
    try {
      const res = await fetchApi(`/apps/${appId}/ratings/${ratingId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        fetchRatings();
        // Clear form if we deleted our own rating
        const deletedRating = ratings.find(r => r.id === ratingId);
        if (deletedRating?.userId === user?.id) {
          setComment("");
          setUserRating(0);
          setIsEditing(false);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleEdit = (rating: Rating) => {
    setUserRating(rating.rating);
    setComment(rating.comment);
    setIsEditing(true);
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  return (
    <div className="mt-8 space-y-8">
      <div className="flex items-center gap-2 text-xl font-bold text-foreground">
        <MessageSquare className="w-6 h-6 text-accent" />
        Feedback & Bewertungen
      </div>

      {user ? (
        <div ref={formRef}>
          <Card className={`border-border shadow-sm transition-all ${isEditing ? 'ring-2 ring-accent/50 bg-accent/5' : 'bg-surface-secondary'}`} variant="default">
            <Card.Content className="p-6 space-y-5">
            <div className="flex justify-between items-center">
              <Label className="font-bold text-sm uppercase tracking-wider text-muted">
                {isEditing ? "Meine Bewertung bearbeiten" : "Ihre Bewertung abgeben"}
              </Label>
              {isEditing && (
                <button 
                  onClick={() => setIsEditing(false)}
                  className="text-xs text-muted hover:text-foreground font-medium underline"
                >
                  Abbrechen
                </button>
              )}
            </div>
            <div className="flex items-center gap-2 bg-surface p-4 rounded-xl border border-border w-fit">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  aria-label={`Bewerten mit ${star} Sternen`}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  onClick={() => setUserRating(star)}
                  className="focus:outline-none transition-transform hover:scale-110 active:scale-90"
                >
                  <Star
                    className={`w-8 h-8 ${
                      (hoverRating || userRating) >= star
                        ? "fill-gov-gold text-gov-gold drop-shadow-sm"
                        : "text-muted/20"
                    }`}
                  />
                </button>
              ))}
              <span className="ml-4 text-sm font-bold text-muted">
                {userRating > 0 ? `${userRating} von 5 Sternen` : "Wählen Sie eine Bewertung"}
              </span>
            </div>
            <TextField 
              value={comment} 
              onChange={setComment}
              className="flex flex-col gap-2"
            >
              <Label className="text-sm font-bold text-muted">Ihr Kommentar</Label>
              <TextArea
                placeholder="Teilen Sie Ihre Erfahrungen mit dieser App..."
                value={comment}
                className="w-full bg-surface border-border rounded-xl shadow-sm"
                rows={4}
              />
            </TextField>
            <div className="flex justify-end pt-2 gap-3">
              <Button
                onPress={handleSubmit}
                isDisabled={userRating === 0 || submitting}
                className="font-bold px-6 rounded-xl bg-accent text-white hover:bg-accent/90 shadow-sm"
              >
                {submitting ? "Wird gesendet..." : (isEditing ? "Änderungen speichern" : "Bewertung abschicken")}
              </Button>
            </div>
          </Card.Content>
        </Card>
      </div>
      ) : (
        <Card variant="secondary" className="border border-border bg-surface-secondary/50 shadow-sm rounded-2xl">
          <Card.Content className="p-8 text-center">
            <p className="text-muted text-sm font-medium">Bitte melden Sie sich an, um eine Bewertung abzugeben.</p>
          </Card.Content>
        </Card>
      )}

      <div className="space-y-4">
        {ratings.length > 0 ? (
          ratings.map((r) => (
            <div key={r.id} className="bg-surface border border-border p-6 rounded-2xl space-y-4 hover:border-accent/30 transition-colors shadow-sm">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-surface-secondary flex items-center justify-center border border-border shadow-sm">
                    <User className="w-6 h-6 text-muted" />
                  </div>
                  <div>
                    <div className="text-base font-bold text-foreground">{r.username || "Anonymer Nutzer"}</div>
                    <div className="text-xs text-muted font-medium uppercase tracking-wider mt-0.5">
                      {new Date(r.createdAt).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className="flex items-center gap-1 bg-surface px-2.5 py-1.5 rounded-xl border border-border shadow-sm">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        className={`w-4 h-4 ${
                          r.rating >= s ? "fill-gov-gold text-gov-gold drop-shadow-sm" : "text-muted/20"
                        }`}
                      />
                    ))}
                  </div>
                  
                  {/* Actions for User or Admin */}
                  <div className="flex items-center gap-3 mt-1">
                    {(user?.id === r.userId) && (
                      <Button 
                        onPress={() => handleEdit(r)}
                        variant="secondary"
                        size="sm"
                      >
                        Bearbeiten
                      </Button>
                    )}
                    {(user?.id === r.userId || user?.role === 'admin') && (
                      <AlertDialog>
                        <Button 
                          variant="danger-soft"
                          size="sm"
                        >
                          Löschen
                        </Button>
                        <AlertDialog.Backdrop>
                          <AlertDialog.Container>
                            <AlertDialog.Dialog className="sm:max-w-[400px]">
                              <AlertDialog.Header>
                                <AlertDialog.Icon status="danger" />
                                <AlertDialog.Heading>Bewertung löschen?</AlertDialog.Heading>
                              </AlertDialog.Header>
                              <AlertDialog.Body>
                                <p>Möchten Sie diese Bewertung wirklich unwiderruflich löschen?</p>
                              </AlertDialog.Body>
                              <AlertDialog.Footer>
                                <Button slot="close" variant="tertiary">Abbrechen</Button>
                                <Button 
                                  slot="close" 
                                  variant="danger" 
                                  onPress={() => handleDelete(r.id)}
                                >
                                  Löschen
                                </Button>
                              </AlertDialog.Footer>
                            </AlertDialog.Dialog>
                          </AlertDialog.Container>
                        </AlertDialog.Backdrop>
                      </AlertDialog>
                    )}
                  </div>
                </div>
              </div>
              {r.comment && (
                <div className="pl-[4.5rem] relative mt-2">
                  <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-border rounded-full opacity-50" />
                  <p className="text-base text-muted leading-relaxed bg-surface-secondary/50 p-4 rounded-xl border border-border/50">
                    {r.comment}
                  </p>
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="text-center text-muted py-16 border-2 border-dashed border-border bg-surface-secondary/30 rounded-3xl">
            <MessageSquare className="w-10 h-10 mx-auto mb-4 opacity-20" />
            <p className="font-medium text-base">Noch keine Bewertungen vorhanden. Seien Sie der Erste!</p>
          </div>
        )}
      </div>
    </div>
  );
}
