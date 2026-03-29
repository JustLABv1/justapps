package gitlab

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"path"
	"strings"
	"time"

	"justapps-backend/config"
	"justapps-backend/pkg/models"
)

var readmeCandidates = []string{"README.md", "README.MD", "README.rst", "README.txt", "README"}

type APIError struct {
	StatusCode int
	Message    string
}

func (e *APIError) Error() string {
	if e == nil {
		return ""
	}
	if e.Message == "" {
		return fmt.Sprintf("gitlab api returned status %d", e.StatusCode)
	}
	return e.Message
}

type Client struct {
	provider config.GitLabProviderConf
	http     *http.Client
}

type SyncResult struct {
	Snapshot      models.GitLabSyncSnapshot
	ProjectID     int64
	ProjectWebURL string
	Status        string
}

type projectResponse struct {
	ID                int64    `json:"id"`
	Name              string   `json:"name"`
	PathWithNamespace string   `json:"path_with_namespace"`
	WebURL            string   `json:"web_url"`
	Description       string   `json:"description"`
	Topics            []string `json:"topics"`
	TagList           []string `json:"tag_list"`
	DefaultBranch     string   `json:"default_branch"`
	LastActivityAt    string   `json:"last_activity_at"`
	License           *struct {
		Name string `json:"name"`
	} `json:"license"`
}

type treeEntry struct {
	Path string `json:"path"`
	Name string `json:"name"`
	Type string `json:"type"`
}

func BuildProviderSummaries(conf *config.RestfulConf) []models.GitLabProviderSummary {
	if conf == nil {
		return []models.GitLabProviderSummary{}
	}
	providers := make([]models.GitLabProviderSummary, 0, len(conf.GitLab.Providers))
	for _, provider := range conf.GitLab.Providers {
		if !provider.Enabled || strings.TrimSpace(provider.Token) == "" {
			continue
		}
		providers = append(providers, models.GitLabProviderSummary{
			Key:     provider.Key,
			Label:   providerLabel(provider),
			BaseURL: normalizeBaseURL(provider.BaseURL),
		})
	}
	return providers
}

func FindProvider(conf *config.RestfulConf, key string) (config.GitLabProviderConf, bool) {
	if conf == nil {
		return config.GitLabProviderConf{}, false
	}
	trimmedKey := strings.TrimSpace(key)
	for _, provider := range conf.GitLab.Providers {
		if !provider.Enabled || strings.TrimSpace(provider.Token) == "" {
			continue
		}
		if strings.EqualFold(strings.TrimSpace(provider.Key), trimmedKey) {
			provider.BaseURL = normalizeBaseURL(provider.BaseURL)
			if provider.TimeoutSeconds <= 0 {
				provider.TimeoutSeconds = 15
			}
			if provider.Label == "" {
				provider.Label = provider.Key
			}
			return provider, true
		}
	}
	return config.GitLabProviderConf{}, false
}

func IsProjectAllowed(provider config.GitLabProviderConf, projectPath string) bool {
	if len(provider.NamespaceAllowlist) == 0 {
		return true
	}
	normalizedProject := strings.ToLower(strings.Trim(strings.TrimSpace(projectPath), "/"))
	for _, entry := range provider.NamespaceAllowlist {
		normalizedEntry := strings.ToLower(strings.Trim(strings.TrimSpace(entry), "/"))
		if normalizedEntry == "" {
			continue
		}
		if normalizedProject == normalizedEntry || strings.HasPrefix(normalizedProject, normalizedEntry+"/") {
			return true
		}
	}
	return false
}

func NormalizeProjectPath(projectPath string) string {
	return strings.Trim(strings.TrimSpace(projectPath), "/")
}

func providerLabel(provider config.GitLabProviderConf) string {
	if strings.TrimSpace(provider.Label) != "" {
		return provider.Label
	}
	return provider.Key
}

func normalizeBaseURL(baseURL string) string {
	trimmed := strings.TrimSpace(baseURL)
	if trimmed == "" {
		return "https://gitlab.com"
	}
	return strings.TrimRight(trimmed, "/")
}

func NewClient(provider config.GitLabProviderConf) *Client {
	provider.BaseURL = normalizeBaseURL(provider.BaseURL)
	if provider.TimeoutSeconds <= 0 {
		provider.TimeoutSeconds = 15
	}
	return &Client{
		provider: provider,
		http: &http.Client{
			Timeout: time.Duration(provider.TimeoutSeconds) * time.Second,
		},
	}
}

func (client *Client) Sync(link models.GitLabAppLink) (SyncResult, error) {
	projectPath := NormalizeProjectPath(link.ProjectPath)
	project, err := client.getProject(projectPath)
	if err != nil {
		return SyncResult{}, err
	}

	branch := strings.TrimSpace(link.Branch)
	if branch == "" {
		branch = project.DefaultBranch
	}

	snapshot := models.GitLabSyncSnapshot{
		ProjectID:      project.ID,
		ProjectName:    project.Name,
		ProjectPath:    project.PathWithNamespace,
		ProjectWebURL:  project.WebURL,
		DefaultBranch:  project.DefaultBranch,
		Description:    strings.TrimSpace(project.Description),
		Topics:         project.Topics,
		LastActivityAt: project.LastActivityAt,
		SyncedAt:       time.Now().UTC().Format(time.RFC3339),
	}
	if len(snapshot.Topics) == 0 && len(project.TagList) > 0 {
		snapshot.Topics = project.TagList
	}
	if project.License != nil {
		snapshot.License = strings.TrimSpace(project.License.Name)
	}

	warnings := make([]string, 0)
	readmePath := strings.TrimSpace(link.ReadmePath)
	if readmePath == "" {
		content, discoveredPath, readmeWarnings, err := client.getReadme(projectPath, branch)
		if err != nil {
			return SyncResult{}, err
		}
		warnings = append(warnings, readmeWarnings...)
		snapshot.ReadmePath = discoveredPath
		snapshot.ReadmeContent = content
	} else {
		content, err := client.getFile(projectPath, branch, readmePath)
		if err != nil {
			if apiErr, ok := err.(*APIError); ok && apiErr.StatusCode == http.StatusNotFound {
				warnings = append(warnings, fmt.Sprintf("README-Datei %s wurde im Repository nicht gefunden.", readmePath))
			} else {
				return SyncResult{}, err
			}
		} else {
			snapshot.ReadmePath = readmePath
			snapshot.ReadmeContent = content
		}
	}

	if strings.TrimSpace(link.HelmValuesPath) != "" {
		content, err := client.getFile(projectPath, branch, link.HelmValuesPath)
		if err != nil {
			if apiErr, ok := err.(*APIError); ok && apiErr.StatusCode == http.StatusNotFound {
				warnings = append(warnings, fmt.Sprintf("Helm-Values-Datei %s wurde im Repository nicht gefunden.", link.HelmValuesPath))
			} else {
				return SyncResult{}, err
			}
		} else {
			snapshot.HelmValuesPath = link.HelmValuesPath
			snapshot.HelmValuesContent = content
		}
	}

	if strings.TrimSpace(link.ComposeFilePath) != "" {
		content, err := client.getFile(projectPath, branch, link.ComposeFilePath)
		if err != nil {
			if apiErr, ok := err.(*APIError); ok && apiErr.StatusCode == http.StatusNotFound {
				warnings = append(warnings, fmt.Sprintf("Compose-Datei %s wurde im Repository nicht gefunden.", link.ComposeFilePath))
			} else {
				return SyncResult{}, err
			}
		} else {
			snapshot.ComposeFilePath = link.ComposeFilePath
			snapshot.ComposeFileContent = content
		}
	}

	snapshot.Warnings = warnings
	status := "success"
	if len(warnings) > 0 {
		status = "warning"
	}

	return SyncResult{
		Snapshot:      snapshot,
		ProjectID:     project.ID,
		ProjectWebURL: project.WebURL,
		Status:        status,
	}, nil
}

func (client *Client) getProject(projectPath string) (projectResponse, error) {
	var project projectResponse
	if err := client.getJSON(path.Join("projects", url.PathEscape(projectPath)), &project, nil); err != nil {
		return projectResponse{}, err
	}
	return project, nil
}

func (client *Client) getReadme(projectPath, branch string) (string, string, []string, error) {
	entries, err := client.getTree(projectPath, branch)
	if err != nil {
		return "", "", nil, err
	}

	for _, candidate := range readmeCandidates {
		for _, entry := range entries {
			if entry.Type != "blob" {
				continue
			}
			if strings.EqualFold(entry.Name, candidate) {
				content, err := client.getFile(projectPath, branch, entry.Path)
				return content, entry.Path, nil, err
			}
		}
	}

	return "", "", []string{"Im Repository wurde keine README-Datei im Wurzelverzeichnis gefunden."}, nil
}

func (client *Client) getTree(projectPath, branch string) ([]treeEntry, error) {
	query := url.Values{}
	if strings.TrimSpace(branch) != "" {
		query.Set("ref", branch)
	}
	query.Set("per_page", "100")

	var entries []treeEntry
	if err := client.getJSON(path.Join("projects", url.PathEscape(projectPath), "repository", "tree"), &entries, query); err != nil {
		return nil, err
	}
	return entries, nil
}

func (client *Client) getFile(projectPath, branch, filePath string) (string, error) {
	query := url.Values{}
	if strings.TrimSpace(branch) != "" {
		query.Set("ref", branch)
	}
	body, err := client.request(http.MethodGet, path.Join("projects", url.PathEscape(projectPath), "repository", "files", url.PathEscape(strings.TrimSpace(filePath)), "raw"), query)
	if err != nil {
		return "", err
	}
	return string(body), nil
}

func (client *Client) getJSON(endpoint string, target any, query url.Values) error {
	body, err := client.request(http.MethodGet, endpoint, query)
	if err != nil {
		return err
	}
	if err := json.Unmarshal(body, target); err != nil {
		return fmt.Errorf("decode gitlab response: %w", err)
	}
	return nil
}

func (client *Client) request(method, endpoint string, query url.Values) ([]byte, error) {
	requestURL := client.provider.BaseURL + "/api/v4/" + strings.TrimLeft(endpoint, "/")
	if len(query) > 0 {
		requestURL += "?" + query.Encode()
	}

	req, err := http.NewRequest(method, requestURL, nil)
	if err != nil {
		return nil, fmt.Errorf("create gitlab request: %w", err)
	}
	req.Header.Set("PRIVATE-TOKEN", client.provider.Token)

	res, err := client.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("gitlab request failed: %w", err)
	}
	defer res.Body.Close()

	body, readErr := io.ReadAll(res.Body)
	if readErr != nil {
		return nil, fmt.Errorf("read gitlab response: %w", readErr)
	}

	if res.StatusCode < 200 || res.StatusCode >= 300 {
		message := strings.TrimSpace(string(body))
		if message == "" {
			message = fmt.Sprintf("gitlab api returned status %d", res.StatusCode)
		}
		return nil, &APIError{StatusCode: res.StatusCode, Message: message}
	}

	return body, nil
}
