import BookingDetailPage from '@/features/bookings/BookingDetailPage';

// Static-export note: for the Electron build only the placeholder id is pre-rendered. See README.
export function generateStaticParams() { return [{ id: 'view' }]; }
export default async function Page({ params }) {
  const { id } = await params;
  return <BookingDetailPage id={id} />;
}
