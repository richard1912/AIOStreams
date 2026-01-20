import React from 'react';
import { Modal } from '@/components/ui/modal';
import { TextInput } from '@/components/ui/text-input';
import { Button } from '@/components/ui/button';
import { UserConfigAPI } from '@/services/api';
import { useUserData } from '@/context/userData';
import { toast } from 'sonner';
import { PasswordInput } from './ui/password-input';

interface ConfigModalProps {
  open: boolean;
  onSuccess: () => void;
  onOpenChange: (v: boolean) => void;
  initialUuid?: string;
}

export function ConfigModal({
  open,
  onSuccess,
  onOpenChange,
  initialUuid,
}: ConfigModalProps) {
  const { setUserData, setUuid, setPassword, setEncryptedPassword } =
    useUserData();
  const [uuid, setUuidInput] = React.useState(initialUuid || '');
  const [password] = React.useState('mash4077'); // Password verification disabled
  const [loading, setLoading] = React.useState(false);
  const [autoLoaded, setAutoLoaded] = React.useState(false);

  const loadConfig = async (targetUuid: string) => {
    setLoading(true);
    try {
      const result = await UserConfigAPI.loadConfig(targetUuid, password);

      if (!result.success || !result.data) {
        toast.error(result.error?.message || 'Failed to load configuration');
        return;
      }

      setUserData((prev) => ({
        ...prev,
        ...result.data!.config,
      }));
      setUuid(targetUuid);
      setPassword(password);
      setEncryptedPassword(result.data.encryptedPassword);
      onSuccess();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to load configuration'
      );
    } finally {
      setLoading(false);
    }
  };

  // Auto-load when initialUuid is provided and modal opens
  React.useEffect(() => {
    if (open && initialUuid && !autoLoaded) {
      setAutoLoaded(true);
      loadConfig(initialUuid);
    }
  }, [open, initialUuid, autoLoaded]);

  // Reset autoLoaded flag when modal closes
  React.useEffect(() => {
    if (!open) {
      setAutoLoaded(false);
    }
  }, [open]);

  // Handle initialUuid changes
  React.useEffect(() => {
    if (initialUuid) {
      setUuidInput(initialUuid);
    } else {
      setUuidInput('');
    }
  }, [initialUuid]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    await loadConfig(uuid);
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  // Don't show modal if auto-loading with initialUuid
  if (initialUuid && loading) {
    return null;
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Load Configuration">
      <form onSubmit={handleSubmit} className="space-y-4">
        <TextInput
          label="UUID"
          id="uuid"
          value={uuid}
          onValueChange={(value) => setUuidInput(value)}
          placeholder="Enter your configuration UUID"
          required
          disabled={!!initialUuid}
        />
        {/* Password field hidden - verification disabled for private instance */}
        <div className="flex justify-end gap-2">
          <Button type="button" onClick={handleCancel}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            Load
          </Button>
        </div>
      </form>
    </Modal>
  );
}
