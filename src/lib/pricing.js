import { differenceInMinutes } from 'date-fns';
import { parse } from './dates';

/** Rental price. Daily: every started 24h = 1 day (minimum 1 day). Hourly: every started hour. */
export function calcRental({ pickupAt, returnAt, dailyRate = 0, hourlyRate = 0, rateType = 'daily' }) {
  const a = parse(pickupAt); const b = parse(returnAt);
  if (!a || !b || b <= a) return { valid: false, minutes: 0, hours: 0, days: 0, units: 0, rate: 0, amount: 0, label: '-' };
  const minutes = differenceInMinutes(b, a);
  const hours = Math.max(1, Math.ceil(minutes / 60));
  const days = Math.max(1, Math.ceil(minutes / 1440));
  if (rateType === 'hourly') return { valid: true, minutes, hours, days, units: hours, rate: hourlyRate, amount: hours * hourlyRate, label: `${hours} Hour${hours > 1 ? 's' : ''}` };
  return { valid: true, minutes, hours, days, units: days, rate: dailyRate, amount: days * dailyRate, label: `${days} Day${days > 1 ? 's' : ''}` };
}

/** Charges when a car comes back. Used by the Return screen and (independently) by the mock server. */
export function calcReturn({ booking, settings, returnedAt, meterOut = 0, meterIn = 0, damageCharge = 0, otherCharge = 0 }) {
  const due = parse(booking.returnAt); const back = parse(returnedAt);
  const grace = Number(settings?.graceHours ?? 1);
  const lateMin = due && back ? Math.max(0, differenceInMinutes(back, due) - grace * 60) : 0;
  const extraDays = lateMin > 0 ? Math.ceil(lateMin / 1440) : 0;
  const lateCharge = extraDays * (booking.dailyRate || 0);
  const km = Math.max(0, Number(meterIn) - Number(meterOut));
  const allowed = (booking.days || 1) * Number(settings?.kmLimitPerDay ?? 200);
  const extraKm = Math.max(0, km - allowed);
  const extraKmCharge = extraKm * Number(settings?.extraKmRate ?? 20);
  const newCharges = lateCharge + extraKmCharge + (Number(damageCharge) || 0) + (Number(otherCharge) || 0);
  const total = (booking.rentAmount || 0) + (booking.additionalTotal || 0) + newCharges;
  const balance = total - (booking.paid || 0);
  const deposit = booking.depositHeld || 0;
  const depositAdjusted = Math.min(deposit, Math.max(balance, 0));
  const depositRefund = deposit - depositAdjusted;
  const customerPays = Math.max(balance - depositAdjusted, 0);
  return { km, allowed, extraKm, extraKmCharge, extraDays, lateCharge, newCharges, total, balance, deposit, depositAdjusted, depositRefund, customerPays, lateMinutes: lateMin };
}
