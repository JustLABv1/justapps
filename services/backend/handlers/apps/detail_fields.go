package apps

import (
	"strings"

	"justapps-backend/pkg/models"
)

type legacyDetailFieldBinding struct {
	key   string
	read  func(*models.Apps) string
	write func(*models.Apps, string)
}

var legacyDetailFieldBindings = []legacyDetailFieldBinding{
	{
		key:  "focus",
		read: func(app *models.Apps) string { return app.Focus },
		write: func(app *models.Apps, value string) {
			app.Focus = value
		},
	},
	{
		key:  "app_type",
		read: func(app *models.Apps) string { return app.AppType },
		write: func(app *models.Apps, value string) {
			app.AppType = value
		},
	},
	{
		key:  "use_case",
		read: func(app *models.Apps) string { return app.UseCase },
		write: func(app *models.Apps, value string) {
			app.UseCase = value
		},
	},
	{
		key:  "visualization",
		read: func(app *models.Apps) string { return app.Visualization },
		write: func(app *models.Apps, value string) {
			app.Visualization = value
		},
	},
	{
		key:  "deployment",
		read: func(app *models.Apps) string { return app.Deployment },
		write: func(app *models.Apps, value string) {
			app.Deployment = value
		},
	},
	{
		key:  "infrastructure",
		read: func(app *models.Apps) string { return app.Infrastructure },
		write: func(app *models.Apps, value string) {
			app.Infrastructure = value
		},
	},
	{
		key:  "database",
		read: func(app *models.Apps) string { return app.Database },
		write: func(app *models.Apps, value string) {
			app.Database = value
		},
	},
	{
		key:  "transferability",
		read: func(app *models.Apps) string { return app.Transferability },
		write: func(app *models.Apps, value string) {
			app.Transferability = value
		},
	},
	{
		key:  "contact_person",
		read: func(app *models.Apps) string { return app.ContactPerson },
		write: func(app *models.Apps, value string) {
			app.ContactPerson = value
		},
	},
	{
		key:  "authority",
		read: func(app *models.Apps) string { return app.Authority },
		write: func(app *models.Apps, value string) {
			app.Authority = value
		},
	},
	{
		key:  "additional_info",
		read: func(app *models.Apps) string { return app.AdditionalInfo },
		write: func(app *models.Apps, value string) {
			app.AdditionalInfo = value
		},
	},
}

func normalizeAppDetailFields(app *models.Apps) {
	if app == nil {
		return
	}

	normalizedFields := make([]models.AppField, 0, len(app.CustomFields))
	fieldIndexByKey := make(map[string]int, len(app.CustomFields))

	for _, field := range app.CustomFields {
		key := strings.TrimSpace(field.Key)
		if key == "" {
			continue
		}

		if idx, exists := fieldIndexByKey[key]; exists {
			if normalizedFields[idx].Value == "" && field.Value != "" {
				normalizedFields[idx].Value = field.Value
			}
			continue
		}

		normalizedFields = append(normalizedFields, models.AppField{Key: key, Value: field.Value})
		fieldIndexByKey[key] = len(normalizedFields) - 1
	}

	for _, binding := range legacyDetailFieldBindings {
		value := strings.TrimSpace(binding.read(app))
		if value == "" {
			continue
		}

		if idx, exists := fieldIndexByKey[binding.key]; exists {
			normalizedFields[idx].Value = value
			continue
		}

		normalizedFields = append(normalizedFields, models.AppField{Key: binding.key, Value: value})
		fieldIndexByKey[binding.key] = len(normalizedFields) - 1
	}

	app.CustomFields = normalizedFields

	fieldValues := make(map[string]string, len(app.CustomFields))
	for _, field := range app.CustomFields {
		if _, exists := fieldValues[field.Key]; exists {
			continue
		}
		fieldValues[field.Key] = field.Value
	}

	for _, binding := range legacyDetailFieldBindings {
		binding.write(app, fieldValues[binding.key])
	}
}
