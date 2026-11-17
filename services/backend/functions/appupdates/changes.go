package appupdates

import (
	"encoding/json"
	"slices"

	"justapps-backend/pkg/models"
)

// Field keys for what a reader of the catalog would notice. Settings that
// only steer the platform (featured, hidden, locked, link probing, banners)
// are left out on purpose: they are not news about the app.
const (
	FieldName         = "name"
	FieldDescription  = "description"
	FieldIcon         = "icon"
	FieldDocs         = "docs"
	FieldInstallation = "installation"
	FieldLinks        = "links"
	FieldCategories   = "categories"
	FieldTechStack    = "techStack"
	FieldLicense      = "license"
	FieldStatus       = "status"
	FieldDetails      = "details"
	FieldReuse        = "reuse"
	FieldVersion      = "version"
	FieldChangelog    = "changelog"
)

// jsonOf compares structured fields; an empty list and a missing one are the same.
func jsonOf(value any) string {
	data, _ := json.Marshal(value)
	if text := string(data); text != "null" && text != "[]" && text != "{}" {
		return text
	}
	return ""
}

// ChangedFields lists the field keys that differ between two versions of an app.
func ChangedFields(before, after models.Apps) []string {
	fields := make([]string, 0, 8)
	add := func(changed bool, key string) {
		if changed {
			fields = append(fields, key)
		}
	}

	add(normalizeString(before.Name) != normalizeString(after.Name), FieldName)
	add(normalizeString(before.Description) != normalizeString(after.Description), FieldDescription)
	add(normalizeString(before.Icon) != normalizeString(after.Icon), FieldIcon)
	add(normalizeMultiline(before.MarkdownContent) != normalizeMultiline(after.MarkdownContent) ||
		normalizeString(before.DocsUrl) != normalizeString(after.DocsUrl), FieldDocs)
	add(normalizeMultiline(before.CustomHelmValues) != normalizeMultiline(after.CustomHelmValues) ||
		normalizeMultiline(before.CustomComposeCommand) != normalizeMultiline(after.CustomComposeCommand) ||
		normalizeMultiline(before.CustomDockerCommand) != normalizeMultiline(after.CustomDockerCommand) ||
		normalizeMultiline(before.CustomHelmCommand) != normalizeMultiline(after.CustomHelmCommand) ||
		normalizeMultiline(before.CustomDockerNote) != normalizeMultiline(after.CustomDockerNote) ||
		normalizeMultiline(before.CustomComposeNote) != normalizeMultiline(after.CustomComposeNote) ||
		normalizeMultiline(before.CustomHelmNote) != normalizeMultiline(after.CustomHelmNote) ||
		normalizeString(before.HelmRepo) != normalizeString(after.HelmRepo) ||
		normalizeString(before.DockerRepo) != normalizeString(after.DockerRepo) ||
		jsonOf(before.DeploymentVariants) != jsonOf(after.DeploymentVariants), FieldInstallation)
	add(!equalLinks(before.Repositories, after.Repositories) ||
		!equalLinks(before.CustomLinks, after.CustomLinks) ||
		normalizeString(before.LiveUrl) != normalizeString(after.LiveUrl) ||
		normalizeString(before.RepoUrl) != normalizeString(after.RepoUrl) ||
		jsonOf(before.LiveDemos) != jsonOf(after.LiveDemos), FieldLinks)
	add(!slices.Equal(normalizeStringSlice(before.Categories), normalizeStringSlice(after.Categories)) ||
		!slices.Equal(normalizeStringSlice(before.Tags), normalizeStringSlice(after.Tags)), FieldCategories)
	add(!slices.Equal(normalizeStringSlice(before.TechStack), normalizeStringSlice(after.TechStack)), FieldTechStack)
	add(normalizeString(before.License) != normalizeString(after.License), FieldLicense)
	add(normalizeString(before.Status) != normalizeString(after.Status), FieldStatus)
	add(jsonOf(before.CustomFields) != jsonOf(after.CustomFields), FieldDetails)
	add(before.IsReuse != after.IsReuse || normalizeMultiline(before.ReuseRequirements) != normalizeMultiline(after.ReuseRequirements), FieldReuse)
	add(normalizeString(before.Version) != normalizeString(after.Version), FieldVersion)
	add(normalizeMultiline(before.Changelog) != normalizeMultiline(after.Changelog), FieldChangelog)
	return fields
}
