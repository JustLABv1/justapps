'use client';

import { AppConfig } from '@/config/apps';
import { Input, Label, Switch, TextArea, TextField } from '@heroui/react';
import { Server, Terminal } from 'lucide-react';

interface DeploymentTabProps {
  formData: Partial<AppConfig>;
  setFormData: React.Dispatch<React.SetStateAction<Partial<AppConfig>>>;
}

export function DeploymentTab({ formData, setFormData }: DeploymentTabProps) {
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted">
        Hier können technische Installationsanleitungen hinterlegt werden. Dieser Bereich kann unabhängig von Nachnutzung aktiviert werden.
      </p>
      <div className="flex items-center justify-between p-4 rounded-xl bg-surface border border-border">
        <div>
          <span className="text-sm font-bold text-foreground">Deployment Assistant aktivieren</span>
          <p className="text-xs text-muted">Zeigt Docker/Compose/Helm-Kommandos in der App-Detailseite an.</p>
        </div>
        <Switch
          isSelected={formData.hasDeploymentAssistant ?? true}
          onChange={(val) => setFormData((p) => ({ ...p, hasDeploymentAssistant: val }))}
        >
          <Switch.Control><Switch.Thumb /></Switch.Control>
        </Switch>
      </div>

      {formData.hasDeploymentAssistant !== false && (
        <>
          <div className="grid grid-cols-3 gap-3">
            {([
              { key: 'showHelm', label: 'Helm Chart', icon: <Server className="w-4 h-4" /> },
              { key: 'showCompose', label: 'Docker Compose', icon: <Terminal className="w-4 h-4" /> },
              { key: 'showDocker', label: 'Docker', icon: <Terminal className="w-4 h-4" /> },
            ] as const).map(({ key, label, icon }) => {
              const active = formData[key] !== false;
              return (
                <button
                  key={key}
                  type="button"
                onClick={() => setFormData((p) => {
                  const currentlyActive = p[key] !== false;

                  return { ...p, [key]: !currentlyActive };
                })}
                  className={`p-3 rounded-xl border-2 text-center flex flex-col items-center gap-2 transition-all ${
                    active ? 'border-accent bg-accent/5 text-accent' : 'border-border bg-surface text-muted'
                  }`}
                >
                  {icon}
                  <span className="text-xs font-semibold">{label}</span>
                  <span className="text-[10px]">{active ? 'Aktiv' : 'Ausgeblendet'}</span>
                </button>
              );
            })}
          </div>

          {formData.showHelm !== false && (
            <div className="space-y-3 bg-surface/50 p-5 rounded-2xl border border-border">
              <div className="flex items-center gap-2 border-b border-border pb-2">
                <Server className="w-4 h-4 text-muted" />
                <span className="text-sm font-bold">Helm Chart</span>
              </div>
              <TextField onChange={(val) => setFormData((p) => ({ ...p, helmRepo: val }))}>
                <Label className="text-[10px] font-bold text-muted uppercase tracking-wider">Helm Chart Repo</Label>
                <Input value={formData.helmRepo || ''} placeholder="oci://..." className="bg-field-background font-mono text-sm" />
              </TextField>
              <TextField onChange={(val) => setFormData((p) => ({ ...p, customHelmCommand: val }))}>
                <Label className="text-[10px] font-bold text-muted uppercase tracking-wider">Benutzerdefiniertes Helm-Kommando</Label>
                <TextArea value={formData.customHelmCommand || ''} className="bg-field-background font-mono text-sm" placeholder={`helm repo add bund https://...\nhelm install ${formData.id || 'appname'} bund/${formData.id || 'appname'}`} />
              </TextField>
              <TextField onChange={(val) => setFormData((p) => ({ ...p, customHelmValues: val }))}>
                <Label className="text-[10px] font-bold text-muted uppercase tracking-wider">Values.yaml Inhalt</Label>
                <TextArea value={formData.customHelmValues || ''} className="bg-field-background font-mono text-sm" placeholder="image:\n  tag: latest\nreplicas: 1" />
              </TextField>
              <TextField onChange={(val) => setFormData((p) => ({ ...p, customHelmNote: val }))}>
                <Label className="text-[10px] font-bold text-muted uppercase tracking-wider">Hinweis</Label>
                <Input value={formData.customHelmNote || ''} placeholder="Zusätzliche Hinweise..." className="bg-field-background" />
              </TextField>
            </div>
          )}

          {formData.showCompose !== false && (
            <div className="space-y-3 bg-surface/50 p-5 rounded-2xl border border-border">
              <div className="flex items-center gap-2 border-b border-border pb-2">
                <Terminal className="w-4 h-4 text-muted" />
                <span className="text-sm font-bold">Docker Compose</span>
              </div>
              <TextField onChange={(val) => setFormData((p) => ({ ...p, customComposeCommand: val }))}>
                <Label className="text-[10px] font-bold text-muted uppercase tracking-wider">Compose-Setup</Label>
                <TextArea value={formData.customComposeCommand || ''} className="bg-field-background font-mono text-sm" placeholder={`version: '3.8'\nservices:\n  ${formData.id || 'app'}:\n    image: ...`} />
              </TextField>
              <TextField onChange={(val) => setFormData((p) => ({ ...p, customComposeNote: val }))}>
                <Label className="text-[10px] font-bold text-muted uppercase tracking-wider">Hinweis</Label>
                <Input value={formData.customComposeNote || ''} className="bg-field-background" />
              </TextField>
            </div>
          )}

          {formData.showDocker !== false && (
            <div className="space-y-3 bg-surface/50 p-5 rounded-2xl border border-border">
              <div className="flex items-center gap-2 border-b border-border pb-2">
                <Terminal className="w-4 h-4 text-muted" />
                <span className="text-sm font-bold">Docker</span>
              </div>
              <TextField onChange={(val) => setFormData((p) => ({ ...p, dockerRepo: val }))}>
                <Label className="text-[10px] font-bold text-muted uppercase tracking-wider">Docker Image</Label>
                <Input value={formData.dockerRepo || ''} placeholder="image:latest" className="bg-field-background font-mono text-sm" />
              </TextField>
              <TextField onChange={(val) => setFormData((p) => ({ ...p, customDockerCommand: val }))}>
                <Label className="text-[10px] font-bold text-muted uppercase tracking-wider">Docker-Kommando</Label>
                <TextArea value={formData.customDockerCommand || ''} className="bg-field-background font-mono text-sm" placeholder={`docker pull ...\ndocker run -d --name ${formData.id || 'app'} -p 8080:80 ...`} />
              </TextField>
              <TextField onChange={(val) => setFormData((p) => ({ ...p, customDockerNote: val }))}>
                <Label className="text-[10px] font-bold text-muted uppercase tracking-wider">Hinweis</Label>
                <Input value={formData.customDockerNote || ''} className="bg-field-background" />
              </TextField>
            </div>
          )}
        </>
      )}
    </div>
  );
}
