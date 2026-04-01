package linkprober

import (
	"context"
	"net/http"
	"time"

	"justapps-backend/pkg/models"

	log "github.com/sirupsen/logrus"
	"github.com/uptrace/bun"
)

const (
	probeTimeout      = 10 * time.Second
	schedulerInterval = 2 * time.Minute
)

var httpClient = &http.Client{
	Timeout: probeTimeout,
	CheckRedirect: func(req *http.Request, via []*http.Request) error {
		if len(via) >= 5 {
			return http.ErrUseLastResponse
		}
		return nil
	},
}

// LinkProbeResult is the DB model for a single URL probe outcome.
type LinkProbeResult struct {
	bun.BaseModel `bun:"table:link_probe_results,alias:lpr"`

	ID         string    `bun:"id,pk,default:gen_random_uuid()"`
	AppID      string    `bun:"app_id,notnull"`
	URL        string    `bun:"url,notnull"`
	StatusCode int       `bun:"status_code,notnull"`
	Reachable  bool      `bun:"reachable,notnull"`
	ProbedAt   time.Time `bun:"probed_at,notnull,default:now()"`
}

// StartScheduler starts the background link-probing loop.
func StartScheduler(ctx context.Context, db *bun.DB) {
	ticker := time.NewTicker(schedulerInterval)
	go func() {
		defer ticker.Stop()
		// Run once immediately on startup, then on each tick.
		runProbes(ctx, db)
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				runProbes(ctx, db)
			}
		}
	}()
}

func runProbes(ctx context.Context, db *bun.DB) {
	var settings models.PlatformSettings
	if err := db.NewSelect().Model(&settings).Where("id = ?", "default").Scan(ctx); err != nil {
		log.WithError(err).Warn("LinkProber: could not load platform settings")
		return
	}
	if !settings.EnableLinkProbing {
		return
	}

	apps := make([]models.Apps, 0)
	if err := db.NewSelect().Model(&apps).Scan(ctx); err != nil {
		log.WithError(err).Error("LinkProber: could not load apps")
		return
	}

	for i := range apps {
		app := &apps[i]
		if app.SkipLinkProbe {
			resetProbeState(ctx, db, app.ID)
			continue
		}

		urls := collectURLs(app)
		if len(urls) == 0 {
			resetProbeState(ctx, db, app.ID)
			continue
		}

		results := make([]LinkProbeResult, 0, len(urls))
		anyReachable := false
		anyUnreachable := false

		for _, u := range urls {
			code, reachable := probeURL(u)
			results = append(results, LinkProbeResult{
				AppID:      app.ID,
				URL:        u,
				StatusCode: code,
				Reachable:  reachable,
				ProbedAt:   time.Now().UTC(),
			})
			if reachable {
				anyReachable = true
			} else {
				anyUnreachable = true
			}
		}

		// Upsert results (delete old + insert new for this app)
		if _, err := db.NewDelete().Model((*LinkProbeResult)(nil)).Where("app_id = ?", app.ID).Exec(ctx); err != nil {
			log.WithError(err).WithField("appId", app.ID).Warn("LinkProber: could not clear old results")
			continue
		}
		if len(results) > 0 {
			if _, err := db.NewInsert().Model(&results).Exec(ctx); err != nil {
				log.WithError(err).WithField("appId", app.ID).Warn("LinkProber: could not insert results")
				continue
			}
		}

		// Derive overall status
		status := "unknown"
		switch {
		case anyReachable && !anyUnreachable:
			status = "ok"
		case anyReachable && anyUnreachable:
			status = "partial"
		case !anyReachable:
			status = "down"
		}

		if _, err := db.NewUpdate().Model((*models.Apps)(nil)).
			Set("link_probe_status = ?", status).
			Where("id = ?", app.ID).
			Exec(ctx); err != nil {
			log.WithError(err).WithField("appId", app.ID).Warn("LinkProber: could not update link_probe_status")
		}
	}
}

func resetProbeState(ctx context.Context, db *bun.DB, appID string) {
	if _, err := db.NewDelete().Model((*LinkProbeResult)(nil)).Where("app_id = ?", appID).Exec(ctx); err != nil {
		log.WithError(err).WithField("appId", appID).Warn("LinkProber: could not clear probe results")
	}

	if _, err := db.NewUpdate().Model((*models.Apps)(nil)).
		Set("link_probe_status = ?", "unknown").
		Where("id = ?", appID).
		Exec(ctx); err != nil {
		log.WithError(err).WithField("appId", appID).Warn("LinkProber: could not reset link_probe_status")
	}
}

// collectURLs gathers all live-demo and custom-link URLs from an app.
func collectURLs(app *models.Apps) []string {
	seen := make(map[string]struct{})
	var urls []string
	add := func(u string) {
		if u != "" && u != "#" {
			if _, ok := seen[u]; !ok {
				seen[u] = struct{}{}
				urls = append(urls, u)
			}
		}
	}
	for _, d := range app.LiveDemos {
		add(d.URL)
	}
	add(app.LiveUrl)
	return urls
}

// probeURL sends a HEAD (fallback GET) to the URL and returns the status code + reachability.
func probeURL(url string) (int, bool) {
	req, err := http.NewRequest(http.MethodHead, url, nil)
	if err != nil {
		return 0, false
	}
	req.Header.Set("User-Agent", "JustApps-LinkProber/1.0")

	resp, err := httpClient.Do(req)
	if err != nil {
		// Retry with GET in case the server refuses HEAD
		req2, err2 := http.NewRequest(http.MethodGet, url, nil)
		if err2 != nil {
			return 0, false
		}
		req2.Header.Set("User-Agent", "JustApps-LinkProber/1.0")
		resp2, err3 := httpClient.Do(req2)
		if err3 != nil {
			return 0, false
		}
		defer resp2.Body.Close()
		return resp2.StatusCode, resp2.StatusCode < 500
	}
	defer resp.Body.Close()
	return resp.StatusCode, resp.StatusCode < 500
}
