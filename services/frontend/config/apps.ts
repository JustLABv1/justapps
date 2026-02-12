import fs from 'fs';
import yaml from 'js-yaml';
import path from 'path';

export interface AppConfig {
  id: string;
  name: string;
  description: string;
  category: string;
  liveUrl?: string;
  repoUrl?: string;
  helmRepo?: string;
  dockerRepo?: string;
  docsUrl?: string;
  icon?: string;
  techStack?: string[];
  license?: string;
  markdownContent?: string;
  focus?: string;
  appType?: string;
  useCase?: string;
  visualization?: string;
  deployment?: string;
  infrastructure?: string;
  database?: string;
  additionalInfo?: string;
  status?: string;
  transferability?: string;
  contactPerson?: string;
  customDockerCommand?: string;
  customComposeCommand?: string;
  customHelmCommand?: string;
  customDockerNote?: string;
  customComposeNote?: string;
  customHelmNote?: string;
  tags?: string[];
  collections?: string[];
  isFeatured?: boolean;
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

