import { useState } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Input } from './Input';

interface InputDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (value: string) => void;
  title: string;
  message?: string;
  placeholder?: string;
  defaultValue?: string;
  confirmText?: string;
  cancelText?: string;
  inputType?: 'text' | 'password';
  validation?: (value: string) => string | null; // Returns error message or null
}

export function InputDialog({
  isOpen,
  onClose,
  onSubmit,
  title,
  message,
  placeholder = '',
  defaultValue = '',
  confirmText = 'Submit',
  cancelText = 'Cancel',
  inputType = 'text',
  validation
}: InputDialogProps) {
  const [value, setValue] = useState(defaultValue);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    
    // Validate if validator provided
    if (validation) {
      const validationError = validation(value);
      if (validationError) {
        setError(validationError);
        return;
      }
    }
    
    // Submit if value is not empty
    if (value.trim()) {
      onSubmit(value);
      onClose();
      // Reset state
      setValue(defaultValue);
      setError(null);
    }
  };

  const handleClose = () => {
    onClose();
    // Reset state
    setValue(defaultValue);
    setError(null);
  };

  // Reset value when dialog opens
  const handleOpen = () => {
    setValue(defaultValue);
    setError(null);
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={title}>
      <form onSubmit={handleSubmit} className="space-y-6">
        {message && <p className="text-zinc-300 leading-relaxed">{message}</p>}
        
        <Input
          type={inputType}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null); // Clear error on change
          }}
          placeholder={placeholder}
          autoFocus
          error={error || undefined}
        />
        
        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={handleClose}>
            {cancelText}
          </Button>
          <Button type="submit" variant="primary">
            {confirmText}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
