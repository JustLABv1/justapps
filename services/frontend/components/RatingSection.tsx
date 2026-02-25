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
    <div className="mt-12 space-y-8">
      <div className="flex items-center gap-2 text-xl font-semibold text-foreground">
        <MessageSquare className="w-5 h-5 text-accent" />
        Feedback & Bewertungen
      </div>

      {user ? (
        <div ref={formRef}>
          <Card className={`border-border transition-all ${isEditing ? 'ring-2 ring-accent/50 bg-accent/5' : ''}`} variant="default">
            <Card.Content className="p-6 space-y-4">
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
            <div className="flex items-center gap-2">
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
                        ? "fill-gov-gold text-gov-gold"
                        : "text-muted/30"
                    }`}
                  />
                </button>
              ))}
              <span className="ml-2 text-sm font-bold text-muted">
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
                className="w-full bg-background"
                rows={4}
              />
            </TextField>
            <div className="flex justify-end pt-2 gap-3">
              <Button
                onPress={handleSubmit}
                isDisabled={userRating === 0 || submitting}
                className="font-medium px-6"
              >
                {submitting ? "Wird gesendet..." : (isEditing ? "Änderungen speichern" : "Bewertung abschicken")}
              </Button>
            </div>
          </Card.Content>
        </Card>
      </div>
      ) : (
        <Card variant="secondary" className="border-none">
          <Card.Content className="p-8 text-center bg-surface-secondary/50">
            <p className="text-muted text-sm font-medium italic">Bitte melden Sie sich an, um eine Bewertung abzugeben.</p>
          </Card.Content>
        </Card>
      )}

      <div className="space-y-6">
        {ratings.length > 0 ? (
          ratings.map((r) => (
            <div key={r.id} className="bg-surface border border-separator p-6 rounded-2xl space-y-4 hover:border-border transition-colors">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-surface-secondary flex items-center justify-center border border-border">
                    <User className="w-5 h-5 text-muted" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-foreground">{r.username || "Anonymer Nutzer"}</div>
                    <div className="text-[10px] text-muted font-medium uppercase tracking-wider">
                      {new Date(r.createdAt).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className="flex items-center gap-0.5 bg-surface-secondary/50 px-2 py-1 rounded-lg border border-border">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        className={`w-3.5 h-3.5 ${
                          r.rating >= s ? "fill-gov-gold text-gov-gold" : "text-muted/20"
                        }`}
                      />
                    ))}
                  </div>
                  
                  {/* Actions for User or Admin */}
                  <div className="flex items-center gap-2">
                    {(user?.id === r.userId) && (
                      <button 
                        onClick={() => handleEdit(r)}
                        className="text-[10px] font-semibold uppercase tracking-tighter text-accent hover:underline"
                      >
                        Bearbeiten
                      </button>
                    )}
                    {(user?.id === r.userId || user?.role === 'admin') && (
                      <AlertDialog>
                        <Button 
                          variant="tertiary"
                          className="h-auto p-0 text-[10px] font-bold uppercase tracking-tighter text-danger hover:underline min-w-0"
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
                <div className="pl-[3.25rem] relative">
                  <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-separator rounded-full opacity-50" />
                  <p className="text-sm text-muted leading-relaxed">
                    {r.comment}
                  </p>
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="text-center text-muted py-16 border-2 border-dashed border-separator rounded-2xl">
            <MessageSquare className="w-8 h-8 mx-auto mb-3 opacity-20" />
            <p className="italic text-sm">Noch keine Bewertungen vorhanden. Seien Sie der Erste!</p>
          </div>
        )}
      </div>
    </div>
  );
}
