'use client';
import { useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'sonner';
import { DatabaseBackup, Download, Upload, TriangleAlert, MonitorSmartphone, LogOut, RotateCcw, Info } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import PageContainer from '@/components/layout/PageContainer';
import PermissionGuard from '@/components/layout/PermissionGuard';
import SectionCard from '@/components/common/SectionCard';
import StatusBadge from '@/components/common/StatusBadge';
import LoadingSkeleton from '@/components/common/LoadingSkeleton';
import NetworkError from '@/components/feedback/NetworkError';
import ConfirmDialog from '@/components/modals/ConfirmDialog';
import { useGetBackupsQuery, useExportBackupMutation, useLogBackupMutation, useRestoreBackupMutation, useResetDemoMutation } from '@/redux/api/systemApi';
import { useGetSessionsQuery, useEndSessionMutation } from '@/redux/api/authApi';
import { baseApi, errorMessage } from '@/redux/api/baseApi';
import { setSyncStatus } from '@/redux/slices/syncSlice';
import { SYNC_STATES } from '@/constants';
import { useAuth } from '@/hooks/useAuth';
import { downloadUrl } from '@/lib/files';
import { fmtDateTime, toDay } from '@/lib/dates';

export default function BackupPage() {
  const { isAdmin } = useAuth(); const dispatch = useDispatch(); const sync = useSelector((s) => s.sync);
  const { data, isLoading, error, refetch } = useGetBackupsQuery(); const { data: ses } = useGetSessionsQuery(); const [endSession] = useEndSessionMutation();
  const [exportDb, { isLoading: exporting }] = useExportBackupMutation(); const [logBackup] = useLogBackupMutation(); const [restore, { isLoading: restoring }] = useRestoreBackupMutation(); const [reset, { isLoading: resetting }] = useResetDemoMutation();
  const [file, setFile] = useState(null); const [confirmReset, setConfirmReset] = useState(false); const input = useRef(null);
  const download = async () => {
    try { const r = await exportDb().unwrap(); const url = URL.createObjectURL(new Blob([r.json], { type: 'application/json' })); downloadUrl(url, `rent-a-car-backup-${toDay()}.json`); setTimeout(() => URL.revokeObjectURL(url), 1500); await logBackup().unwrap(); toast.success('Backup file saved to your Downloads folder'); }
    catch (e) { toast.error(errorMessage(e)); }
  };
  const afterReplace = () => { dispatch(baseApi.util.resetApiState()); toast.success('Done. Data has been replaced.'); refetch(); };
  const doRestore = async () => { try { await restore(file.text).unwrap(); setFile(null); afterReplace(); } catch (e) { toast.error(errorMessage(e)); setFile(null); } };
  return (
    <PermissionGuard perm="backup.view" page>
      <PageHeader title="Backup & Security" subtitle="Keep a copy of your data safe and control who is logged in." />
      <PageContainer>
        <div className="flex gap-3 rounded-2xl border border-warning/40 bg-warning/10 p-4 text-sm"><TriangleAlert className="text-orange-500 shrink-0" /><p><b>Demo mode.</b> Your data lives only inside this browser. No online or automatic backup is running, so nothing here is confirmed by a server. Use <b>Download Backup File</b> to save a real copy on your computer. When the real server and offline database are connected, automatic backups will show here with confirmed times.</p></div>
        {isLoading ? <SectionCard><LoadingSkeleton rows={3} cols={4} /></SectionCard> : error ? <SectionCard><NetworkError error={error} onRetry={refetch} /></SectionCard> : (
          <>
            <div className="grid gap-4 lg:grid-cols-3">
              <SectionCard title="Backup Status" className="lg:col-span-2">
                <dl className="grid sm:grid-cols-2 gap-3 text-sm">
                  <div className="rounded-xl bg-soft border border-line p-3"><dt className="text-muted text-xs">Last backup you saved</dt><dd className="font-bold text-base">{data.lastRealBackupAt ? fmtDateTime(data.lastRealBackupAt) : 'No backup saved yet'}</dd></div>
                  <div className="rounded-xl bg-soft border border-line p-3"><dt className="text-muted text-xs">Automatic backup</dt><dd className="font-bold text-base text-muted">Not connected (demo)</dd></div>
                  <div className="rounded-xl bg-soft border border-line p-3"><dt className="text-muted text-xs">Records stored here</dt><dd className="font-semibold">{data.records.customers} customers · {data.records.cars} cars · {data.records.bookings} bookings · {data.records.payments} payments</dd></div>
                  <div className="rounded-xl bg-soft border border-line p-3"><dt className="text-muted text-xs">Data size</dt><dd className="font-semibold">{(data.storageKB / 1024).toFixed(2)} MB</dd></div>
                </dl>
                {isAdmin ? <div className="flex flex-wrap gap-2 mt-4"><button className="btn btn-primary" onClick={download} disabled={exporting}><Download size={16} />{exporting ? 'Preparing…' : 'Download Backup File'}</button>
                  <button className="btn btn-outline" onClick={() => input.current?.click()}><Upload size={16} />Restore From Backup File</button><button className="btn btn-neutral" onClick={() => setConfirmReset(true)}><RotateCcw size={16} />Reset Demo Data</button>
                  <input ref={input} type="file" accept="application/json,.json" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (!f) return; if (f.size > 20 * 1024 * 1024) return toast.error('This file is too large.'); setFile({ name: f.name, text: await f.text() }); }} /></div> : <p className="text-sm text-muted mt-4">Only the owner can download or restore backups.</p>}
              </SectionCard>
              <SectionCard title="Sync Status (Preview)" subtitle="For the future offline desktop app">
                <p className="text-sm mb-3">Now: <b>{(SYNC_STATES[!sync.online ? 'offline' : sync.status] || SYNC_STATES.synced).label}</b></p>
                <div className="flex flex-wrap gap-1.5">{['pending', 'syncing', 'synced', 'failed', 'conflict'].map((k) => <button key={k} className="chip" onClick={() => dispatch(setSyncStatus(k))}>{SYNC_STATES[k].label}</button>)}</div>
                <p className="text-xs text-muted mt-3 flex gap-1.5"><Info size={14} className="shrink-0" />These buttons only preview how each state looks in the top bar. Nothing is really syncing yet.</p>
              </SectionCard>
            </div>
            <SectionCard title="Backup History">
              <div className="overflow-x-auto"><table className="table-clean min-w-[560px]"><thead><tr><th>Date & Time</th><th>Type</th><th>Size</th><th>Status</th><th>Note</th></tr></thead>
                <tbody>{data.items.map((b) => <tr key={b.id}><td className="whitespace-nowrap">{fmtDateTime(b.at)}</td><td>{b.type}</td><td>{b.size}</td><td><StatusBadge tone={b.status.startsWith('Sample') ? 'neutral' : 'success'}>{b.status}</StatusBadge></td><td className="text-xs text-muted">{b.note}</td></tr>)}</tbody></table></div>
            </SectionCard>
          </>
        )}
        <SectionCard title="Security & Sessions" subtitle="Places where your account is logged in (sample list in demo mode)">
          <ul className="divide-y divide-line">{(ses?.items || []).map((s) => <li key={s.id} className="flex items-center gap-3 py-3"><span className="grid place-items-center size-10 rounded-xl bg-primary/10 text-primary"><MonitorSmartphone size={18} /></span><div className="flex-1 min-w-0"><p className="font-semibold text-sm">{s.device}{s.current && <span className="badge badge-success ml-2">This device</span>}</p><p className="text-xs text-muted">{s.place} · {fmtDateTime(s.at)}</p></div>{!s.current && <button className="btn btn-neutral btn-sm" onClick={async () => { try { await endSession(s.id).unwrap(); toast.success('Session ended'); } catch (e) { toast.error(errorMessage(e)); } }}><LogOut size={14} />End Session</button>}</li>)}</ul>
        </SectionCard>
      </PageContainer>
      <ConfirmDialog open={!!file} danger title="Restore from this file?" message={`All current data will be replaced by the data in “${file?.name}”. This cannot be undone. Download a backup first if you are not sure.`} confirmLabel="Yes, Restore" loading={restoring} onConfirm={doRestore} onCancel={() => setFile(null)} />
      <ConfirmDialog open={confirmReset} danger title="Reset demo data?" message="All changes you made will be erased and the original sample data will be loaded again." confirmLabel="Yes, Reset" loading={resetting} onConfirm={async () => { try { await reset().unwrap(); setConfirmReset(false); afterReplace(); } catch (e) { toast.error(errorMessage(e)); setConfirmReset(false); } }} onCancel={() => setConfirmReset(false)} />
      <span className="hidden"><DatabaseBackup /></span>
    </PermissionGuard>
  );
}
