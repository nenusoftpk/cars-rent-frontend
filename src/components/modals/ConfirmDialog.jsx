'use client';
import { TriangleAlert } from 'lucide-react';
import AppModal from './AppModal';

export default function ConfirmDialog({ open, title = 'Are you sure?', message, confirmLabel = 'Yes, Continue', cancelLabel = 'Cancel', danger = false, loading = false, onConfirm, onCancel, children }) {
  return (
    <AppModal open={open} onClose={onCancel} size="sm" title={title}
      footer={<><button className="btn btn-neutral" onClick={onCancel} disabled={loading}>{cancelLabel}</button><button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm} disabled={loading}>{loading ? 'Please wait…' : confirmLabel}</button></>}>
      <div className="flex gap-3"><span className={`grid place-items-center size-10 rounded-full shrink-0 ${danger ? 'bg-danger/10 text-danger' : 'bg-warning/15 text-warning'}`}><TriangleAlert size={20} /></span>
        <div className="text-sm text-heading space-y-3"><p>{message}</p>{children}</div></div>
    </AppModal>
  );
}
