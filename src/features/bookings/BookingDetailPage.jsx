'use client';
import PageHeader from '@/components/layout/PageHeader';
import PageContainer from '@/components/layout/PageContainer';
import SectionCard from '@/components/common/SectionCard';
import NetworkError from '@/components/feedback/NetworkError';
import TableActions from '@/components/tables/TableActions';
import BookingDetail from './BookingDetail';
import { useBookingActions } from './BookingActions';
import { useGetBookingQuery } from '@/redux/api/bookingApi';

export default function BookingDetailPage({ id }) {
  const { data, isLoading, error, refetch } = useGetBookingQuery(id);
  const { menu, dialogs } = useBookingActions();
  return (
    <>
      <PageHeader title={data ? `Booking ${data.number}` : 'Booking'} subtitle="Full details, payments and car condition." breadcrumb={[{ label: 'Bookings', href: '/bookings' }, { label: data?.number || '…' }]} />
      <PageContainer>
        <SectionCard title="Booking Details" actions={data && <TableActions label="Booking actions" actions={menu(data)} />}>
          {isLoading ? <div className="space-y-3"><div className="skeleton h-24" /><div className="skeleton h-64" /></div> : error ? <NetworkError error={error} onRetry={refetch} /> : <BookingDetail b={data} />}
        </SectionCard>
      </PageContainer>
      {dialogs}
    </>
  );
}
