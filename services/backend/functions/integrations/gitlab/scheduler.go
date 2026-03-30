package gitlab

import (
	"context"
	"time"

	"justapps-backend/config"
	"justapps-backend/pkg/models"

	log "github.com/sirupsen/logrus"
	"github.com/uptrace/bun"
)

const schedulerTickInterval = time.Minute

func StartScheduler(ctx context.Context, db *bun.DB, conf *config.RestfulConf) {
	ticker := time.NewTicker(schedulerTickInterval)

	go func() {
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				RunScheduledSyncs(ctx, db, conf)
			}
		}
	}()
}

func RunScheduledSyncs(ctx context.Context, db *bun.DB, conf *config.RestfulConf) {
	providers, err := ListProviderRuntimes(ctx, db, conf)
	if err != nil {
		log.WithError(err).Error("GitLab scheduler: failed to load providers")
		return
	}

	providerByKey := make(map[string]ProviderRuntime, len(providers))
	for _, provider := range providers {
		providerByKey[provider.Key] = provider
	}

	links := make([]models.GitLabAppLink, 0)
	if err := db.NewSelect().Model(&links).Scan(ctx); err != nil {
		log.WithError(err).Error("GitLab scheduler: failed to load app links")
		return
	}

	now := time.Now().UTC()
	for index := range links {
		link := &links[index]
		provider, ok := providerByKey[link.ProviderKey]
		if !ok || !provider.Enabled || !provider.AutoSyncEnabled {
			continue
		}
		interval := time.Duration(provider.SyncIntervalMinutes) * time.Minute
		if interval <= 0 {
			interval = 15 * time.Minute
		}
		if !link.LastSyncedAt.IsZero() && now.Sub(link.LastSyncedAt) < interval {
			continue
		}

		if err := SyncAndPersist(ctx, db, provider, link); err != nil {
			log.WithError(err).WithField("appId", link.AppID).Warn("GitLab scheduler: sync failed")
		}
	}
}
