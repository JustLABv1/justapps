import { AppConfig } from '@/config/apps';
import { DRAFT_STATUS } from '@/lib/appStatus';

function cloneLinks<T extends { label?: string; url?: string }>(links?: T[]) {
  return (links || []).map((link) => ({ ...link }));
}

export function prepareAppCopyDraft(source: AppConfig): Partial<AppConfig> {
  const trimmedName = source.name?.trim();

  return {
    name: trimmedName ? `${trimmedName} (Kopie)` : 'Neue App (Kopie)',
    id: '',
    description: source.description || '',
    categories: [...(source.categories || [])],
    liveUrl: source.liveUrl || '',
    liveDemos: cloneLinks(source.liveDemos),
    repoUrl: source.repoUrl || '',
    repositories: cloneLinks(source.repositories),
    customLinks: cloneLinks(source.customLinks),
    helmRepo: source.helmRepo || '',
    dockerRepo: source.dockerRepo || '',
    docsUrl: source.docsUrl || '',
    icon: source.icon || '🏛️',
    techStack: [...(source.techStack || [])],
    license: source.license || 'MIT',
    markdownContent: source.markdownContent || '',
    customFields: (source.customFields || []).map((field) => ({ ...field })),
    status: DRAFT_STATUS,
    customDockerCommand: source.customDockerCommand || '',
    customComposeCommand: source.customComposeCommand || '',
    customHelmCommand: source.customHelmCommand || '',
    customDockerNote: source.customDockerNote || '',
    customComposeNote: source.customComposeNote || '',
    customHelmNote: source.customHelmNote || '',
    customHelmValues: source.customHelmValues || '',
    hasDeploymentAssistant: source.hasDeploymentAssistant ?? true,
    showDocker: source.showDocker ?? true,
    showCompose: source.showCompose ?? true,
    showHelm: source.showHelm ?? true,
    isReuse: source.isReuse ?? false,
    reuseRequirements: source.reuseRequirements || '',
    tags: [...(source.tags || [])],
    collections: [...(source.collections || [])],
    bannerText: source.bannerText || '',
    bannerType: source.bannerType,
    bannerColor: source.bannerColor || '',
    bannerTitle: source.bannerTitle || '',
    authority: source.authority || '',
    deploymentVariants: (source.deploymentVariants || []).map((variant) => ({ ...variant })),
    version: source.version || '',
    changelog: source.changelog || '',
    skipLinkProbe: source.skipLinkProbe ?? false,
  };
}
