package gitlab

import (
	"encoding/base64"
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

// GitHubClient implements the Syncer interface for github.com and
// GitHub Enterprise Server. It maps GitHub repository metadata into the
// provider-neutral GitLabSyncSnapshot shape used by the rest of the system.
type GitHubClient struct {
	provider config.RepositoryProviderConf
	http     *http.Client
}

type githubRepoResponse struct {
	ID            int64    `json:"id"`
	Name          string   `json:"name"`
	FullName      string   `json:"full_name"`
	HTMLURL       string   `json:"html_url"`
	Description   string   `json:"description"`
	Topics        []string `json:"topics"`
	DefaultBranch string   `json:"default_branch"`
	UpdatedAt     string   `json:"updated_at"`
	License       *struct {
		Name   string `json:"name"`
		SPDXID string `json:"spdx_id"`
	} `json:"license"`
}

type githubContentResponse struct {
	Type     string `json:"type"`
	Path     string `json:"path"`
	Encoding string `json:"encoding"`
	Content  string `json:"content"`
}

type githubReadmeResponse struct {
	Path     string `json:"path"`
	Encoding string `json:"encoding"`
	Content  string `json:"content"`
}

// NewGitHubClient creates a GitHub adapter using the provided provider configuration.
func NewGitHubClient(provider config.RepositoryProviderConf) *GitHubClient {
	provider.BaseURL = normalizeGitHubBaseURL(provider.BaseURL)
	if provider.TimeoutSeconds <= 0 {
		provider.TimeoutSeconds = 15
	}
	return &GitHubClient{
		provider: provider,
		http: &http.Client{
			Timeout: time.Duration(provider.TimeoutSeconds) * time.Second,
		},
	}
}

func (client *GitHubClient) Sync(link models.GitLabAppLink) (SyncResult, error) {
	projectPath := NormalizeProjectPath(link.ProjectPath)
	repo, err := client.getRepo(projectPath)
	if err != nil {
		return SyncResult{}, err
	}

	branch := strings.TrimSpace(link.Branch)
	if branch == "" {
		branch = repo.DefaultBranch
	}

	snapshot := models.GitLabSyncSnapshot{
		ProjectID:      repo.ID,
		ProjectName:    repo.Name,
		ProjectPath:    repo.FullName,
		ProjectWebURL:  repo.HTMLURL,
		DefaultBranch:  repo.DefaultBranch,
		Description:    strings.TrimSpace(repo.Description),
		Topics:         repo.Topics,
		LastActivityAt: repo.UpdatedAt,
		SyncedAt:       time.Now().UTC().Format(time.RFC3339),
	}
	if repo.License != nil {
		snapshot.License = strings.TrimSpace(repo.License.Name)
	}

	warnings := make([]string, 0)
	readmePath := strings.TrimSpace(link.ReadmePath)
	if readmePath == "" {
		content, discoveredPath, readmeErr := client.getReadme(projectPath, branch)
		if readmeErr != nil {
			if apiErr, ok := readmeErr.(*APIError); ok && apiErr.StatusCode == http.StatusNotFound {
				warnings = append(warnings, "Im Repository wurde keine README-Datei im Wurzelverzeichnis gefunden.")
			} else {
				return SyncResult{}, readmeErr
			}
		} else {
			snapshot.ReadmePath = discoveredPath
			snapshot.ReadmeContent = content
		}
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
		ProjectID:     repo.ID,
		ProjectWebURL: repo.HTMLURL,
		Status:        status,
	}, nil
}

func (client *GitHubClient) getRepo(projectPath string) (githubRepoResponse, error) {
	owner, repo, ok := splitOwnerRepo(projectPath)
	if !ok {
		return githubRepoResponse{}, fmt.Errorf("github project path must be in 'owner/repo' format, got %q", projectPath)
	}
	var response githubRepoResponse
	endpoint := path.Join("repos", url.PathEscape(owner), url.PathEscape(repo))
	if err := client.getJSON(endpoint, &response, nil); err != nil {
		return githubRepoResponse{}, err
	}
	return response, nil
}

func (client *GitHubClient) getReadme(projectPath, branch string) (string, string, error) {
	owner, repo, ok := splitOwnerRepo(projectPath)
	if !ok {
		return "", "", fmt.Errorf("github project path must be in 'owner/repo' format, got %q", projectPath)
	}
	query := url.Values{}
	if strings.TrimSpace(branch) != "" {
		query.Set("ref", branch)
	}
	var response githubReadmeResponse
	endpoint := path.Join("repos", url.PathEscape(owner), url.PathEscape(repo), "readme")
	if err := client.getJSON(endpoint, &response, query); err != nil {
		return "", "", err
	}
	content, err := decodeGitHubContent(response.Encoding, response.Content)
	if err != nil {
		return "", "", err
	}
	return content, response.Path, nil
}

func (client *GitHubClient) getFile(projectPath, branch, filePath string) (string, error) {
	owner, repo, ok := splitOwnerRepo(projectPath)
	if !ok {
		return "", fmt.Errorf("github project path must be in 'owner/repo' format, got %q", projectPath)
	}
	query := url.Values{}
	if strings.TrimSpace(branch) != "" {
		query.Set("ref", branch)
	}
	endpoint := path.Join("repos", url.PathEscape(owner), url.PathEscape(repo), "contents", strings.TrimLeft(strings.TrimSpace(filePath), "/"))

	var response githubContentResponse
	if err := client.getJSON(endpoint, &response, query); err != nil {
		return "", err
	}
	if response.Type != "" && response.Type != "file" {
		return "", fmt.Errorf("github path %q is not a file (type=%s)", filePath, response.Type)
	}
	return decodeGitHubContent(response.Encoding, response.Content)
}

func (client *GitHubClient) getJSON(endpoint string, target any, query url.Values) error {
	body, err := client.request(http.MethodGet, endpoint, query)
	if err != nil {
		return err
	}
	if err := json.Unmarshal(body, target); err != nil {
		return fmt.Errorf("decode github response: %w", err)
	}
	return nil
}

func (client *GitHubClient) request(method, endpoint string, query url.Values) ([]byte, error) {
	apiBase := githubAPIBase(client.provider.BaseURL)
	requestURL := apiBase + "/" + strings.TrimLeft(endpoint, "/")
	if len(query) > 0 {
		requestURL += "?" + query.Encode()
	}

	req, err := http.NewRequest(method, requestURL, nil)
	if err != nil {
		return nil, fmt.Errorf("create github request: %w", err)
	}
	if token := strings.TrimSpace(client.provider.Token); token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("X-GitHub-Api-Version", "2022-11-28")
	req.Header.Set("User-Agent", "justapps-backend")

	res, err := client.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("github request failed: %w", err)
	}
	defer res.Body.Close()

	body, readErr := io.ReadAll(res.Body)
	if readErr != nil {
		return nil, fmt.Errorf("read github response: %w", readErr)
	}

	if res.StatusCode < 200 || res.StatusCode >= 300 {
		message := strings.TrimSpace(string(body))
		if message == "" {
			message = fmt.Sprintf("github api returned status %d", res.StatusCode)
		}
		return nil, &APIError{StatusCode: res.StatusCode, Message: message}
	}

	return body, nil
}

func splitOwnerRepo(projectPath string) (string, string, bool) {
	trimmed := strings.Trim(strings.TrimSpace(projectPath), "/")
	parts := strings.Split(trimmed, "/")
	if len(parts) != 2 || parts[0] == "" || parts[1] == "" {
		return "", "", false
	}
	return parts[0], parts[1], true
}

func decodeGitHubContent(encoding, content string) (string, error) {
	if strings.EqualFold(strings.TrimSpace(encoding), "base64") {
		// GitHub encodes file contents as base64 with embedded newlines.
		cleaned := strings.NewReplacer("\n", "", "\r", "").Replace(content)
		decoded, err := base64.StdEncoding.DecodeString(cleaned)
		if err != nil {
			return "", fmt.Errorf("decode github content: %w", err)
		}
		return string(decoded), nil
	}
	return content, nil
}

func normalizeGitHubBaseURL(baseURL string) string {
	trimmed := strings.TrimSpace(baseURL)
	if trimmed == "" {
		return "https://github.com"
	}
	return strings.TrimRight(trimmed, "/")
}

func githubAPIBase(baseURL string) string {
	normalized := normalizeGitHubBaseURL(baseURL)
	host := strings.ToLower(normalized)
	switch host {
	case "https://github.com", "http://github.com":
		return "https://api.github.com"
	}
	// GitHub Enterprise Server exposes the REST API under <host>/api/v3.
	return normalized + "/api/v3"
}
