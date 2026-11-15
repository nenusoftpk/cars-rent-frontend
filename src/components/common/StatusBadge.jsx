import { cn } from '@/lib/utils';
const TONE = {
  Available: 'success', Active: 'success', Completed: 'success', Paid: 'success', Confirmed: 'success', Today: 'info',
  'On Rent': 'info', Reserved: 'info', Upcoming: 'info', Partial: 'warning', Booked: 'warning', 'Under Repair': 'warning', Pending: 'warning', Held: 'warning',
  Overdue: 'danger', Cancelled: 'danger', Unpaid: 'danger', Inactive: 'neutral', 'Sample (mock)': 'neutral',
  VIP: 'purple', Regular: 'info', Corporate: 'warning', Admin: 'purple', Employee: 'info', admin: 'purple', employee: 'info',
  Income: 'success', Expense: 'danger', 'Rental Income': 'success', 'Advance Refunded': 'danger', Other: 'info',
};
export default function StatusBadge({ status, tone, children, className }) {
  const t = tone || TONE[status] || (['Petrol', 'Repair', 'Service', 'Salary', 'Oil Change', 'Insurance & Tax', 'Office Expense'].includes(status) ? 'danger' : 'neutral');
  return <span className={cn('badge', `badge-${t}`, className)}>{children || status}</span>;
}
