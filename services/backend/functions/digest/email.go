package digest

import (
	"bytes"
	"fmt"
	"html/template"
	"strings"
)

// Email is the summary written out for one mail.
type Email struct {
	Subject string
	Text    string
	HTML    string
}

type emailData struct {
	Digest      Digest
	StoreName   string
	SiteURL     string
	PageURL     string
	SettingsURL string
}

func (d emailData) AppURL(id string) string {
	return d.SiteURL + "/apps/" + id
}

// fieldLabels are the edited parts as a reader would name them.
var fieldLabels = map[string]string{
	"name":         "Name",
	"description":  "Beschreibung",
	"icon":         "Symbol",
	"docs":         "Dokumentation",
	"installation": "Installation",
	"links":        "Links",
	"categories":   "Kategorien und Tags",
	"techStack":    "Technologien",
	"license":      "Lizenz",
	"status":       "Status",
	"details":      "Fachliche Details",
	"reuse":        "Nachnutzung",
	// version and changelog are shown on their own, not as a part.
}

// ChangedParts reads "Installation, Dokumentation und Links".
func ChangedParts(fields, areas []string) string {
	areaFields := map[string]string{"docs": "docs", "deployment": "installation", "metadata": "description"}
	seen := map[string]bool{}
	labels := []string{}
	for _, key := range append(append([]string{}, fields...), mapAreas(areas, areaFields)...) {
		label, ok := fieldLabels[key]
		if !ok || seen[label] {
			continue
		}
		seen[label] = true
		labels = append(labels, label)
	}
	switch len(labels) {
	case 0:
		return ""
	case 1:
		return labels[0]
	default:
		return strings.Join(labels[:len(labels)-1], ", ") + " und " + labels[len(labels)-1]
	}
}

func mapAreas(areas []string, mapping map[string]string) []string {
	out := make([]string, 0, len(areas))
	for _, area := range areas {
		if key, ok := mapping[area]; ok {
			out = append(out, key)
		}
	}
	return out
}

// WhatsNew is the one line that says what changed: the maintainer's note,
// else the release summary, else the changed parts.
func (a AppEntry) WhatsNew() string {
	switch {
	case a.Note != "":
		return a.Note
	case a.ReleaseSummary != "":
		return a.ReleaseSummary
	case ChangedParts(a.Fields, a.ChangedAreas) != "":
		return ChangedParts(a.Fields, a.ChangedAreas) + " überarbeitet"
	default:
		return a.ReleaseTitle
	}
}

// VersionLabel reads "2.3 → 2.4", or the version alone.
func (a AppEntry) VersionLabel() string {
	if a.VersionBefore != "" && a.Version != "" && a.VersionBefore != a.Version {
		return a.VersionBefore + " → " + a.Version
	}
	return a.Version
}

var emailTemplate = template.Must(template.New("digest").Parse(`<!doctype html>
<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>{{.Digest.Label}}</title></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,'Segoe UI',Inter,Arial,sans-serif;color:#262626;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:24px 12px;"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:16px;border:1px solid #e5e5e5;">
<tr><td style="padding:28px 28px 8px;">
  <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="width:24px;height:4px;background:#000000;"></td><td style="width:24px;height:4px;background:#cc0000;"></td><td style="width:24px;height:4px;background:#ddaa00;"></td></tr></table>
  <p style="margin:18px 0 4px;font-size:13px;color:#686868;">{{.StoreName}} · Wochenrückblick</p>
  <h1 style="margin:0;font-size:22px;line-height:1.3;">{{.Digest.Label}}</h1>
</td></tr>
{{if .Digest.NewApps}}<tr><td style="padding:16px 28px 0;">
  <h2 style="margin:0 0 8px;font-size:15px;">Neu im Katalog ({{len .Digest.NewApps}})</h2>
  {{range .Digest.NewApps}}<p style="margin:0 0 10px;font-size:14px;line-height:1.45;"><a href="{{$.AppURL .ID}}" style="color:#262626;font-weight:600;text-decoration:none;">{{.Name}}</a>{{if .Categories}} <span style="color:#686868;">· {{index .Categories 0}}</span>{{end}}{{if .Description}}<br><span style="color:#686868;">{{.Description}}</span>{{end}}</p>{{end}}
</td></tr>{{end}}
{{if .Digest.UpdatedApps}}<tr><td style="padding:16px 28px 0;">
  <h2 style="margin:0 0 8px;font-size:15px;">Aktualisiert ({{len .Digest.UpdatedApps}})</h2>
  {{range .Digest.UpdatedApps}}<p style="margin:0 0 10px;font-size:14px;line-height:1.45;"><a href="{{$.AppURL .ID}}" style="color:#262626;font-weight:600;text-decoration:none;">{{.Name}}</a>{{if .VersionLabel}} <span style="color:#686868;">· {{.VersionLabel}}</span>{{end}}{{if .WhatsNew}}<br><span style="color:#262626;">{{.WhatsNew}}</span>{{end}}{{if .Changelog}}<br><span style="color:#686868;white-space:pre-line;">{{.Changelog}}</span>{{end}}</p>{{end}}
</td></tr>{{end}}
{{if .Digest.Questions}}<tr><td style="padding:16px 28px 0;">
  <h2 style="margin:0 0 8px;font-size:15px;">Neue Fragen</h2>
  {{range .Digest.Questions}}<p style="margin:0 0 10px;font-size:14px;line-height:1.45;">„{{.Question}}“<br><a href="{{$.AppURL .AppID}}" style="color:#686868;text-decoration:none;">{{.AppName}}</a><span style="color:#686868;"> · {{.Answers}} Antworten</span></p>{{end}}
</td></tr>{{end}}
{{if or .Digest.Community.Questions .Digest.Community.Answers .Digest.Community.Ratings}}<tr><td style="padding:16px 28px 0;">
  <h2 style="margin:0 0 8px;font-size:15px;">Community</h2>
  <p style="margin:0;font-size:14px;color:#686868;">{{.Digest.Community.Questions}} neue Fragen · {{.Digest.Community.Answers}} Antworten · {{.Digest.Community.Ratings}} Bewertungen</p>
</td></tr>{{end}}
<tr><td style="padding:24px 28px 28px;">
  <a href="{{.PageURL}}" style="display:inline-block;background:#262626;color:#fafafa;text-decoration:none;font-size:14px;font-weight:600;padding:10px 18px;border-radius:10px;">Im Katalog ansehen</a>
</td></tr>
</table>
<p style="max-width:600px;margin:16px auto 0;font-size:12px;line-height:1.5;color:#8a8a8a;">Sie erhalten diese Mail, weil Sie den Wochenrückblick in Ihrem Profil abonniert haben. <a href="{{.SettingsURL}}" style="color:#8a8a8a;">Abbestellen</a></p>
</td></tr></table>
</body></html>`))

// RenderEmail writes the summary as a mail with links back to the site.
func RenderEmail(d Digest, storeName, siteURL string) (Email, error) {
	siteURL = strings.TrimRight(strings.TrimSpace(siteURL), "/")
	if storeName == "" {
		storeName = "JustApps"
	}
	data := emailData{
		Digest:      d,
		StoreName:   storeName,
		SiteURL:     siteURL,
		PageURL:     siteURL + "/neuigkeiten?woche=" + d.Week,
		SettingsURL: siteURL + "/profil#benachrichtigungen",
	}

	var html bytes.Buffer
	if err := emailTemplate.Execute(&html, data); err != nil {
		return Email{}, err
	}

	var text strings.Builder
	fmt.Fprintf(&text, "%s · Wochenrückblick\n%s\n\n", storeName, d.Label)
	if len(d.NewApps) > 0 {
		fmt.Fprintf(&text, "Neu im Katalog (%d)\n", len(d.NewApps))
		for _, app := range d.NewApps {
			fmt.Fprintf(&text, "- %s: %s\n", app.Name, data.AppURL(app.ID))
		}
		text.WriteString("\n")
	}
	if len(d.UpdatedApps) > 0 {
		fmt.Fprintf(&text, "Aktualisiert (%d)\n", len(d.UpdatedApps))
		for _, app := range d.UpdatedApps {
			line := app.Name
			if label := app.VersionLabel(); label != "" {
				line += " (" + label + ")"
			}
			if news := app.WhatsNew(); news != "" {
				line += " – " + news
			}
			fmt.Fprintf(&text, "- %s: %s\n", line, data.AppURL(app.ID))
		}
		text.WriteString("\n")
	}
	if len(d.Questions) > 0 {
		text.WriteString("Neue Fragen\n")
		for _, q := range d.Questions {
			fmt.Fprintf(&text, "- „%s“ (%s): %s\n", q.Question, q.AppName, data.AppURL(q.AppID))
		}
		text.WriteString("\n")
	}
	if d.Community.Questions+d.Community.Answers+d.Community.Ratings > 0 {
		fmt.Fprintf(&text, "Community: %d neue Fragen, %d Antworten, %d Bewertungen\n\n", d.Community.Questions, d.Community.Answers, d.Community.Ratings)
	}
	fmt.Fprintf(&text, "Im Katalog ansehen: %s\n\nAbbestellen: %s\n", data.PageURL, data.SettingsURL)

	return Email{
		Subject: fmt.Sprintf("%s · Wochenrückblick %s", storeName, d.Label),
		Text:    text.String(),
		HTML:    html.String(),
	}, nil
}
