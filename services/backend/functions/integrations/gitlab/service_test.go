package gitlab

import (
	"testing"

	"justapps-backend/pkg/models"
)

func TestSnapshotChangesAppContentFalseForIdenticalContent(t *testing.T) {
	t.Parallel()

	app := models.Apps{
		Description:          "Existing description",
		License:              "MIT",
		MarkdownContent:      "# Readme",
		CustomHelmValues:     "replicaCount: 1",
		CustomComposeCommand: "services:\n  app:\n    image: demo",
		Repositories: []models.AppLink{{
			Label: "GitLab",
			URL:   "https://gitlab.example.com/team/app",
		}},
		Tags: []string{"alpha", "beta"},
	}
	snapshot := models.GitLabSyncSnapshot{
		Description:        "Existing description",
		License:            "MIT",
		ReadmeContent:      "# Readme",
		HelmValuesContent:  "replicaCount: 1",
		ComposeFileContent: "services:\n  app:\n    image: demo",
		ProjectWebURL:      "https://gitlab.example.com/team/app",
		Topics:             []string{"alpha", "beta"},
	}

	if changed := snapshotChangesAppContent(app, "GitLab", snapshot); changed {
		t.Fatal("expected identical snapshot content to leave app content unchanged")
	}
}

func TestSnapshotChangesAppContentTrueWhenReadmeChanges(t *testing.T) {
	t.Parallel()

	app := models.Apps{
		MarkdownContent: "# Old",
	}
	snapshot := models.GitLabSyncSnapshot{
		ReadmeContent: "# New",
	}

	if changed := snapshotChangesAppContent(app, "GitLab", snapshot); !changed {
		t.Fatal("expected changed readme content to update app content")
	}
}

func TestSnapshotChangesAppContentTrueWhenSyncAddsMissingMetadata(t *testing.T) {
	t.Parallel()

	app := models.Apps{
		Repositories: []models.AppLink{{
			Label: "Docs",
			URL:   "https://docs.example.com/app",
		}},
		Tags: []string{"alpha"},
	}
	snapshot := models.GitLabSyncSnapshot{
		ProjectWebURL: "https://gitlab.example.com/team/app",
		Topics:        []string{"alpha", "gamma"},
	}

	if changed := snapshotChangesAppContent(app, "GitLab", snapshot); !changed {
		t.Fatal("expected missing repository URL and topic to count as content changes")
	}
}

func TestSnapshotChangesAppContentFalseForApproveWithoutEffectiveChange(t *testing.T) {
	t.Parallel()

	app := models.Apps{
		Description: "Repository description",
		Repositories: []models.AppLink{{
			Label: "GitHub Mirror",
			URL:   "https://github.com/example/app",
		}, {
			Label: "GitLab",
			URL:   "https://gitlab.example.com/team/app",
		}},
		Tags: []string{"alpha", "beta"},
	}
	pendingSnapshot := models.GitLabSyncSnapshot{
		Description:   "Repository description",
		ProjectWebURL: "https://gitlab.example.com/team/app",
		Topics:        []string{"beta"},
	}

	if changed := snapshotChangesAppContent(app, "GitLab", pendingSnapshot); changed {
		t.Fatal("expected approving equivalent pending snapshot to keep app content unchanged")
	}
}
