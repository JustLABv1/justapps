import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

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
}

export const getApps = (): AppConfig[] => {
  try {
    const filePath = path.join(process.cwd(), 'config.yaml');
    const fileContents = fs.readFileSync(filePath, 'utf8');
    const data = yaml.load(fileContents) as { apps: AppConfig[] };
    return data.apps || [];
  } catch (error) {
    console.error('Error loading apps from config.yaml:', error);
    return [];
  }
};

export const apps: AppConfig[] = []; // Keep as fallback or for types if needed

