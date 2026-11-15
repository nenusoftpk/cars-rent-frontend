'use client';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import DetailDrawer from '@/components/modals/DetailDrawer';
import NetworkError from '@/components/feedback/NetworkError';
import BookingDetail from './BookingDetail';
import { useGetBookingQuery } from '@/redux/api/bookingApi';

export default function BookingDrawer({ id, onClose }) {
  const { data, isLoading, error, refetch } = useGetBookingQuery(id, { skip: !id });
  return (
    <DetailDrawer open={!!id} onClose={onClose} title="Booking Details" width="max-w-3xl" headerRight={data && <Link href={`/bookings/${data.id}`} className="btn btn-neutral btn-sm"><ExternalLink size={14} />Open Page</Link>}>
      {isLoading ? <div className="space-y-3"><div className="skeleton h-24" /><div className="skeleton h-48" /></div> : error ? <NetworkError error={error} onRetry={refetch} /> : data && <BookingDetail b={data} />}
    </DetailDrawer>
  );
}
