import Link from 'next/link';
import { WifiOff, ServerCrash, ShieldAlert, LogIn } from 'lucide-react';
import EmptyState from '@/components/common/EmptyState';

// One component for every failure: offline, server error, permission denied, expired session.
export default function NetworkError({ error, onRetry }) {
  const s = error?.status; const msg = error?.data?.message;
  if (s === 403) return <EmptyState icon={ShieldAlert} title="Permission denied" message={msg || 'You do not have permission to see this. Please ask the owner.'} />;
  if (s === 401) return <EmptyState icon={LogIn} title="Session expired" message="Please log in again to continue." action={<Link href="/login" className="btn btn-primary">Log in</Link>} />;
  const offline = s === 'FETCH_ERROR';
  return (
    <EmptyState icon={offline ? WifiOff : ServerCrash} title={offline ? 'Unable to connect' : 'Something went wrong'}
      message={offline ? 'Unable to connect. Please check your internet and try again.' : msg || 'The server could not complete this request.'}
      action={onRetry && <button className="btn btn-primary" onClick={onRetry}>Try Again</button>} />
  );
}
