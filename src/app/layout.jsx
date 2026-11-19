import '@/styles/index.css';
import ReduxProvider from '@/redux/provider';
import ServiceWorkerRegister from '@/components/common/ServiceWorkerRegister';

export const metadata = {
  title: 'Rent a Car Management System',
  description: 'Cars, customers, bookings, payments and reports for rent-a-car businesses.',
  icons: { icon: '/favicon7.png' },
};
export const viewport = { width: 'device-width', initialScale: 1, themeColor: '#06172f' };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:bg-white focus:p-2 focus:rounded">
          Skip to content
        </a>
        <ReduxProvider>
          {children}
          <ServiceWorkerRegister />
        </ReduxProvider>
      </body>
    </html>
  );
}