import { createSlice } from '@reduxjs/toolkit';
// UI states for the future offline-first desktop app. Today they are simulated.
const slice = createSlice({
  name: 'sync',
  initialState: { online: true, status: 'synced', pending: 0, lastSyncAt: null },
  reducers: {
    setOnline: (s, { payload }) => { s.online = payload; if (!payload) s.status = 'offline'; else s.status = s.pending ? 'pending' : 'synced'; },
    markPending: (s) => { s.pending += 1; if (s.status !== 'conflict' && s.status !== 'failed') s.status = s.online ? 'pending' : 'offline'; },
    setSyncStatus: (s, { payload }) => { s.status = payload; if (payload === 'synced') { s.pending = 0; s.lastSyncAt = new Date().toISOString(); } },
  },
});
export const { setOnline, markPending, setSyncStatus } = slice.actions;
export default slice.reducer;
