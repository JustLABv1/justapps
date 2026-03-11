package models

import (
	"time"

	"github.com/google/uuid"
	"github.com/uptrace/bun"
)

type LiveDemo struct {
	Label string `json:"label"`
	URL   string `json:"url"`
}

type AppLink struct {
	Label string `json:"label"`
	URL   string `json:"url"`
}

// AppField holds a single key-value pair for the dynamic "Fachliche Details" section.
type AppField struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}

type Apps struct {
	bun.BaseModel `bun:"table:apps,alias:a"`

	ID                     string     `bun:"id,pk" json:"id"`
	Name                   string     `bun:"name,notnull" json:"name"`
	Description            string     `bun:"description" json:"description"`
	Categories             []string   `bun:"categories,array" json:"categories"`
	LiveUrl                string     `bun:"live_url" json:"liveUrl"`
	LiveDemos              []LiveDemo `bun:"live_demos,type:jsonb" json:"liveDemos"`
	RepoUrl                string     `bun:"repo_url" json:"repoUrl"`
	Repositories           []AppLink  `bun:"repositories,type:jsonb" json:"repositories"`
	CustomLinks            []AppLink  `bun:"custom_links,type:jsonb" json:"customLinks"`
	HelmRepo               string     `bun:"helm_repo" json:"helmRepo"`
	DockerRepo             string     `bun:"docker_repo" json:"dockerRepo"`
	DocsUrl                string     `bun:"docs_url" json:"docsUrl"`
	Icon                   string     `bun:"icon" json:"icon"`
	TechStack              []string   `bun:"tech_stack,array" json:"techStack"`
	License                string     `bun:"license" json:"license"`
	MarkdownContent        string     `bun:"markdown_content" json:"markdownContent"`
	// CustomFields stores all "Fachliche Details" as dynamic key-value pairs.
	// The field schema (labels, order) is managed via PlatformSettings.DetailFields.
	CustomFields           []AppField `bun:"custom_fields,type:jsonb" json:"customFields"`
	Status                 string     `bun:"status" json:"status"`
	CustomDockerCommand    string     `bun:"custom_docker_command" json:"customDockerCommand"`
	CustomComposeCommand   string     `bun:"custom_compose_command" json:"customComposeCommand"`
	CustomHelmCommand      string     `bun:"custom_helm_command" json:"customHelmCommand"`
	CustomDockerNote       string     `bun:"custom_docker_note" json:"customDockerNote"`
	CustomComposeNote      string     `bun:"custom_compose_note" json:"customComposeNote"`
	CustomHelmNote         string     `bun:"custom_helm_note" json:"customHelmNote"`
	CustomHelmValues       string     `bun:"custom_helm_values" json:"customHelmValues"`
	HasDeploymentAssistant bool       `bun:"has_deployment_assistant,notnull,default:true" json:"hasDeploymentAssistant"`
	ShowDocker             bool       `bun:"show_docker,notnull,default:true" json:"showDocker"`
	ShowCompose            bool       `bun:"show_compose,notnull,default:true" json:"showCompose"`
	ShowHelm               bool       `bun:"show_helm,notnull,default:true" json:"showHelm"`
	Tags                   []string   `bun:"tags,array" json:"tags"`
	Collections            []string   `bun:"collections,array" json:"collections"`
	IsFeatured             bool       `bun:"is_featured,notnull,default:false" json:"isFeatured"`
	RatingAvg              float64    `bun:"rating_avg,notnull,default:0" json:"ratingAvg"`
	RatingCount            int        `bun:"rating_count,notnull,default:0" json:"ratingCount"`
	OwnerID                uuid.UUID  `bun:"owner_id,type:uuid,nullzero" json:"ownerId"`
	Owner                  *Users     `bun:"rel:belongs-to,join:owner_id=id" json:"owner"`
	IsLocked               bool       `bun:"is_locked,notnull,default:false" json:"isLocked"`
	KnownIssue             string     `bun:"known_issue" json:"knownIssue"`
	IsReuse                bool       `bun:"is_reuse,notnull,default:false" json:"isReuse"`
	ReuseRequirements      string     `bun:"reuse_requirements" json:"reuseRequirements"`
	UpdatedAt              time.Time  `bun:"updated_at,nullzero,notnull,default:current_timestamp" json:"updatedAt"`
}
