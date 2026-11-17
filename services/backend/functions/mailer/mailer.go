// Package mailer sends mail over the platform's SMTP server.
package mailer

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/tls"
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
	"mime"
	"mime/quotedprintable"
	"net"
	"net/mail"
	"net/smtp"
	"strconv"
	"strings"
	"time"

	"justapps-backend/config"
	aifunc "justapps-backend/functions/ai"
	"justapps-backend/pkg/models"

	"github.com/uptrace/bun"
)

const (
	SecurityStartTLS = "starttls"
	SecurityTLS      = "tls"
	SecurityNone     = "none"
)

var ErrNotConfigured = errors.New("mail is not configured")

// Message is one mail to one recipient, as plain text and HTML.
type Message struct {
	To      string
	Subject string
	Text    string
	HTML    string
}

// Sender holds a live configuration with the decrypted password.
type Sender struct {
	settings models.MailSettings
	password string
}

// LoadSettings reads the one configuration, or a disabled default.
func LoadSettings(ctx context.Context, db *bun.DB) (models.MailSettings, error) {
	settings := models.MailSettings{ID: "default", Port: 587, Security: SecurityStartTLS, DigestWeekday: 1, DigestHour: 8}
	err := db.NewSelect().Model(&settings).Where("id = 'default'").Scan(ctx)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return settings, err
	}
	return settings, nil
}

// EncryptPassword encrypts an SMTP password with the same secret as provider tokens.
func EncryptPassword(conf *config.RestfulConf, password string) (string, string, string, error) {
	return aifunc.EncryptProviderToken(conf, password)
}

// NewSender checks that the configuration is complete and decrypts the password.
func NewSender(conf *config.RestfulConf, settings models.MailSettings) (*Sender, error) {
	if !settings.Enabled || strings.TrimSpace(settings.Host) == "" || strings.TrimSpace(settings.FromAddress) == "" {
		return nil, ErrNotConfigured
	}
	password, err := aifunc.DecryptProviderToken(conf, settings.EncryptedPassword, settings.PasswordNonce, settings.PasswordKeyVersion)
	if err != nil {
		return nil, fmt.Errorf("decrypt smtp password: %w", err)
	}
	return &Sender{settings: settings, password: password}, nil
}

// Send delivers one message over a fresh connection.
func (s *Sender) Send(msg Message) error {
	if _, err := mail.ParseAddress(msg.To); err != nil {
		return fmt.Errorf("invalid recipient %q: %w", msg.To, err)
	}
	client, err := s.dial()
	if err != nil {
		return err
	}
	defer client.Close()

	if s.settings.Username != "" {
		if err := client.Auth(smtp.PlainAuth("", s.settings.Username, s.password, s.settings.Host)); err != nil {
			return fmt.Errorf("smtp auth: %w", err)
		}
	}
	if err := client.Mail(s.settings.FromAddress); err != nil {
		return fmt.Errorf("smtp MAIL FROM: %w", err)
	}
	if err := client.Rcpt(msg.To); err != nil {
		return fmt.Errorf("smtp RCPT TO: %w", err)
	}
	writer, err := client.Data()
	if err != nil {
		return fmt.Errorf("smtp DATA: %w", err)
	}
	if _, err := writer.Write(s.build(msg)); err != nil {
		return fmt.Errorf("write message: %w", err)
	}
	if err := writer.Close(); err != nil {
		return fmt.Errorf("finish message: %w", err)
	}
	return client.Quit()
}

func (s *Sender) dial() (*smtp.Client, error) {
	addr := net.JoinHostPort(s.settings.Host, strconv.Itoa(s.settings.Port))
	tlsConfig := &tls.Config{ServerName: s.settings.Host, MinVersion: tls.VersionTLS12}
	dialer := &net.Dialer{Timeout: 15 * time.Second}

	if s.settings.Security == SecurityTLS {
		conn, err := tls.DialWithDialer(dialer, "tcp", addr, tlsConfig)
		if err != nil {
			return nil, fmt.Errorf("connect to %s: %w", addr, err)
		}
		return smtp.NewClient(conn, s.settings.Host)
	}

	conn, err := dialer.Dial("tcp", addr)
	if err != nil {
		return nil, fmt.Errorf("connect to %s: %w", addr, err)
	}
	client, err := smtp.NewClient(conn, s.settings.Host)
	if err != nil {
		return nil, err
	}
	if s.settings.Security == SecurityStartTLS {
		if err := client.StartTLS(tlsConfig); err != nil {
			client.Close()
			return nil, fmt.Errorf("starttls: %w", err)
		}
	}
	return client, nil
}

func (s *Sender) build(msg Message) []byte {
	from := mail.Address{Name: s.settings.FromName, Address: s.settings.FromAddress}
	boundary := randomBoundary()
	var b bytes.Buffer
	header := func(key, value string) { fmt.Fprintf(&b, "%s: %s\r\n", key, value) }
	header("From", from.String())
	header("To", msg.To)
	header("Subject", mime.QEncoding.Encode("utf-8", msg.Subject))
	header("Date", time.Now().Format(time.RFC1123Z))
	header("Message-ID", fmt.Sprintf("<%s@%s>", randomBoundary(), domainOf(s.settings.FromAddress)))
	header("MIME-Version", "1.0")
	header("Auto-Submitted", "auto-generated")
	header("Content-Type", fmt.Sprintf("multipart/alternative; boundary=%q", boundary))
	b.WriteString("\r\n")

	part := func(contentType, body string) {
		fmt.Fprintf(&b, "--%s\r\nContent-Type: %s; charset=utf-8\r\nContent-Transfer-Encoding: quoted-printable\r\n\r\n", boundary, contentType)
		qp := quotedprintable.NewWriter(&b)
		_, _ = qp.Write([]byte(body))
		_ = qp.Close()
		b.WriteString("\r\n")
	}
	part("text/plain", msg.Text)
	if msg.HTML != "" {
		part("text/html", msg.HTML)
	}
	fmt.Fprintf(&b, "--%s--\r\n", boundary)
	return b.Bytes()
}

func randomBoundary() string {
	buf := make([]byte, 12)
	_, _ = rand.Read(buf)
	return hex.EncodeToString(buf)
}

func domainOf(address string) string {
	if _, domain, ok := strings.Cut(address, "@"); ok && domain != "" {
		return domain
	}
	return "justapps.local"
}
