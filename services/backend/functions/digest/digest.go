package digest

import (
	"context"
	"time"

	"github.com/uptrace/bun"
)

// PublicAppSQL keeps the summary to what every visitor of the catalog can
// see: no drafts, no hidden apps and nothing from a private Space. The mail
// goes to many people at once, so it cannot be tailored to each reader.
const PublicAppSQL = "a.space_id IS NULL AND LOWER(TRIM(COALESCE(a.status, ''))) NOT IN ('draft', 'entwurf') AND a.is_hidden = false"

type AppEntry struct {
	ID          string    `json:"id" bun:"id"`
	Name        string    `json:"name" bun:"name"`
	Icon        string    `json:"icon" bun:"icon"`
	Description string    `json:"description" bun:"description"`
	Categories  []string  `json:"categories" bun:"categories,array"`
	At          time.Time `json:"at" bun:"at"`
	// What changed, from the app's release notes in the week, when there are any.
	ReleaseTitle   string `json:"releaseTitle,omitempty" bun:"release_title"`
	ReleaseSummary string `json:"releaseSummary,omitempty" bun:"release_summary"`
	Version        string `json:"version,omitempty" bun:"version"`
	// Which parts changed (docs, deployment, metadata), across the week's release notes.
	ChangedAreas []string `json:"changedAreas,omitempty" bun:"changed_areas,array"`
	// What was edited in the week (see appupdates.ChangedFields).
	Fields []string `json:"fields,omitempty" bun:"fields,array"`
	// The version at the start of the week, when it moved; Version is the new one.
	VersionBefore string `json:"versionBefore,omitempty" bun:"version_before"`
	// The maintainer's own "what's new" line, the latest of the week.
	Note string `json:"note,omitempty" bun:"note"`
	// The app's changelog, when it or the version changed in the week.
	Changelog string `json:"changelog,omitempty" bun:"changelog"`
}

// QuestionEntry is a question asked in the week about a public app.
type QuestionEntry struct {
	ID        string    `json:"id" bun:"id"`
	AppID     string    `json:"appId" bun:"app_id"`
	AppName   string    `json:"appName" bun:"app_name"`
	AppIcon   string    `json:"appIcon" bun:"app_icon"`
	Question  string    `json:"question" bun:"question"`
	Answers   int       `json:"answers" bun:"answers"`
	CreatedAt time.Time `json:"createdAt" bun:"created_at"`
}

type Community struct {
	Questions int `json:"questions"`
	Answers   int `json:"answers"`
	Ratings   int `json:"ratings"`
}

type Digest struct {
	Week        string          `json:"week"`
	Label       string          `json:"label"`
	Start       time.Time       `json:"start"`
	End         time.Time       `json:"end"`
	Previous    string          `json:"previous"`
	Next        string          `json:"next,omitempty"`
	Current     bool            `json:"current"`
	NewApps     []AppEntry      `json:"newApps"`
	UpdatedApps []AppEntry      `json:"updatedApps"`
	Community   Community       `json:"community"`
	Questions   []QuestionEntry `json:"questions"`
	TotalApps   int             `json:"totalApps"`
}

// Empty is true when nothing happened that is worth a mail.
func (d Digest) Empty() bool {
	return len(d.NewApps) == 0 && len(d.UpdatedApps) == 0 && d.Community.Questions == 0 && d.Community.Answers == 0
}

// Build gathers what happened in the public catalog during one week.
func Build(ctx context.Context, db *bun.DB, week Week, now time.Time) (Digest, error) {
	start, end := week.Start(), week.End()
	current := WeekOf(now)
	digest := Digest{
		Week:        week.String(),
		Label:       week.Label(),
		Start:       start,
		End:         end,
		Previous:    week.Previous().String(),
		Current:     week == current,
		NewApps:     []AppEntry{},
		UpdatedApps: []AppEntry{},
		Questions:   []QuestionEntry{},
	}
	if next := week.Next(); !next.Start().After(now) {
		digest.Next = next.String()
	}

	if err := db.NewRaw(`
		SELECT a.id, a.name, a.icon, a.description, a.categories, a.created_at AS at
		FROM apps AS a
		WHERE `+PublicAppSQL+` AND a.created_at >= ? AND a.created_at < ?
		ORDER BY a.created_at DESC`, start, end).Scan(ctx, &digest.NewApps); err != nil {
		return Digest{}, err
	}

	// Apps created before the week that changed during it in a way a reader
	// would notice: a recorded edit (app_changes) or a release from the
	// repository sync. A save that only touched platform settings leaves no
	// record, so it does not show up here.
	if err := db.NewRaw(`
		SELECT a.id, a.name, a.icon, a.description, a.categories,
		       GREATEST(COALESCE(ch.last_at, 'epoch'), COALESCE(r.published_at, 'epoch')) AS at,
		       COALESCE(r.title, '') AS release_title, COALESCE(r.summary, '') AS release_summary,
		       COALESCE(areas.list, ARRAY[]::text[]) AS changed_areas,
		       COALESCE(ch.fields, ARRAY[]::text[]) AS fields,
		       COALESCE(ch.version_before, '') AS version_before,
		       COALESCE(NULLIF(ch.version_after, ''), r.version, '') AS version,
		       COALESCE(ch.note, '') AS note,
		       CASE WHEN 'changelog' = ANY(COALESCE(ch.fields, ARRAY[]::text[])) OR COALESCE(ch.version_before, '') <> COALESCE(ch.version_after, '')
		            THEN LEFT(a.changelog, 600) ELSE '' END AS changelog
		FROM apps AS a
		LEFT JOIN LATERAL (
			SELECT
			  MAX(c.created_at) AS last_at,
			  (SELECT ARRAY_AGG(DISTINCT f ORDER BY f) FROM app_changes AS c2, UNNEST(c2.fields) AS f
			     WHERE c2.app_id = a.id AND c2.created_at >= ? AND c2.created_at < ?) AS fields,
			  (ARRAY_AGG(c.version_before ORDER BY c.created_at ASC))[1] AS version_before,
			  (ARRAY_AGG(c.version_after ORDER BY c.created_at DESC))[1] AS version_after,
			  (ARRAY_AGG(c.note ORDER BY c.created_at DESC) FILTER (WHERE c.note <> ''))[1] AS note
			FROM app_changes AS c
			WHERE c.app_id = a.id AND c.created_at >= ? AND c.created_at < ?
		) AS ch ON ch.last_at IS NOT NULL
		LEFT JOIN LATERAL (
			SELECT ar.title, ar.summary, ar.version, ar.published_at FROM app_releases AS ar
			WHERE ar.app_id = a.id AND ar.published_at >= ? AND ar.published_at < ?
			ORDER BY ar.published_at DESC LIMIT 1
		) AS r ON true
		LEFT JOIN LATERAL (
			SELECT ARRAY_AGG(DISTINCT area ORDER BY area) AS list
			FROM app_releases AS ar, jsonb_array_elements_text(ar.changed_areas) AS area
			WHERE ar.app_id = a.id AND ar.published_at >= ? AND ar.published_at < ?
		) AS areas ON true
		WHERE `+PublicAppSQL+` AND a.created_at < ?
		  AND (ch.last_at IS NOT NULL OR r.published_at IS NOT NULL)
		ORDER BY at DESC`, start, end, start, end, start, end, start, end, start).Scan(ctx, &digest.UpdatedApps); err != nil {
		return Digest{}, err
	}

	if err := db.NewRaw(`
		SELECT
		  (SELECT COUNT(*) FROM faq_questions AS q JOIN apps AS a ON a.id = q.app_id WHERE `+PublicAppSQL+` AND q.created_at >= ? AND q.created_at < ?) AS questions,
		  (SELECT COUNT(*) FROM faq_answers AS fa JOIN faq_questions AS q ON q.id = fa.question_id JOIN apps AS a ON a.id = q.app_id WHERE `+PublicAppSQL+` AND fa.created_at >= ? AND fa.created_at < ?) AS answers,
		  (SELECT COUNT(*) FROM ratings AS rt JOIN apps AS a ON a.id = rt.app_id WHERE `+PublicAppSQL+` AND rt.created_at >= ? AND rt.created_at < ?) AS ratings
		`, start, end, start, end, start, end).Scan(ctx, &digest.Community.Questions, &digest.Community.Answers, &digest.Community.Ratings); err != nil {
		return Digest{}, err
	}

	if err := db.NewRaw(`
		SELECT q.id::text AS id, a.id AS app_id, a.name AS app_name, a.icon AS app_icon, q.question, q.created_at,
		       (SELECT COUNT(*) FROM faq_answers AS fa WHERE fa.question_id = q.id) AS answers
		FROM faq_questions AS q JOIN apps AS a ON a.id = q.app_id
		WHERE `+PublicAppSQL+` AND q.created_at >= ? AND q.created_at < ?
		ORDER BY q.created_at DESC LIMIT 5`, start, end).Scan(ctx, &digest.Questions); err != nil {
		return Digest{}, err
	}

	if err := db.NewRaw(`SELECT COUNT(*) FROM apps AS a WHERE `+PublicAppSQL).Scan(ctx, &digest.TotalApps); err != nil {
		return Digest{}, err
	}

	return digest, nil
}
