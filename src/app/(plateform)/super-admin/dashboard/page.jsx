'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import {
  Building2,
  CircleCheck,
  Ban,
  CreditCard,
  Clock,
  AlertTriangle,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react';

import PageBanner from '@/components/layout/PageBanner';
import PageContainer from '@/components/layout/PageContainer';
import StatCard from '@/components/common/StatCard';
import SectionCard from '@/components/common/SectionCard';
import StatusBadge from '@/components/common/StatusBadge';
import EmptyState from '@/components/common/EmptyState';
import NetworkError from '@/components/feedback/NetworkError';

import {
  useListPlatformBusinessesQuery,
  useListPlatformSubscriptionsQuery,
} from '@/redux/api/platformApi';
import { useAuth } from '@/hooks/useAuth';
import { PLATFORM_ROUTES } from '@/hooks/useAuth';
import { fmtDate } from '@/lib/dates';

function pretty(v = '') {
  return String(v)
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function PlatformDashboardPage() {
  const { user } = useAuth();
  const firstName = (user?.name || '').trim().split(' ')[0];

  const {
    data: bizData,
    isLoading: bizLoading,
    error: bizError,
    refetch: refetchBiz,
  } = useListPlatformBusinessesQuery({ pageSize: 10, sort: 'createdAt:desc' });

  const {
    data: subData,
    isLoading: subLoading,
    error: subError,
    refetch: refetchSub,
  } = useListPlatformSubscriptionsQuery({ pageSize: 10 });

  const L = bizLoading || subLoading;
  const error = bizError || subError;

  const businesses = bizData?.items || [];
  const subscriptions = subData?.items || [];

  const stats = useMemo(() => {
    const totalBiz = bizData?.pagination?.total ?? businesses.length;
    const activeBiz = businesses.filter((b) => b.status === 'active').length;
    const suspendedBiz = businesses.filter((b) => b.status === 'suspended').length;

    const totalSub = subscriptions.length;
    const activeSub = subscriptions.filter(
      (r) => (r.subscription?.status || r.status) === 'active'
    ).length;
    const trialSub = subscriptions.filter(
      (r) => (r.subscription?.status || r.status) === 'trialing'
    ).length;
    const problemSub = subscriptions.filter((r) =>
      ['expired', 'suspended'].includes(r.subscription?.status || r.status)
    ).length;

    return {
      totalBiz,
      activeBiz,
      suspendedBiz,
      totalSub,
      activeSub,
      trialSub,
      problemSub,
    };
  }, [bizData, businesses, subscriptions]);

  const refetch = () => {
    refetchBiz();
    refetchSub();
  };

  return (
    <>
      <PageBanner
        title={firstName ? `Welcome, ${firstName}` : 'Platform Dashboard'}
        subtitle="Overview of all businesses and subscriptions on the platform."
        breadcrumb={[]}
      />

      <PageContainer>
        {error ? (
          <div className="card">
            <NetworkError error={error} onRetry={refetch} />
          </div>
        ) : (
          <>
            {/* ---------- Business Stats ---------- */}
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                loading={L}
                icon={Building2}
                tone="blue"
                label="Total Businesses"
                value={stats.totalBiz}
                hint="All registered businesses"
                href={PLATFORM_ROUTES.BUSINESSES}
              />
              <StatCard
                loading={L}
                icon={CircleCheck}
                tone="green"
                label="Active Businesses"
                value={stats.activeBiz}
                hint="Currently active"
                href={`${PLATFORM_ROUTES.BUSINESSES}?status=active`}
              />
              <StatCard
                loading={L}
                icon={Ban}
                tone="red"
                label="Suspended"
                value={stats.suspendedBiz}
                hint="Temporarily suspended"
                href={`${PLATFORM_ROUTES.BUSINESSES}?status=suspended`}
              />
              <StatCard
                loading={L}
                icon={ShieldCheck}
                tone="purple"
                label="Platform Status"
                value="Online"
                hint="Super Admin panel"
              />
            </div>

            {/* ---------- Subscription Stats ---------- */}
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                loading={L}
                icon={CreditCard}
                tone="blue"
                label="Total Subscriptions"
                value={stats.totalSub}
                href={PLATFORM_ROUTES.SUBSCRIPTIONS}
              />
              <StatCard
                loading={L}
                icon={CircleCheck}
                tone="green"
                label="Active Plans"
                value={stats.activeSub}
              />
              <StatCard
                loading={L}
                icon={Clock}
                tone="orange"
                label="On Trial"
                value={stats.trialSub}
              />
              <StatCard
                loading={L}
                icon={AlertTriangle}
                tone="red"
                label="Expired / Suspended"
                value={stats.problemSub}
              />
            </div>

            {/* ---------- Lists ---------- */}
            <div className="grid gap-4 xl:grid-cols-2">
              {/* Recent Businesses */}
              <SectionCard
                title="Recent Businesses"
                actions={
                  <Link
                    href={PLATFORM_ROUTES.BUSINESSES}
                    className="btn btn-neutral btn-sm"
                  >
                    View All <ArrowRight size={14} />
                  </Link>
                }
              >
                {L ? (
                  <div className="skeleton h-48" />
                ) : !businesses.length ? (
                  <EmptyState
                    title="No businesses yet"
                    message="New businesses will appear here after signup."
                  />
                ) : (
                  <ul className="divide-y divide-line">
                    {businesses.slice(0, 6).map((b) => (
                      <li
                        key={b.id || b._id}
                        className="flex items-center gap-3 py-2.5 px-1"
                      >
                        <div className="grid place-items-center size-10 rounded-xl bg-primary/10 text-primary shrink-0">
                          <Building2 size={18} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold truncate">
                            {b.businessName}
                          </p>
                          <p className="text-xs text-muted truncate">
                            {b.email || '—'}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <StatusBadge status={b.status} />
                          <p className="text-xs text-muted mt-1">
                            {b.createdAt ? fmtDate(b.createdAt) : '—'}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </SectionCard>

              {/* Recent Subscriptions */}
              <SectionCard
                title="Recent Subscriptions"
                actions={
                  <Link
                    href={PLATFORM_ROUTES.SUBSCRIPTIONS}
                    className="btn btn-neutral btn-sm"
                  >
                    View All <ArrowRight size={14} />
                  </Link>
                }
              >
                {L ? (
                  <div className="skeleton h-48" />
                ) : !subscriptions.length ? (
                  <EmptyState
                    title="No subscriptions yet"
                    message="Subscriptions will appear here once businesses are registered."
                  />
                ) : (
                  <ul className="divide-y divide-line">
                    {subscriptions.slice(0, 6).map((r, i) => {
                      const sub = r.subscription || r;
                      const name =
                        r.business?.businessName ||
                        r.businessName ||
                        'Business';

                      return (
                        <li
                          key={sub.id || sub._id || i}
                          className="flex items-center gap-3 py-2.5 px-1"
                        >
                          <div className="grid place-items-center size-10 rounded-xl bg-primary/10 text-primary shrink-0">
                            <CreditCard size={18} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold truncate">
                              {name}
                            </p>
                            <p className="text-xs text-muted">
                              {pretty(sub.plan)} · {pretty(sub.paymentStatus)}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <StatusBadge status={sub.status} />
                            <p className="text-xs text-muted mt-1">
                              {sub.plan === 'lifetime' || sub.isLifetime
                                ? 'Lifetime'
                                : sub.daysRemaining != null
                                  ? `${sub.daysRemaining}d left`
                                  : sub.endDate
                                    ? fmtDate(sub.endDate)
                                    : '—'}
                            </p>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </SectionCard>
            </div>
          </>
        )}
      </PageContainer>
    </>
  );
}