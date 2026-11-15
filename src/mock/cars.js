import { addDays, subDays } from 'date-fns';
import { toDay } from '@/lib/dates';

// name, brand, model, year, plate, color, fuel, transmission, seats, daily, hourly, image, odometer
const C = [
  ['Toyota Corolla', 'Toyota', 'Corolla', 2023, 'ABC-123', 'White', 'Petrol', 'Automatic', 5, 8000, 700, 'toyota-corolla', 32400],
  ['Honda Civic', 'Honda', 'Civic', 2022, 'LHR-456', 'Black', 'Petrol', 'Automatic', 5, 9000, 800, 'honda-civic', 41250],
  ['Suzuki Swift', 'Suzuki', 'Swift', 2023, 'LHR-789', 'White', 'Petrol', 'Automatic', 5, 6000, 500, 'suzuki-swift', 18900],
  ['Toyota Fortuner', 'Toyota', 'Fortuner', 2023, 'ABC-321', 'Black', 'Diesel', 'Automatic', 7, 15000, 1300, 'toyota-fortuner', 27800],
  ['Honda BR-V', 'Honda', 'BR-V', 2022, 'LEA-777', 'White', 'Petrol', 'Automatic', 7, 10000, 900, 'honda-brv', 38100],
  ['Toyota Yaris', 'Toyota', 'Yaris', 2023, 'LHR-222', 'White', 'Petrol', 'Automatic', 5, 7000, 600, 'toyota-yaris', 21650],
  ['Suzuki Wagon R', 'Suzuki', 'Wagon R', 2022, 'LHR-333', 'Grey', 'Petrol', 'Manual', 5, 5000, 450, 'suzuki-wagonr', 52300],
  ['KIA Sportage', 'KIA', 'Sportage', 2023, 'ABC-654', 'Silver', 'Diesel', 'Automatic', 5, 14000, 1200, 'kia-sportage', 24100],
  ['Honda City', 'Honda', 'City', 2022, 'LEB-901', 'Silver', 'Petrol', 'Automatic', 5, 7500, 650, 'honda-city', 36700],
  ['Hyundai Tucson', 'Hyundai', 'Tucson', 2023, 'LXA-808', 'Silver', 'Petrol', 'Automatic', 5, 13000, 1100, 'hyundai-tucson', 19800],
  ['Suzuki Alto', 'Suzuki', 'Alto', 2022, 'LHR-515', 'Red', 'Petrol', 'Manual', 4, 4000, 350, 'suzuki-alto', 47200],
  ['Toyota Corolla', 'Toyota', 'Corolla', 2022, 'ABC-777', 'Blue', 'Petrol', 'Automatic', 5, 7500, 650, 'toyota-corolla-2', 44100],
];

// Different offsets so the Reminders page shows overdue / today / upcoming items.
const OFFS = [
  [40, 75, 120, 20, 60], [12, 28, 90, -3, 15], [200, 150, 33, 25, 40], [4, 60, 80, 9, 2], [95, 18, -6, 45, 30], [140, 110, 200, 70, 50],
  [22, 8, 300, 35, 12], [180, 90, 60, 16, 5], [55, 2, 100, 28, 22], [75, 120, 160, 40, 1], [-4, 45, 70, 6, 18], [100, 65, 35, 52, 38],
];

export function seedCars(now = new Date()) {
  const d = (n) => toDay(addDays(now, n));
  return C.map(([name, brand, model, year, plate, color, fuel, transmission, seats, dailyRate, hourlyRate, img, odometer], i) => ({
    id: `car-${i + 1}`, name, brand, model, year, plate, color, fuel, transmission, seats, dailyRate, hourlyRate,
    status: i === 5 || i === 10 ? 'Under Repair' : 'Available',
    image: `/images/cars/${img}.svg`, images: [`/images/cars/${img}.svg`], odometer,
    insuranceExpiry: d(OFFS[i][0]), tokenExpiry: d(OFFS[i][1]), registrationExpiry: d(OFFS[i][2]), nextServiceDate: d(OFFS[i][3]), nextOilChangeDate: d(OFFS[i][4]),
    registrationDoc: '/images/docs/registration.svg', insuranceDoc: '/images/docs/insurance.svg',
    createdAt: toDay(subDays(now, 400)) + 'T09:00',
  }));
}
