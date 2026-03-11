import fs from 'fs';
import yaml from 'js-yaml';
import path from 'path';

export interface LiveDemo {
  label: string;
  url: string;
}

export interface AppLink {
  label: string;
  url: string;
}

export interface AppField {
  key: string;
  value: string;
}

export interface AppConfig {
  id: string;
  name: string;
  description: string;
  categories: string[];
  liveUrl?: string; // Kept for backwards compatibility
  liveDemos?: LiveDemo[];
  repoUrl?: string;
  repositories?: AppLink[];
  customLinks?: AppLink[];
  helmRepo?: string;
  dockerRepo?: string;
  docsUrl?: string;
  icon?: string;
  techStack?: string[];
  license?: string;
  markdownContent?: string;
  /** Dynamic "Fachliche Details" key-value pairs. Schema is defined in platform settings. */
  customFields?: AppField[];
  status?: string;
  customDockerCommand?: string;
  customComposeCommand?: string;
  customHelmCommand?: string;
  customDockerNote?: string;
  customComposeNote?: string;
  customHelmNote?: string;
  customHelmValues?: string;
  hasDeploymentAssistant?: boolean;
  showDocker?: boolean;
  showCompose?: boolean;
  showHelm?: boolean;
  isLocked?: boolean;
  isReuse?: boolean;
  reuseRequirements?: string;
  ownerId?: string;
  owner?: {
    username: string;
    email: string;
    id: string;
  };
  tags?: string[];
  collections?: string[];
  isFeatured?: boolean;
  knownIssue?: string;
  ratingAvg?: number;
  ratingCount?: number;
  updatedAt?: string;
}

export const getApps = (): AppConfig[] => {
  try {
    const configPath = process.env.APP_CONFIG_PATH || 'config.yaml';
    const filePath = path.isAbsolute(configPath) 
      ? configPath 
      : path.join(process.cwd(), configPath);
    
    if (!fs.existsSync(filePath)) {
      console.warn(`Config file not found at ${filePath}, returning empty list`);
      return [];
    }

    const fileContents = fs.readFileSync(filePath, 'utf8');
    const data = yaml.load(fileContents) as { apps: AppConfig[] };
    return data.apps || [];
  } catch (error) {
    console.error('Error loading apps from config:', error);
    return [];
  }
};

export const apps: AppConfig[] = []; // Keep as fallback or for types if needed

