import { createSlice } from '@reduxjs/toolkit';
const slice = createSlice({
  name: 'ui',
  initialState: { collapsed: false, mobileNav: false },
  reducers: {
    toggleCollapsed: (s) => { s.collapsed = !s.collapsed; },
    setMobileNav: (s, { payload }) => { s.mobileNav = payload; },
  },
});
export const { toggleCollapsed, setMobileNav } = slice.actions;
export default slice.reducer;
