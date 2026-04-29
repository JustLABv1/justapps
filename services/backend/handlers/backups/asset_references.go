package backups

import "justapps-backend/pkg/models"

func canonicalizeAppUploadReferences(apps []models.Apps) {
	for index := range apps {
		apps[index].Icon = canonicalUploadReference(apps[index].Icon)
	}
}

func canonicalizeAppGroupUploadReferences(groups []models.AppGroup) {
	for index := range groups {
		groups[index].Icon = canonicalUploadReference(groups[index].Icon)
	}
}

func canonicalizePlatformSettingsUploadReferences(settings *models.PlatformSettings) {
	if settings == nil {
		return
	}
	settings.LogoUrl = canonicalUploadReference(settings.LogoUrl)
	settings.LogoDarkUrl = canonicalUploadReference(settings.LogoDarkUrl)
	settings.FaviconUrl = canonicalUploadReference(settings.FaviconUrl)
}
