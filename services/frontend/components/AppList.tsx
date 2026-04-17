'use client';

import { AppConfig } from '@/config/apps';
import { getAppStatusLabel } from '@/lib/appStatus';
import { getImageAssetUrl } from '@/lib/assets';
import {
    Button,
    Card,
    Chip,
    Dropdown,
} from '@heroui/react';
import {
    ExternalLink,
    Info,
    Lock,
    MoreVertical,
    Pencil,
    Trash2,
    Unlock,
    User,
} from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

interface AppListProps {
  apps: AppConfig[];
  handleEditApp: (app: AppConfig) => void;
  handleDeleteApp: (id: string) => void;
  handleToggleAppLock: (app: AppConfig) => void;
}

export function AppList({ apps, handleEditApp, handleDeleteApp, handleToggleAppLock }: AppListProps) {
  const router = useRouter();

  return (
    <div className="grid grid-cols-1 gap-4">
      {apps.map((app) => (
        <Card key={app.id} variant="default" className="hover:border-accent/30 transition-all duration-200 border-border shadow-sm hover:shadow-md group">
          <div className="flex flex-col md:flex-row items-center p-5 gap-6">
            <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-surface-secondary to-surface border border-border flex items-center justify-center text-3xl shadow-sm flex-shrink-0 overflow-hidden group-hover:scale-105 transition-transform duration-300">
              {(() => {
                const iconSrc = getImageAssetUrl(app.icon);

                return iconSrc ? (
                  <Image 
                    src={iconSrc} 
                    alt={app.name} 
                    fill
                    className="object-contain p-2"
                    sizes="64px"
                    unoptimized
                  />
                ) : (
                  app.icon || "🏛️"
                );
              })()}
            </div>
            <div className="flex-grow text-center md:text-left">
              <div className="flex items-center justify-center md:justify-start gap-2 mb-1.5 flex-wrap">
                <h3 className="text-lg font-bold text-foreground">{app.name}</h3>
                {app.categories?.slice(0, 3).map(cat => (
                  <Chip key={cat} size="sm" variant="soft" className="font-bold text-[10px] uppercase tracking-wider">{cat}</Chip>
                ))}
                {(app.categories?.length || 0) > 3 && (
                  <Chip size="sm" variant="soft" className="font-bold text-[10px] uppercase tracking-wider">+{app.categories!.length - 3}</Chip>
                )}
              </div>
              <div className="text-sm text-muted line-clamp-2 mb-3 max-w-3xl">{app.description || <span className="italic opacity-50">Keine Beschreibung</span>}</div>
              <div className="flex items-center justify-center md:justify-start gap-3">
                <div className="text-[10px] font-mono text-muted bg-surface-secondary px-2 py-1 rounded-md border border-border/50 flex items-center gap-1.5">
                  <span className="opacity-50">ID:</span> {app.id}
                </div>
                {app.status && (
                  <div className="text-[10px] font-bold text-accent bg-accent/10 px-2 py-1 rounded-md border border-accent/20 uppercase tracking-wider">
                    {getAppStatusLabel(app.status) || app.status}
                  </div>
                )}
                {app.isLocked && (
                  <div className="text-[10px] font-bold text-warning bg-warning/10 px-2 py-1 rounded-md border border-warning/20 uppercase tracking-wider flex items-center gap-1">
                    <Lock className="w-3 h-3" /> Gesperrt
                  </div>
                )}
                {app.owner && (
                  <div className="text-[10px] font-medium text-muted-foreground bg-surface-secondary px-2 py-1 rounded-md border border-border/50 flex items-center gap-1.5" title={`Eingereicht von ${app.owner.username} (${app.owner.email})`}>
                    <User className="w-3 h-3 opacity-50" />
                    <span className="opacity-70 italic">von</span> {app.owner.username}
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-row gap-2 flex-shrink-0 w-full md:w-auto mt-4 md:mt-0 items-center justify-end">
              <Button 
                size="sm" 
                variant="secondary"
                onPress={() => router.push(`/apps/${app.id}`)}
                className="font-bold gap-2 hidden md:flex"
              >
                <ExternalLink className="w-4 h-4 text-muted" />
                Ansehen
              </Button>
              <Button 
                size="sm" 
                variant="secondary"
                onPress={() => handleEditApp(app)}
                className="font-bold gap-2 flex-1 md:flex-none"
              >
                <Pencil className="w-4 h-4 text-muted" />
                Bearbeiten
              </Button>
              
              <Dropdown>
                <Button aria-label="Weitere Aktionen" size="sm" variant="secondary" isIconOnly>
                  <MoreVertical className="w-4 h-4" />
                </Button>
                <Dropdown.Popover>
                  <Dropdown.Menu aria-label="Aktionen" onAction={(key) => {
                    if (key === 'view') router.push(`/apps/${app.id}`);
                    if (key === 'lock') handleToggleAppLock(app);
                    if (key === 'delete') handleDeleteApp(app.id);
                  }}>
                    <Dropdown.Item id="view" textValue="Ansehen" className="md:hidden">
                      <div className="flex items-center gap-2">
                        <ExternalLink className="w-4 h-4" /> Ansehen
                      </div>
                    </Dropdown.Item>
                    <Dropdown.Item id="details" textValue="Details">
                      <div className="flex items-center gap-2">
                        <Info className="w-4 h-4" /> Details
                      </div>
                    </Dropdown.Item>
                    <Dropdown.Item id="lock" textValue={app.isLocked ? 'Freigeben' : 'Sperren'} className={app.isLocked ? "text-success" : "text-warning"}>
                      <div className="flex items-center gap-2">
                        {app.isLocked ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                        {app.isLocked ? 'Freigeben' : 'Sperren'}
                      </div>
                    </Dropdown.Item>
                    <Dropdown.Item id="delete" textValue="Löschen" className="text-danger">
                       <div className="flex items-center gap-2">
                        <Trash2 className="w-4 h-4" /> Löschen
                      </div>
                    </Dropdown.Item>
                  </Dropdown.Menu>
                </Dropdown.Popover>
              </Dropdown>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
