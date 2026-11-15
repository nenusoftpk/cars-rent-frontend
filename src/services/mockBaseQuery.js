import { dataService } from './dataService';
import { markPending } from '@/redux/slices/syncSlice';

// RTK Query base query that talks to the demo data service instead of the network.
export const mockBaseQuery = async (args, api) => {
  const req = typeof args === 'string' ? { url: args } : args;
  const method = (req.method || 'GET').toUpperCase();
  try {
    const data = await dataService.request({ method, url: req.url, params: req.params || {}, body: req.body || {} });
    if (method !== 'GET') api.dispatch(markPending());
    return { data };
  } catch (e) {
    return { error: { status: e.status || 500, data: { message: e.message || 'Something went wrong' } } };
  }
};
