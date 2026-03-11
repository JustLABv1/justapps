import {
  Activity,
  ArrowRightLeft,
  Briefcase,
  Building,
  ClipboardList,
  Cloud,
  Code,
  Cpu,
  Database,
  Eye,
  FileCode,
  FileText,
  Fingerprint,
  Flag,
  Globe,
  HardDrive,
  Layers,
  LayoutDashboard,
  Link,
  Lock,
  Map as MapIcon,
  Package,
  Server,
  Settings,
  Shield,
  Tag,
  User,
  Users,
  Wrench,
  Zap,
} from 'lucide-react';
import React from 'react';

/** All icons available for admin selection in field definitions. */
export const AVAILABLE_ICONS: { name: string; component: React.ReactNode }[] = [
  { name: 'Layers',         component: <Layers className="w-3.5 h-3.5" /> },
  { name: 'Globe',          component: <Globe className="w-3.5 h-3.5" /> },
  { name: 'FileCode',       component: <FileCode className="w-3.5 h-3.5" /> },
  { name: 'Eye',            component: <Eye className="w-3.5 h-3.5" /> },
  { name: 'Server',         component: <Server className="w-3.5 h-3.5" /> },
  { name: 'LayoutDashboard',component: <LayoutDashboard className="w-3.5 h-3.5" /> },
  { name: 'Database',       component: <Database className="w-3.5 h-3.5" /> },
  { name: 'ArrowRightLeft', component: <ArrowRightLeft className="w-3.5 h-3.5" /> },
  { name: 'User',           component: <User className="w-3.5 h-3.5" /> },
  { name: 'Users',          component: <Users className="w-3.5 h-3.5" /> },
  { name: 'ClipboardList',  component: <ClipboardList className="w-3.5 h-3.5" /> },
  { name: 'Activity',       component: <Activity className="w-3.5 h-3.5" /> },
  { name: 'Building',       component: <Building className="w-3.5 h-3.5" /> },
  { name: 'Briefcase',      component: <Briefcase className="w-3.5 h-3.5" /> },
  { name: 'Shield',         component: <Shield className="w-3.5 h-3.5" /> },
  { name: 'Lock',           component: <Lock className="w-3.5 h-3.5" /> },
  { name: 'Fingerprint',    component: <Fingerprint className="w-3.5 h-3.5" /> },
  { name: 'Cloud',          component: <Cloud className="w-3.5 h-3.5" /> },
  { name: 'HardDrive',      component: <HardDrive className="w-3.5 h-3.5" /> },
  { name: 'Cpu',            component: <Cpu className="w-3.5 h-3.5" /> },
  { name: 'Code',           component: <Code className="w-3.5 h-3.5" /> },
  { name: 'Package',        component: <Package className="w-3.5 h-3.5" /> },
  { name: 'Wrench',         component: <Wrench className="w-3.5 h-3.5" /> },
  { name: 'Settings',       component: <Settings className="w-3.5 h-3.5" /> },
  { name: 'Tag',            component: <Tag className="w-3.5 h-3.5" /> },
  { name: 'Link',           component: <Link className="w-3.5 h-3.5" /> },
  { name: 'FileText',       component: <FileText className="w-3.5 h-3.5" /> },
  { name: 'Map',            component: <MapIcon className="w-3.5 h-3.5" /> },
  { name: 'Flag',           component: <Flag className="w-3.5 h-3.5" /> },
  { name: 'Zap',            component: <Zap className="w-3.5 h-3.5" /> },
];

const iconMap = new globalThis.Map(AVAILABLE_ICONS.map(i => [i.name, i.component]));

/** Resolve an icon name string to a React element, or null if not found. */
export function resolveIcon(name?: string): React.ReactNode | null {
  if (!name) return null;
  return iconMap.get(name) ?? null;
}
