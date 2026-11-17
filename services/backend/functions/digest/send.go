package digest

import (
	"context"
	"errors"
	"fmt"
	"time"

	"justapps-backend/config"
	"justapps-backend/functions/mailer"
	"justapps-backend/pkg/models"

	log "github.com/sirupsen/logrus"
	"github.com/uptrace/bun"
)

// Result says how a send went.
type Result struct {
	Week       string `json:"week"`
	Recipients int    `json:"recipients"`
	Failed     int    `json:"failed"`
	Skipped    bool   `json:"skipped"`
	Reason     string `json:"reason,omitempty"`
}

type recipient struct {
	Email string `bun:"email"`
}

// Send mails the summary of a week to every user who subscribed to it. A week
// with nothing in it is skipped unless force is set.
func Send(ctx context.Context, db *bun.DB, conf *config.RestfulConf, week Week, force bool) (Result, error) {
	result := Result{Week: week.String()}
	settings, err := mailer.LoadSettings(ctx, db)
	if err != nil {
		return result, err
	}
	sender, err := mailer.NewSender(conf, settings)
	if err != nil {
		return result, err
	}

	d, err := Build(ctx, db, week, time.Now())
	if err != nil {
		return result, err
	}
	if d.Empty() && !force {
		result.Skipped = true
		result.Reason = "In dieser Woche ist nichts passiert."
		return result, nil
	}

	var platform models.PlatformSettings
	_ = db.NewSelect().Model(&platform).Where("id = ?", "default").Scan(ctx)
	email, err := RenderEmail(d, platform.StoreName, settings.SiteURL)
	if err != nil {
		return result, err
	}

	var recipients []recipient
	if err := db.NewRaw(`
		SELECT u.email FROM users AS u
		JOIN user_update_preferences AS p ON p.user_id = u.id
		WHERE p.weekly_digest = true AND u.disabled = false AND u.email <> ''`).Scan(ctx, &recipients); err != nil {
		return result, err
	}

	for _, r := range recipients {
		if err := sender.Send(mailer.Message{To: r.Email, Subject: email.Subject, Text: email.Text, HTML: email.HTML}); err != nil {
			result.Failed++
			log.WithError(err).Warn("weekly digest: a mail could not be sent")
			continue
		}
		result.Recipients++
	}

	now := time.Now()
	if _, err := db.NewUpdate().Model((*models.MailSettings)(nil)).
		Set("last_digest_week = ?", week.String()).
		Set("last_digest_sent_at = ?", now).
		Set("last_digest_recipients = ?", result.Recipients).
		Where("id = 'default'").
		Exec(ctx); err != nil {
		return result, err
	}
	if result.Failed > 0 && result.Recipients == 0 {
		return result, fmt.Errorf("no mail could be sent (%d failed)", result.Failed)
	}
	return result, nil
}

// StartScheduler sends last week's summary once, at the configured weekday
// and hour (German time).
func StartScheduler(ctx context.Context, db *bun.DB, conf *config.RestfulConf) {
	ticker := time.NewTicker(10 * time.Minute)
	go func() {
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				runScheduled(ctx, db, conf, time.Now())
			}
		}
	}()
}

func runScheduled(ctx context.Context, db *bun.DB, conf *config.RestfulConf, now time.Time) {
	settings, err := mailer.LoadSettings(ctx, db)
	if err != nil || !settings.Enabled || !settings.DigestEnabled {
		return
	}
	local := now.In(Location)
	weekday := (int(local.Weekday())+6)%7 + 1 // 1 = Monday … 7 = Sunday
	if weekday != settings.DigestWeekday || local.Hour() < settings.DigestHour {
		return
	}
	week := WeekOf(local).Previous()
	if settings.LastDigestWeek == week.String() {
		return
	}
	result, err := Send(ctx, db, conf, week, false)
	if err != nil && !errors.Is(err, mailer.ErrNotConfigured) {
		log.WithError(err).Error("weekly digest: sending failed")
		return
	}
	if result.Skipped {
		// Remember the week anyway, so an empty week is not retried every ten minutes.
		_, _ = db.NewUpdate().Model((*models.MailSettings)(nil)).Set("last_digest_week = ?", week.String()).Where("id = 'default'").Exec(ctx)
	}
	log.WithField("week", week.String()).WithField("recipients", result.Recipients).Info("weekly digest sent")
}
