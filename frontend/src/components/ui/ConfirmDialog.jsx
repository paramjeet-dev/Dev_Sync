import Modal from './Modal';

export default function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Confirm',
  danger = false,
  busy = false,
  error = null,
  onConfirm,
  onClose,
}) {
  return (
    <Modal title={title} onClose={busy ? () => {} : onClose}>
      <p className="modal-text">{message}</p>
      {error && <div className="auth-error modal-error">{error}</div>}
      <div className="modal-actions">
        <button type="button" onClick={onClose} disabled={busy}>
          Cancel
        </button>
        <button
          type="button"
          className={danger ? 'danger-solid' : 'primary'}
          onClick={onConfirm}
          disabled={busy}
          autoFocus
        >
          {busy ? 'Working…' : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
