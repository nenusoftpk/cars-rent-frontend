import { z } from 'zod';

export const CNIC_RE = /^\d{5}-\d{7}-\d$/;
export const MOBILE_RE = /^03\d{2}-\d{7}$/;
export const PLATE_RE = /^[A-Z]{2,3}-\d{2,4}$/;
const req = (m = 'This field is required') => z.string({ required_error: m }).trim().min(1, m);
const money = (label = 'Amount') => z.coerce.number({ invalid_type_error: `Please enter ${label.toLowerCase()}` }).min(0, `${label} cannot be negative`);
const optionalStr = z.string().optional().or(z.literal(''));

export const loginSchema = z.object({
  email: req('Please enter your email or username'),
  password: req('Please enter your password'),
});

export const signupSchema = z
  .object({
    businessName: z
      .string()
      .trim()
      .min(2, "Business name must be at least 2 characters.")
      .max(150, "Business name cannot exceed 150 characters."),

    name: z
      .string()
      .trim()
      .min(2, "Name must be at least 2 characters.")
      .max(120, "Name cannot exceed 120 characters."),

    email: z
      .string()
      .trim()
      .min(1, "Email is required.")
      .email("Please enter a valid email address.")
      .max(254, "Email cannot exceed 254 characters."),

    phone: z
      .string()
      .trim()
      .min(1, "Phone number is required."),

    businessPhone: z.string().trim().max(30).optional(),

    address: z.string().trim().max(500).optional(),

    city: z.string().trim().max(100).optional(),

    country: z
      .string()
      .trim()
      .max(100)
      .default("Pakistan"),

    password: z
      .string()
      .min(8, "Password must be at least 8 characters.")
      .max(128, "Password cannot exceed 128 characters.")
      .regex(
        /[a-z]/,
        "Password must contain a lowercase letter."
      )
      .regex(
        /[A-Z]/,
        "Password must contain an uppercase letter."
      )
      .regex(
        /[0-9]/,
        "Password must contain a number."
      )
      .regex(
        /[^A-Za-z0-9]/,
        "Password must contain a special character."
      ),

    confirmPassword: z
      .string()
      .min(1, "Please confirm your password."),
  })
  .refine(
    (data) => data.password === data.confirmPassword,
    {
      path: ["confirmPassword"],
      message: "Passwords do not match.",
    }
  );


export const customerSchema = z.object({
  name: req('Please enter the customer name').min(3, 'Name is too short'),
  mobile: z.string().regex(MOBILE_RE, 'Please enter a valid mobile number (0300-1234567)'),
  address: req('Please enter the home address'),
  city: optionalStr,
  type: optionalStr,
  cnic: z.string().regex(CNIC_RE, 'Please enter a valid CNIC (35202-1234567-1)'),
  licenseNo: optionalStr,
  photo: optionalStr, cnicFront: optionalStr, cnicBack: optionalStr, licenseImage: optionalStr,
});

export const carSchema = z.object({
  brand: req('Please select the brand'),
  model: req('Please select the model'),
  year: z.coerce.number().min(1990, 'Enter a valid year').max(new Date().getFullYear() + 1, 'Enter a valid year'),
  plate: z.string().trim().toUpperCase().regex(PLATE_RE, 'Please enter a valid number plate (LHR-1234)'),
  color: optionalStr,
  fuel: req('Please select fuel type'),
  transmission: req('Please select transmission'),
  seats: z.coerce.number().min(2).max(15),
  status: z.enum(['Available', 'Booked', 'On Rent', 'Under Repair']),
  odometer: money('Odometer'),
  dailyRate: money('Daily rent').min(1, 'Please enter the daily rent'),
  hourlyRate: money('Hourly rent'),
  insuranceExpiry: optionalStr, tokenExpiry: optionalStr, registrationExpiry: optionalStr, nextServiceDate: optionalStr, nextOilChangeDate: optionalStr,
  image: optionalStr, registrationDoc: optionalStr, insuranceDoc: optionalStr,
});

export const serviceSchema = z.object({
  category: req('Please select a type'), date: req('Please select the date'), details: req('Please enter what was done'),
  amount: money('Cost').min(1, 'Please enter the cost'), method: req('Please select payment method'),
  supplier: optionalStr, odometer: optionalStr, nextDue: optionalStr,
});

export const driverSchema = z.object({
  name: req('Please enter the driver name'), mobile: z.string().regex(MOBILE_RE, 'Please enter a valid mobile number (0300-1234567)'),
  licenseNo: req('Please enter the licence number'), photo: optionalStr, licenseImage: optionalStr, status: z.enum(['Active', 'Inactive']).default('Active'),
});

export const staffSchema = z.object({
  name: req('Please enter the name'), email: z.string().trim().email('Please enter a valid email'),
  mobile: z.string().regex(MOBILE_RE, 'Please enter a valid mobile number (0300-1234567)'),
  role: z.enum(['admin', 'employee']), password: z.string().optional().or(z.literal('')), status: z.enum(['Active', 'Inactive']).default('Active'),
  permissions: z.array(z.string()).default([]), photo: optionalStr,
});

export const expenseSchema = z.object({
  date: req('Please select the date'), category: req('Please select the type'), details: req('Please enter the details'),
  carId: optionalStr, supplier: optionalStr, method: req('Please select payment method'),
  amount: money('Amount').min(1, 'Please enter the amount'),
}).superRefine((d, ctx) => {
  const carCats = ['Petrol', 'Repair', 'Service', 'Oil Change', 'Insurance & Tax'];
  if (carCats.includes(d.category) && !d.carId) ctx.addIssue({ code: 'custom', path: ['carId'], message: 'Please select the car for this expense' });
});

export const paymentSchema = z.object({
  bookingId: req('Please select a booking'), amount: money('Amount').min(1, 'Please enter the amount received'),
  method: req('Please select a payment method'), type: req('Please select payment type'), date: req('Please select the date'), note: optionalStr,
});

export const bookingSchema = z.object({
  customerId: req('Please select a customer'), carId: req('Please select a car'),
  pickupDate: req('Please select pick up date'), pickupTime: req('Select time'),
  returnDate: req('Please select return date'), returnTime: req('Select time'),
  rateType: z.enum(['daily', 'hourly']).default('daily'),
  driverId: optionalStr, staffId: req('Please select the responsible employee'),
  pickupLocation: optionalStr, returnLocation: optionalStr, instructions: optionalStr,
  chargeExtraKm: z.boolean().default(false), amountExtraKm: money(), chargeLate: z.boolean().default(false), amountLate: money(),
  chargeDamage: z.boolean().default(false), amountDamage: money(), chargeOther: z.boolean().default(false), amountOther: money(),
  advance: money('Advance'), deposit: money('Deposit'), method: optionalStr,
}).superRefine((d, ctx) => {
  if (d.pickupDate && d.returnDate && `${d.returnDate}T${d.returnTime}` <= `${d.pickupDate}T${d.pickupTime}`) ctx.addIssue({ code: 'custom', path: ['returnDate'], message: 'Return must be after pick up' });
  if ((d.advance > 0 || d.deposit > 0) && !d.method) ctx.addIssue({ code: 'custom', path: ['method'], message: 'Please select a payment method' });
});

export const issueSchema = z.object({
  bookingId: req('Please select a booking'), meter: z.coerce.number().min(0, 'Enter the meter reading'), fuel: req('Select fuel level'),
  damage: optionalStr, staffId: req('Select the employee handing over'), photos: z.array(z.string()).default([]),
});
export const returnSchema = z.object({
  bookingId: req('Please select a booking'), returnedDate: req('Select date'), returnedTime: req('Select time'),
  meter: z.coerce.number().min(0, 'Enter the final meter reading'), fuel: req('Select fuel level'), damage: optionalStr,
  damageCharge: money('Damage charge'), otherCharge: money('Other charge'), payNow: money('Payment'), method: optionalStr,
  photos: z.array(z.string()).default([]), staffId: req('Select the employee receiving the car'),
});

export const settingsSchema = z.object({
  businessName: req('Please enter the business name'), phone: req('Please enter the phone number'), address: req('Please enter the address'), logo: optionalStr,
  receiptFooter: optionalStr, showLogo: z.boolean().default(true), invoicePrefix: req('Required'), bookingPrefix: req('Required'), receiptPrefix: req('Required'),
  dateFormat: req(), timeFormat: req(), kmLimitPerDay: money('Limit'), extraKmRate: money('Rate'), graceHours: money('Hours'),
});
export const passwordSchema = z.object({
  current: req('Enter your current password'), next: z.string().min(6, 'Password must be at least 6 characters'), confirm: z.string(),
}).refine((d) => d.next === d.confirm, { path: ['confirm'], message: 'Passwords do not match' });
