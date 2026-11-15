import { DRIVERS } from './people.mjs';
const MOBILES = ['0301-5556677', '0322-8899001', '0300-2233445', '0312-9876001', '0345-6677889', '0333-1100223'];
export const seedDrivers = () => DRIVERS.map(([name], i) => ({
  id: `d-${i + 1}`, name, mobile: MOBILES[i], licenseNo: `LHR-${(2015 + i)}-${100234 + i * 311}`, photo: `/images/drivers/d${i + 1}.svg`,
  licenseImage: '/images/docs/licence.svg', status: i === 5 ? 'Inactive' : 'Active', createdAt: '2024-02-0' + (i + 1) + 'T09:00',
}));
