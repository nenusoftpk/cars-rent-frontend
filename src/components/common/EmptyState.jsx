import { Inbox } from 'lucide-react';
export default function EmptyState({ icon: Icon = Inbox, title = 'Nothing here yet', message, action }) {
  return (
    <div className="flex flex-col items-center text-center py-12 px-4">
      <span className="grid place-items-center size-16 rounded-2xl bg-primary/10 text-primary mb-4"><Icon size={30} /></span>
      <h3 className="text-base font-bold text-heading">{title}</h3>
      {message && <p className="text-sm text-muted mt-1 max-w-sm">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
