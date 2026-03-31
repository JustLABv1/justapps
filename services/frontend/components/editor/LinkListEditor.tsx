'use client';

import { Button, Input, Label, TextField } from '@heroui/react';
import { Plus, Trash2 } from 'lucide-react';

interface LinkItem {
  label: string;
  url: string;
}

interface LinkListEditorProps {
  title: string;
  icon: React.ReactNode;
  items: LinkItem[];
  onChange: (items: LinkItem[]) => void;
  addLabel: string;
  placeholderLabel: string;
  placeholderUrl: string;
}

export function LinkListEditor({
  title, icon, items, onChange, addLabel, placeholderLabel, placeholderUrl,
}: LinkListEditorProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-xs font-bold text-muted uppercase tracking-wider">{title}</span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onPress={() => onChange([...items, { label: placeholderLabel, url: '' }])}
          className="h-auto min-w-0 gap-1 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-accent"
        >
          <Plus className="w-3 h-3" />{addLabel}
        </Button>
      </div>
      {items.map((item, idx) => (
        <div key={idx} className="grid grid-cols-12 gap-2 items-end">
          <div className="col-span-4">
            <TextField onChange={(val) => { const f = [...items]; f[idx] = { ...f[idx], label: val }; onChange(f); }}>
              <Label className="text-[10px] font-bold text-muted uppercase tracking-wider mb-1">Bezeichnung</Label>
              <Input value={item.label} placeholder={placeholderLabel} className="bg-field-background h-8 text-sm" />
            </TextField>
          </div>
          <div className="col-span-7">
            <TextField onChange={(val) => { const f = [...items]; f[idx] = { ...f[idx], url: val }; onChange(f); }}>
              <Label className="text-[10px] font-bold text-muted uppercase tracking-wider mb-1">Adresse</Label>
              <Input value={item.url} placeholder={placeholderUrl} className="bg-field-background h-8 font-mono text-sm" />
            </TextField>
          </div>
          <Button
            type="button"
            isIconOnly
            size="sm"
            variant="danger-soft"
            onPress={() => { const f = [...items]; f.splice(idx, 1); onChange(f); }}
            aria-label={`${title} entfernen ${idx + 1}`}
            className="col-span-1 h-8 w-8 min-w-0"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      ))}
    </div>
  );
}
