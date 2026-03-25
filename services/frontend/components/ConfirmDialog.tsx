'use client';

import { Button, Modal } from '@heroui/react';
import { AlertTriangle, Loader2 } from 'lucide-react';

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
    <Modal>
      <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
        <Modal.Container>
          <Modal.Dialog className="sm:max-w-md">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Icon className={isDanger ? 'bg-danger/10 text-danger' : 'bg-warning/10 text-warning'}>
                <AlertTriangle className="w-5 h-5" />
              </Modal.Icon>
              <Modal.Heading>{title}</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <p className="text-sm text-muted">{description}</p>
            </Modal.Body>
            <Modal.Footer>
              <div className="flex w-full justify-end gap-3">
                <Button variant="secondary" onPress={() => onOpenChange(false)}>
                  Abbrechen
                </Button>
                <Button
                  className={isDanger ? 'bg-danger text-danger-foreground' : undefined}
                  isDisabled={isLoading}
                  onPress={() => void onConfirm()}
                  variant={isDanger ? 'danger' : 'primary'}
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {confirmLabel}
                </Button>
              </div>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}