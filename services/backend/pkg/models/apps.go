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

// DeploymentVariant defines a named deployment flavor for an app
// (e.g. "Standalone", "High Availability", "Mit SSO").
type DeploymentVariant struct {
	Name           string `json:"name"`
	Description    string `json:"description"`
	DockerCommand  string `json:"dockerCommand"`
	DockerNote     string `json:"dockerNote"`
	ComposeCommand string `json:"composeCommand"`
	ComposeNote    string `json:"composeNote"`
	HelmCommand    string `json:"helmCommand"`
	HelmNote       string `json:"helmNote"`
	HelmValues     string `json:"helmValues"`
}

// AppField holds a single key-value pair for the dynamic "Fachliche Details" section.
type AppField struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}

type Apps struct {
	bun.BaseModel `bun:"table:apps,alias:a"`

	ID              string     `bun:"id,pk" json:"id"`
	Name            string     `bun:"name,notnull" json:"name"`
	Description     string     `bun:"description" json:"description"`
	Categories      []string   `bun:"categories,array" json:"categories"`
	LiveUrl         string     `bun:"live_url" json:"liveUrl"`
	LiveDemos       []LiveDemo `bun:"live_demos,type:jsonb" json:"liveDemos"`
	RepoUrl         string     `bun:"repo_url" json:"repoUrl"`
	Repositories    []AppLink  `bun:"repositories,type:jsonb" json:"repositories"`
	CustomLinks     []AppLink  `bun:"custom_links,type:jsonb" json:"customLinks"`
	HelmRepo        string     `bun:"helm_repo" json:"helmRepo"`
	DockerRepo      string     `bun:"docker_repo" json:"dockerRepo"`
	DocsUrl         string     `bun:"docs_url" json:"docsUrl"`
	Icon            string     `bun:"icon" json:"icon"`
	TechStack       []string   `bun:"tech_stack,array" json:"techStack"`
	License         string     `bun:"license" json:"license"`
	MarkdownContent string     `bun:"markdown_content" json:"markdownContent"`
	// CustomFields stores all "Fachliche Details" as dynamic key-value pairs.
	// The field schema (labels, order) is managed via PlatformSettings.DetailFields.
	CustomFields           []AppField           `bun:"custom_fields,type:jsonb" json:"customFields"`
	Status                 string               `bun:"status" json:"status"`
	CustomDockerCommand    string               `bun:"custom_docker_command" json:"customDockerCommand"`
	CustomComposeCommand   string               `bun:"custom_compose_command" json:"customComposeCommand"`
	CustomHelmCommand      string               `bun:"custom_helm_command" json:"customHelmCommand"`
	CustomDockerNote       string               `bun:"custom_docker_note" json:"customDockerNote"`
	CustomComposeNote      string               `bun:"custom_compose_note" json:"customComposeNote"`
	CustomHelmNote         string               `bun:"custom_helm_note" json:"customHelmNote"`
	CustomHelmValues       string               `bun:"custom_helm_values" json:"customHelmValues"`
	HasDeploymentAssistant bool                 `bun:"has_deployment_assistant,notnull,default:true" json:"hasDeploymentAssistant"`
	ShowDocker             bool                 `bun:"show_docker,notnull,default:true" json:"showDocker"`
	ShowCompose            bool                 `bun:"show_compose,notnull,default:true" json:"showCompose"`
	ShowHelm               bool                 `bun:"show_helm,notnull,default:true" json:"showHelm"`
	Tags                   []string             `bun:"tags,array" json:"tags"`
	Collections            []string             `bun:"collections,array" json:"collections"`
	IsFeatured             bool                 `bun:"is_featured,notnull,default:false" json:"isFeatured"`
	RatingAvg              float64              `bun:"rating_avg,notnull,default:0" json:"ratingAvg"`
	RatingCount            int                  `bun:"rating_count,notnull,default:0" json:"ratingCount"`
	OwnerID                uuid.UUID            `bun:"owner_id,type:uuid,nullzero" json:"ownerId"`
	Owner                  *Users               `bun:"rel:belongs-to,join:owner_id=id" json:"owner"`
	IsLocked               bool                 `bun:"is_locked,notnull,default:false" json:"isLocked"`
	SkipLinkProbe          bool                 `bun:"skip_link_probe,notnull,default:false" json:"skipLinkProbe"`
	LinkProbeStatus        string               `bun:"link_probe_status,notnull,default:'unknown'" json:"linkProbeStatus"`
	KnownIssue             string               `bun:"known_issue" json:"knownIssue"`
	IsReuse                bool                 `bun:"is_reuse,notnull,default:false" json:"isReuse"`
	ReuseRequirements      string               `bun:"reuse_requirements" json:"reuseRequirements"`
	DeploymentVariants     []DeploymentVariant  `bun:"deployment_variants,type:jsonb" json:"deploymentVariants"`
	Version                string               `bun:"version,notnull,default:''" json:"version"`
	Changelog              string               `bun:"changelog,notnull,default:''" json:"changelog"`
	UpdatedAt              time.Time            `bun:"updated_at,nullzero,notnull,default:current_timestamp" json:"updatedAt"` // Virtual: populated by GetApp for the detail view
	RelatedApps            []AppRelationSummary `bun:"-" json:"relatedApps,omitempty"`
	AppGroups              []AppGroupSummary    `bun:"-" json:"appGroups,omitempty"`
	GitLabSync             *GitLabSyncSummary   `bun:"-" json:"gitLabSync,omitempty"`
	// Legacy detail-field aliases kept for JSON import/export compatibility.
	Focus           string `bun:"-" json:"focus"`
	AppType         string `bun:"-" json:"app_type"`
	UseCase         string `bun:"-" json:"use_case"`
	Visualization   string `bun:"-" json:"visualization"`
	Deployment      string `bun:"-" json:"deployment"`
	Infrastructure  string `bun:"-" json:"infrastructure"`
	Database        string `bun:"-" json:"database"`
	Transferability string `bun:"-" json:"transferability"`
	ContactPerson   string `bun:"-" json:"contact_person"`
	Authority       string `bun:"-" json:"authority"`
	AdditionalInfo  string `bun:"-" json:"additional_info"`
}

// AppRelationSummary is a lightweight representation of a related app.
type AppRelationSummary struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Icon string `json:"icon"`
}

// AppGroupSummary is a lightweight reference to a group an app belongs to.
type AppGroupSummary struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Icon string `json:"icon"`
}
