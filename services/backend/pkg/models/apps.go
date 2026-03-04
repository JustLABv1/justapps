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
	Focus                  string     `bun:"focus" json:"focus"`
	AppType                string     `bun:"app_type" json:"appType"`
	UseCase                string     `bun:"use_case" json:"useCase"`
	Visualization          string     `bun:"visualization" json:"visualization"`
	Deployment             string     `bun:"deployment" json:"deployment"`
	Infrastructure         string     `bun:"infrastructure" json:"infrastructure"`
	Database               string     `bun:"database" json:"database"`
	AdditionalInfo         string     `bun:"additional_info" json:"additionalInfo"`
	Status                 string     `bun:"status" json:"status"`
	Transferability        string     `bun:"transferability" json:"transferability"`
	ContactPerson          string     `bun:"contact_person" json:"contactPerson"`
	CustomDockerCommand    string     `bun:"custom_docker_command" json:"customDockerCommand"`
	CustomComposeCommand   string     `bun:"custom_compose_command" json:"customComposeCommand"`
	CustomHelmCommand      string     `bun:"custom_helm_command" json:"customHelmCommand"`
	CustomDockerNote       string     `bun:"custom_docker_note" json:"customDockerNote"`
	CustomComposeNote      string     `bun:"custom_compose_note" json:"customComposeNote"`
	CustomHelmNote         string     `bun:"custom_helm_note" json:"customHelmNote"`
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
	IsLocked               bool       `bun:"is_locked,notnull,default:false" json:"isLocked"`
	UpdatedAt              time.Time  `bun:"updated_at,nullzero,notnull,default:current_timestamp" json:"updatedAt"`
}
