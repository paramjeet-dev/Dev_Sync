import { useState } from 'react';
import Modal from './Modal';

/** Single-field dialog used for "new board" and "rename board". */
export default function NameDialog({
  title,
  description,
  initial = '',
  placeholder,
  submitLabel,
  busy = false,
  error = null,
  required = false,
  onSubmit,
  onClose,
}) {
  const [value, setValue] = useState(initial);

  function handleSubmit(e) {
    e.preventDefault();
    const trimmed = value.trim();
    if (required && !trimmed) return;
    onSubmit(trimmed);
  }

  return (
    <Modal title={title} onClose={busy ? () => {} : onClose}>
      {description && <p className="modal-text">{description}</p>}
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          maxLength={60}
          autoFocus
        />
        {error && <div className="auth-error modal-error">{error}</div>}
        <div className="modal-actions">
          <button type="button" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="primary" disabled={busy || (required && !value.trim())}>
            {busy ? 'Working…' : submitLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
}
