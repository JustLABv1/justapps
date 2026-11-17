'use client';

import { AlertDialog } from '@/components/panelui/alert-dialog';
import { Button } from '@/components/panelui/button';

interface ConfirmDialogProps {
  confirmLabel?: string;
  description: string;
  isDanger?: boolean;
  isLoading?: boolean;
  isOpen: boolean;
  onConfirm: () => void | Promise<void>;
  onOpenChange: (open: boolean) => void;
  title: string;
}

/**
 * Asks before something that cannot be undone. The caller closes it when the
 * work is done, so a failed request leaves it open with the message beside it.
 */
export function ConfirmDialog({
  confirmLabel = 'Bestätigen',
  description,
  isDanger = false,
  isLoading = false,
  isOpen,
  onConfirm,
  onOpenChange,
  title,
}: ConfirmDialogProps) {
  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => { if (!isLoading) onOpenChange(open); }}>
      <AlertDialog.Content tone={isDanger ? 'destructive' : undefined}>
        <AlertDialog.Title>{title}</AlertDialog.Title>
        <AlertDialog.Description>{description}</AlertDialog.Description>
        <AlertDialog.Footer>
          <AlertDialog.Cancel disabled={isLoading}>Abbrechen</AlertDialog.Cancel>
          <Button variant={isDanger ? 'destructive' : 'default'} loading={isLoading} onClick={() => void onConfirm()}>
            {confirmLabel}
          </Button>
        </AlertDialog.Footer>
      </AlertDialog.Content>
    </AlertDialog>
  );
}
