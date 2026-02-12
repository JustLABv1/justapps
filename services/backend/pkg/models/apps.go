package models

import (
	"github.com/uptrace/bun"
)

type Apps struct {
	bun.BaseModel `bun:"table:apps,alias:a"`

	ID              string   `bun:"id,pk" json:"id"`
	Name            string   `bun:"name,notnull" json:"name"`
	Description     string   `bun:"description" json:"description"`
	Category        string   `bun:"category" json:"category"`
	LiveUrl         string   `bun:"live_url" json:"liveUrl"`
	RepoUrl         string   `bun:"repo_url" json:"repoUrl"`
	HelmRepo        string   `bun:"helm_repo" json:"helmRepo"`
	DockerRepo      string   `bun:"docker_repo" json:"dockerRepo"`
	DocsUrl         string   `bun:"docs_url" json:"docsUrl"`
	Icon            string   `bun:"icon" json:"icon"`
	TechStack       []string `bun:"tech_stack,array" json:"techStack"`
	License         string   `bun:"license" json:"license"`
	MarkdownContent string   `bun:"markdown_content" json:"markdownContent"`
}
