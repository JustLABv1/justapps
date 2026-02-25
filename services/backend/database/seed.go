package database

import (
	"app-store-backend/pkg/models"
	"context"

	log "github.com/sirupsen/logrus"
	"github.com/uptrace/bun"
)

func SeedDatabase(db *bun.DB) {
	ctx := context.Background()

	// Check if apps already exist
	exists, err := db.NewSelect().Model((*models.Apps)(nil)).Exists(ctx)
	if err != nil {
		log.Errorf("Failed to check if apps exist: %v", err)
		return
	}

	if exists {
		log.Info("Apps already exist in database, skipping seed.")
		return
	}

	log.Info("Seeding database with default apps...")

	apps := []models.Apps{
		{
			ID:          "digi-sign-pro",
			Name:        "DigiSign Pro",
			Description: "Digital signatures and automated workflow validation for government officials.",
			Categories:  []string{"Verwaltung"},
			Icon:        "✍️",
			TechStack:   []string{"Next.js", "Redis", "WebCrypto API"},
			License:     "EUPL-1.2",
			DockerRepo:  "ghcr.io/bund/digi-sign:latest",
			HelmRepo:    "https://charts.bund.de",
			LiveUrl:     "https://demo.digisign-pro.bund.de",
			LiveDemos: []models.LiveDemo{
				{Label: "Produktion", URL: "https://pro.digisign-pro.bund.de"},
				{Label: "Staging", URL: "https://staging.digisign-pro.bund.de"},
			},
			MarkdownContent: "# DigiSign Pro\nDigital signatures for the public sector. Supports eIDAS QES.",
			Focus:           "Digitale Signatur / Workflows",
			AppType:         "Fullstack Webanwendung",
			UseCase:         "Rechtssichere digitale Unterschrift im Verwaltungskontext",
			Visualization:   "Dashboard mit Signatur-Status",
			Deployment:      "Kubernetes via Helm",
			Infrastructure:  "On-Premise oder Cloud-agnostisch",
			Database:        "Redis für Caching, Signatur-Logs in S3",
			Status:          "Graduated",
			Transferability: "Ja, für alle Ressorts mit Signaturbedarf",
			ContactPerson:   "Max Mustermann (BMI)",
			Tags:            []string{"Security", "Legal", "Web3"},
			Collections:     []string{"Starter Pack"},
			IsFeatured:      true,
			RatingAvg:       4.8,
			RatingCount:     12,
		},
		{
			ID:              "open-data-hub",
			Name:            "Open Data Hub",
			Description:     "Central platform for publishing and analyzing urban open data sets.",
			Categories:      []string{"Infrastruktur"},
			Icon:            "📊",
			TechStack:       []string{"Go", "PostgreSQL", "React"},
			License:         "Apache-2.0",
			DockerRepo:      "ghcr.io/bund/open-data-hub:v2.4",
			HelmRepo:        "https://charts.bund.de",
			MarkdownContent: "# Open Data Hub\nTransparency through data. Built-in visualizers and API-first design.",
			Status:          "Incubating",
			Tags:            []string{"Data", "OpenSource", "API"},
			Collections:     []string{"Transparency Tools"},
			RatingAvg:       4.2,
			RatingCount:     5,
		},
		{
			ID:              "gov-messenger",
			Name:            "GovMessenger",
			Description:     "Secure, encrypted communication for inter-agency coordination.",
			Categories:      []string{"Zusammenarbeit"},
			Icon:            "💬",
			TechStack:       []string{"Node.js", "Matrix.org", "React Native"},
			License:         "GPL-3.0",
			DockerRepo:      "ghcr.io/bund/gov-messenger:latest",
			HelmRepo:        "https://charts.bund.de",
			MarkdownContent: "# GovMessenger\nEnd-to-end encrypted chat based on the Matrix protocol.",
			Status:          "Sandbox",
			Tags:            []string{"Communication", "Encryption", "Mobile"},
			Collections:     []string{"Starter Pack"},
			IsFeatured:      true,
		},
	}

	_, err = db.NewInsert().Model(&apps).Exec(ctx)
	if err != nil {
		log.Errorf("Failed to seed apps: %v", err)
	} else {
		log.Info("Database seeded successfully.")
	}
}
