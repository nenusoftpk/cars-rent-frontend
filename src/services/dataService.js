import { localStorageAdapter } from './adapters/localStorageAdapter';
import { createMockServer } from './server';

// The ONE data-access interface the UI uses (through RTK Query).
// request({ method, url, params, body }) -> data | throws { status, message }
// Today: a mock server on top of a storage adapter.  Tomorrow: swap the adapter for IndexedDB/RxDB
// (offline) or switch NEXT_PUBLIC_USE_MOCK=false to talk to the real Express API.
const server = createMockServer(localStorageAdapter);
export const dataService = { request: server.handle, adapter: localStorageAdapter };
