// PATH: src/app/backup/page.jsx   (or security/page.jsx)
'use client';

import { useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'sonner';
import {
  DatabaseBackup,
  Download,
  Upload,
  TriangleAlert,
  MonitorSmartphone,
  LogOut,
  RotateCcw,
  Info,
} from 'lucide-react';

import PageHeader from '@/components/layout/PageHeader';
import PageContainer from '@/components/layout/PageContainer';
import PermissionGuard from '@/components/layout/PermissionGuard';
import SectionCard from '@/components/common/SectionCard';
import StatusBadge from '@/components/common/StatusBadge';
import LoadingSkeleton from '@/components/common/LoadingSkeleton';
import NetworkError from '@/components/feedback/NetworkError';
import ConfirmDialog from '@/components/modals/ConfirmDialog';
import EmptyState from '@/components/common/EmptyState';

import { baseApi, errorMessage } from '@/redux/api/baseApi';
import { setSyncStatus } from '@/redux/slices/syncSlice';
import { SYNC_STATES } from '@/constants';
import { useAuth } from '@/hooks/useAuth';
import { downloadUrl } from '@/lib/files';
import { fmtDateTime, toDay } from '@/lib/dates';

// --------------------------------------------------
// Safe import of systemApi hooks (they may not exist yet)
// --------------------------------------------------
let useGetBackupsQuery = () => ({ data: null, isLoading: false, error: null, refetch: () => {} });
let useExportBackupMutation = () => [async () => ({ unwrap: async () => ({}) }), { isLoading: false }];
let useLogBackupMutation = () => [async () => ({ unwrap: async () => ({}) }), { isLoading: false }];
let useRestoreBackupMutation = () => [async () => ({ unwrap: async () => ({}) }), { isLoading: false }];
let useResetDemoMutation = () => [async () => ({ unwrap: async () => ({}) }), { isLoading: false }];

try {
  // Dynamic require so the page doesn't crash if the hooks are missing
  const systemApi = require('@/redux/api/systemApi');
  if (systemApi.useGetBackupsQuery) useGetBackupsQuery = systemApi.useGetBackupsQuery;
  if (systemApi.useExportBackupMutation) useExportBackupMutation = systemApi.useExportBackupMutation;
  if (systemApi.useLogBackupMutation) useLogBackupMutation = systemApi.useLogBackupMutation;
  if (systemApi.useRestoreBackupMutation) useRestoreBackupMutation = systemApi.useRestoreBackupMutation;
  if (systemApi.useResetDemoMutation) useResetDemoMutation = systemApi.useResetDemoMutation;
} catch (e) {
  // systemApi not ready yet – stay in pure demo mode
}

// Sessions (also may not exist)
let useGetSessionsQuery = () => ({ data: { items: [] } });
let useEndSessionMutation = () => [async () => ({ unwrap: async () => ({}) })];

try {
  const authApi = require('@/redux/api/authApi');
  if (authApi.useGetSessionsQuery) useGetSessionsQuery = authApi.useGetSessionsQuery;
  if (authApi.useEndSessionMutation) useEndSessionMutation = authApi.useEndSessionMutation;
} catch (e) {}

export default function BackupPage() {
  const { isAdmin } = useAuth();
  const dispatch = useDispatch();
  const sync = useSelector((s) => s.sync);

  const { data, isLoading, error, refetch } = useGetBackupsQuery();
  const { data: sessionsData } = useGetSessionsQuery();
  const [endSession] = useEndSessionMutation();

  const [exportDb, { isLoading: exporting }] = useExportBackupMutation();
  const [logBackup] = useLogBackupMutation();
  const [restore, { isLoading: restoring }] = useRestoreBackupMutation();
  const [resetDemo, { isLoading: resetting }] = useResetDemoMutation();

  const [file, setFile] = useState(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const fileInputRef = useRef(null);

  const sessions = sessionsData?.items || sessionsData || [];

  // ---------- Actions ----------
  const handleDownload = async () => {
    try {
      const result = await exportDb().unwrap();
      const content = result?.json || JSON.stringify(result || {}, null, 2);
      const blob = new Blob([content], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      downloadUrl(url, `rent-a-car-backup-${toDay()}.json`);
      setTimeout(() => URL.revokeObjectURL(url), 2000);

      try {
        await logBackup().unwrap();
      } catch {}

      toast.success('Backup file saved to your Downloads folder');
    } catch (err) {
      toast.error(errorMessage(err) || 'Backup is not available in this mode');
    }
  };

  const handleFileSelect = async (e) => {
    const selected = e.target.files?.[0];
    e.target.value = '';

    if (!selected) return;

    if (selected.size > 20 * 1024 * 1024) {
      toast.error('This file is too large (max 20 MB).');
      return;
    }

    if (!selected.name.toLowerCase().endsWith('.json')) {
      toast.error('Please select a valid .json backup file.');
      return;
    }

    try {
      const text = await selected.text();
      JSON.parse(text); // validate
      setFile({ name: selected.name, text });
    } catch {
      toast.error('Invalid backup file. It must be valid JSON.');
    }
  };

  const afterDataReplace = () => {
    dispatch(baseApi.util.resetApiState());
    toast.success('Done. Data has been replaced.');
    refetch();
  };

  const handleRestore = async () => {
    if (!file?.text) return;
    try {
      await restore(file.text).unwrap();
      setFile(null);
      afterDataReplace();
    } catch (err) {
      toast.error(errorMessage(err) || 'Restore failed');
      setFile(null);
    }
  };

  const handleResetDemo = async () => {
    try {
      await resetDemo().unwrap();
      setConfirmReset(false);
      afterDataReplace();
    } catch (err) {
      toast.error(errorMessage(err) || 'Reset failed');
      setConfirmReset(false);
    }
  };

  const handleEndSession = async (sessionId) => {
    try {
      await endSession(sessionId).unwrap();
      toast.success('Session ended');
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  // ---------- Render ----------
  return (
    <PermissionGuard perm="backup.view" page>
      <PageHeader
        title="Backup & Security"
        subtitle="Keep a copy of your data safe and control who is logged in."
      />

      <PageContainer>
        {/* Demo mode warning */}
        <div className="flex gap-3 rounded-2xl border border-warning/40 bg-warning/10 p-4 text-sm">
          <TriangleAlert className="text-orange-500 shrink-0 mt-0.5" size={20} />
          <p>
            <b>Demo mode.</b> Your data lives only inside this browser. No online or
            automatic backup is running. Use <b>Download Backup File</b> to save a real
            copy on your computer. When the real server is connected, automatic backups
            will appear here with confirmed times.
          </p>
        </div>

        {isLoading ? (
          <SectionCard>
            <LoadingSkeleton rows={3} cols={4} />
          </SectionCard>
        ) : error ? (
          <SectionCard>
            <NetworkError error={error} onRetry={refetch} />
          </SectionCard>
        ) : (
          <>
            <div className="grid gap-4 lg:grid-cols-3">
              {/* Backup Status */}
              <SectionCard title="Backup Status" className="lg:col-span-2">
                <dl className="grid sm:grid-cols-2 gap-3 text-sm">
                  <div className="rounded-xl bg-soft border border-line p-3">
                    <dt className="text-muted text-xs mb-1">Last backup you saved</dt>
                    <dd className="font-bold text-base">
                      {data?.lastRealBackupAt
                        ? fmtDateTime(data.lastRealBackupAt)
                        : 'No backup saved yet'}
                    </dd>
                  </div>

                  <div className="rounded-xl bg-soft border border-line p-3">
                    <dt className="text-muted text-xs mb-1">Automatic backup</dt>
                    <dd className="font-bold text-base text-muted">
                      Not connected (demo)
                    </dd>
                  </div>

                  <div className="rounded-xl bg-soft border border-line p-3">
                    <dt className="text-muted text-xs mb-1">Records stored here</dt>
                    <dd className="font-semibold">
                      {data?.records?.customers ?? 0} customers ·{' '}
                      {data?.records?.cars ?? 0} cars ·{' '}
                      {data?.records?.bookings ?? 0} bookings ·{' '}
                      {data?.records?.payments ?? 0} payments
                    </dd>
                  </div>

                  <div className="rounded-xl bg-soft border border-line p-3">
                    <dt className="text-muted text-xs mb-1">Data size</dt>
                    <dd className="font-semibold">
                      {((data?.storageKB || 0) / 1024).toFixed(2)} MB
                    </dd>
                  </div>
                </dl>

                {isAdmin ? (
                  <div className="flex flex-wrap gap-2 mt-5">
                    <button
                      className="btn btn-primary"
                      onClick={handleDownload}
                      disabled={exporting}
                    >
                      <Download size={16} />
                      {exporting ? 'Preparing…' : 'Download Backup File'}
                    </button>

                    <button
                      className="btn btn-outline"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload size={16} />
                      Restore From Backup File
                    </button>

                    <button
                      className="btn btn-neutral"
                      onClick={() => setConfirmReset(true)}
                    >
                      <RotateCcw size={16} />
                      Reset Demo Data
                    </button>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="application/json,.json"
                      className="hidden"
                      onChange={handleFileSelect}
                    />
                  </div>
                ) : (
                  <p className="text-sm text-muted mt-4">
                    Only the owner can download or restore backups.
                  </p>
                )}
              </SectionCard>

              {/* Sync Status Preview */}
              <SectionCard
                title="Sync Status (Preview)"
                subtitle="For the future offline desktop app"
              >
                <p className="text-sm mb-3">
                  Now:{' '}
                  <b>
                    {
                      (SYNC_STATES[!sync?.online ? 'offline' : sync?.status] ||
                        SYNC_STATES.synced
                      )?.label
                    }
                  </b>
                </p>

                <div className="flex flex-wrap gap-1.5">
                  {['pending', 'syncing', 'synced', 'failed', 'conflict'].map((key) => (
                    <button
                      key={key}
                      type="button"
                      className="chip"
                      onClick={() => dispatch(setSyncStatus(key))}
                    >
                      {SYNC_STATES[key]?.label || key}
                    </button>
                  ))}
                </div>

                <p className="text-xs text-muted mt-3 flex gap-1.5">
                  <Info size={14} className="shrink-0 mt-0.5" />
                  These buttons only preview how each state looks in the top bar.
                  Nothing is really syncing yet.
                </p>
              </SectionCard>
            </div>

            {/* Backup History */}
            <SectionCard title="Backup History">
              <div className="overflow-x-auto">
                <table className="table-clean min-w-[560px]">
                  <thead>
                    <tr>
                      <th>Date & Time</th>
                      <th>Type</th>
                      <th>Size</th>
                      <th>Status</th>
                      <th>Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.items || []).length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center text-muted py-8">
                          No backup history yet
                        </td>
                      </tr>
                    ) : (
                      data.items.map((b) => (
                        <tr key={b.id || b.at}>
                          <td className="whitespace-nowrap">
                            {fmtDateTime(b.at)}
                          </td>
                          <td>{b.type}</td>
                          <td>{b.size}</td>
                          <td>
                            <StatusBadge
                              tone={
                                String(b.status || '').startsWith('Sample')
                                  ? 'neutral'
                                  : 'success'
                              }
                            >
                              {b.status}
                            </StatusBadge>
                          </td>
                          <td className="text-xs text-muted">{b.note}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          </>
        )}

        {/* Security & Sessions */}
        <SectionCard
          title="Security & Sessions"
          subtitle="Places where your account is logged in"
        >
          <ul className="divide-y divide-line">
            {sessions.length === 0 ? (
              <li className="py-8">
                <EmptyState
                  title="No active sessions"
                  message="Session list will appear when the real backend is connected."
                />
              </li>
            ) : (
              sessions.map((s) => (
                <li key={s.id} className="flex items-center gap-3 py-3">
                  <span className="grid place-items-center size-10 rounded-xl bg-primary/10 text-primary shrink-0">
                    <MonitorSmartphone size={18} />
                  </span>

                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">
                      {s.device || 'Unknown device'}
                      {s.current && (
                        <span className="badge badge-success ml-2">This device</span>
                      )}
                    </p>
                    <p className="text-xs text-muted">
                      {s.place || 'Unknown location'} · {fmtDateTime(s.at)}
                    </p>
                  </div>

                  {!s.current && (
                    <button
                      className="btn btn-neutral btn-sm"
                      onClick={() => handleEndSession(s.id)}
                    >
                      <LogOut size={14} />
                      End Session
                    </button>
                  )}
                </li>
              ))
            )}
          </ul>
        </SectionCard>
      </PageContainer>

      {/* Restore confirmation */}
      <ConfirmDialog
        open={!!file}
        danger
        title="Restore from this file?"
        message={`All current data will be replaced by the data in “${file?.name}”. This cannot be undone. Download a backup first if you are not sure.`}
        confirmLabel="Yes, Restore"
        loading={restoring}
        onConfirm={handleRestore}
        onCancel={() => setFile(null)}
      />

      {/* Reset demo confirmation */}
      <ConfirmDialog
        open={confirmReset}
        danger
        title="Reset demo data?"
        message="All changes you made will be erased and the original sample data will be loaded again."
        confirmLabel="Yes, Reset"
        loading={resetting}
        onConfirm={handleResetDemo}
        onCancel={() => setConfirmReset(false)}
      />

      <span className="hidden">
        <DatabaseBackup />
      </span>
    </PermissionGuard>
  );
}