package platform

import (
	"errors"
	"fmt"
	"net/http"
	"net/mail"
	"net/url"
	"strings"
	"time"

	"justapps-backend/config"
	"justapps-backend/functions/digest"
	"justapps-backend/functions/httperror"
	"justapps-backend/functions/mailer"
	"justapps-backend/pkg/audit"
	"justapps-backend/pkg/models"

	"github.com/gin-gonic/gin"
	"github.com/uptrace/bun"
)

type mailSettingsResponse struct {
	models.MailSettings
	PasswordConfigured bool `json:"passwordConfigured"`
}

type updateMailSettingsRequest struct {
	Enabled       bool   `json:"enabled"`
	Host          string `json:"host"`
	Port          int    `json:"port"`
	Security      string `json:"security"`
	Username      string `json:"username"`
	Password      string `json:"password"`
	ClearPassword bool   `json:"clearPassword"`
	FromAddress   string `json:"fromAddress"`
	FromName      string `json:"fromName"`
	SiteURL       string `json:"siteUrl"`
	DigestEnabled bool   `json:"digestEnabled"`
	DigestWeekday int    `json:"digestWeekday"`
	DigestHour    int    `json:"digestHour"`
}

func mailResponse(settings models.MailSettings) mailSettingsResponse {
	return mailSettingsResponse{MailSettings: settings, PasswordConfigured: settings.EncryptedPassword != ""}
}

// GetMailSettings returns the SMTP configuration without the password.
func GetMailSettings(c *gin.Context, db *bun.DB) {
	settings, err := mailer.LoadSettings(c.Request.Context(), db)
	if err != nil {
		httperror.InternalServerError(c, "E-Mail-Einstellungen konnten nicht geladen werden", err)
		return
	}
	c.JSON(http.StatusOK, mailResponse(settings))
}

// UpdateMailSettings saves the SMTP configuration. An empty password keeps the stored one.
func UpdateMailSettings(c *gin.Context, db *bun.DB) {
	var req updateMailSettingsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httperror.StatusBadRequest(c, "Ungültige E-Mail-Einstellungen", err)
		return
	}
	req.Host = strings.TrimSpace(req.Host)
	req.FromAddress = strings.TrimSpace(req.FromAddress)
	req.SiteURL = strings.TrimRight(strings.TrimSpace(req.SiteURL), "/")
	switch req.Security {
	case mailer.SecurityStartTLS, mailer.SecurityTLS, mailer.SecurityNone:
	default:
		httperror.StatusBadRequest(c, "Unbekannte Verschlüsselung", errors.New("security must be starttls, tls or none"))
		return
	}
	if req.Port < 1 || req.Port > 65535 {
		httperror.StatusBadRequest(c, "Ungültiger Port", errors.New("port out of range"))
		return
	}
	if req.FromAddress != "" {
		if _, err := mail.ParseAddress(req.FromAddress); err != nil {
			httperror.StatusBadRequest(c, "Ungültige Absenderadresse", err)
			return
		}
	}
	if req.SiteURL != "" {
		parsed, err := url.Parse(req.SiteURL)
		if err != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") || parsed.Host == "" {
			httperror.StatusBadRequest(c, "Die Adresse der Plattform muss mit http:// oder https:// beginnen", errors.New("invalid site url"))
			return
		}
	}
	if req.Enabled && (req.Host == "" || req.FromAddress == "") {
		httperror.StatusBadRequest(c, "Server und Absenderadresse sind nötig, um E-Mails zu senden", errors.New("incomplete smtp settings"))
		return
	}
	if req.DigestEnabled && req.SiteURL == "" {
		httperror.StatusBadRequest(c, "Für den Wochenrückblick wird die Adresse der Plattform benötigt", errors.New("site url required"))
		return
	}
	if req.DigestWeekday < 1 || req.DigestWeekday > 7 || req.DigestHour < 0 || req.DigestHour > 23 {
		httperror.StatusBadRequest(c, "Ungültiger Versandzeitpunkt", errors.New("weekday or hour out of range"))
		return
	}

	ctx := c.Request.Context()
	current, err := mailer.LoadSettings(ctx, db)
	if err != nil {
		httperror.InternalServerError(c, "E-Mail-Einstellungen konnten nicht geladen werden", err)
		return
	}
	next := current
	next.ID = "default"
	next.Enabled = req.Enabled
	next.Host = req.Host
	next.Port = req.Port
	next.Security = req.Security
	next.Username = strings.TrimSpace(req.Username)
	next.FromAddress = req.FromAddress
	next.FromName = strings.TrimSpace(req.FromName)
	next.SiteURL = req.SiteURL
	next.DigestEnabled = req.DigestEnabled
	next.DigestWeekday = req.DigestWeekday
	next.DigestHour = req.DigestHour
	next.UpdatedAt = time.Now()
	switch {
	case req.ClearPassword:
		next.EncryptedPassword, next.PasswordNonce, next.PasswordKeyVersion = "", "", ""
	case req.Password != "":
		encrypted, nonce, version, err := mailer.EncryptPassword(config.Config, req.Password)
		if err != nil {
			httperror.InternalServerError(c, "Das Passwort konnte nicht verschlüsselt werden", err)
			return
		}
		next.EncryptedPassword, next.PasswordNonce, next.PasswordKeyVersion = encrypted, nonce, version
	}

	if _, err := db.NewInsert().Model(&next).On("CONFLICT (id) DO UPDATE").
		Set("enabled = EXCLUDED.enabled, host = EXCLUDED.host, port = EXCLUDED.port, security = EXCLUDED.security").
		Set("username = EXCLUDED.username, encrypted_password = EXCLUDED.encrypted_password, password_nonce = EXCLUDED.password_nonce, password_key_version = EXCLUDED.password_key_version").
		Set("from_address = EXCLUDED.from_address, from_name = EXCLUDED.from_name, site_url = EXCLUDED.site_url").
		Set("digest_enabled = EXCLUDED.digest_enabled, digest_weekday = EXCLUDED.digest_weekday, digest_hour = EXCLUDED.digest_hour, updated_at = EXCLUDED.updated_at").
		Exec(ctx); err != nil {
		httperror.InternalServerError(c, "E-Mail-Einstellungen konnten nicht gespeichert werden", err)
		return
	}
	audit.WriteAudit(ctx, db, contextUserID(c), "settings.mail.update", "updated mail settings")

	saved, err := mailer.LoadSettings(ctx, db)
	if err != nil {
		httperror.InternalServerError(c, "E-Mail-Einstellungen konnten nicht geladen werden", err)
		return
	}
	c.JSON(http.StatusOK, mailResponse(saved))
}

// SendTestMail sends a short mail to the admin who asks for it.
func SendTestMail(c *gin.Context, db *bun.DB) {
	ctx := c.Request.Context()
	to := strings.TrimSpace(c.GetString("user_email"))
	if to == "" {
		httperror.StatusBadRequest(c, "Ihr Konto hat keine E-Mail-Adresse", errors.New("no email on account"))
		return
	}
	settings, err := mailer.LoadSettings(ctx, db)
	if err != nil {
		httperror.InternalServerError(c, "E-Mail-Einstellungen konnten nicht geladen werden", err)
		return
	}
	sender, err := mailer.NewSender(config.Config, settings)
	if err != nil {
		httperror.StatusBadRequest(c, "E-Mail-Versand ist nicht vollständig eingerichtet und eingeschaltet", err)
		return
	}
	if err := sender.Send(mailer.Message{
		To:      to,
		Subject: "Test-Mail von JustApps",
		Text:    "Diese Mail bestätigt, dass der E-Mail-Versand von JustApps funktioniert.",
	}); err != nil {
		httperror.StatusBadGateway(c, "Die Test-Mail konnte nicht gesendet werden: "+err.Error(), err)
		return
	}
	audit.WriteAudit(ctx, db, contextUserID(c), "settings.mail.test", "sent a test mail")
	c.JSON(http.StatusOK, gin.H{"to": to})
}

// SendDigestNow mails a week's summary right away, by default last week's.
func SendDigestNow(c *gin.Context, db *bun.DB) {
	week := digest.WeekOf(time.Now()).Previous()
	if value := c.Query("week"); value != "" {
		parsed, err := digest.ParseWeek(value)
		if err != nil {
			httperror.StatusBadRequest(c, "Ungültige Woche", err)
			return
		}
		week = parsed
	}
	result, err := digest.Send(c.Request.Context(), db, config.Config, week, true)
	if err != nil {
		if errors.Is(err, mailer.ErrNotConfigured) {
			httperror.StatusBadRequest(c, "E-Mail-Versand ist nicht vollständig eingerichtet und eingeschaltet", err)
			return
		}
		httperror.StatusBadGateway(c, "Der Wochenrückblick konnte nicht versendet werden: "+err.Error(), err)
		return
	}
	audit.WriteAudit(c.Request.Context(), db, contextUserID(c), "settings.mail.digest", "sent the weekly summary for "+week.String())
	c.JSON(http.StatusOK, result)
}

// GetDigest is the summary of one week of the public catalog, the current one by default.
func GetDigest(c *gin.Context, db *bun.DB) {
	if !ensureStoreAccess(c, db) {
		return
	}
	now := time.Now()
	week := digest.WeekOf(now)
	if value := c.Query("week"); value != "" {
		parsed, err := digest.ParseWeek(value)
		if err != nil {
			httperror.StatusBadRequest(c, "Ungültige Woche", err)
			return
		}
		if parsed.Start().After(now) {
			httperror.StatusBadRequest(c, "Diese Woche liegt in der Zukunft", errors.New("future week"))
			return
		}
		week = parsed
	}
	d, err := digest.Build(c.Request.Context(), db, week, now)
	if err != nil {
		httperror.InternalServerError(c, "Der Wochenrückblick konnte nicht geladen werden", err)
		return
	}
	c.JSON(http.StatusOK, d)
}

func ensureStoreAccess(c *gin.Context, db *bun.DB) bool {
	if contextUserID(c) != "" {
		return true
	}
	var settings models.PlatformSettings
	if err := db.NewSelect().Model(&settings).Where("id = ?", "default").Scan(c.Request.Context()); err == nil && settings.RequireAuthForAppStore {
		httperror.Unauthorized(c, "Anmeldung erforderlich", errors.New("app store requires authentication"))
		return false
	}
	return true
}

// contextUserID is the signed-in user's id as text, or "" for a visitor.
// The middlewares store it as a uuid.UUID, which c.GetString does not read.
func contextUserID(c *gin.Context) string {
	value, ok := c.Get("user_id")
	if !ok || value == nil {
		return ""
	}
	return fmt.Sprint(value)
}
