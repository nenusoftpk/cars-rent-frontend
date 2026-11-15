import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  token: null,
  user: null,
  ready: false,
  expired: false,
};

const authSlice = createSlice({
  name: "auth",
  initialState,

  reducers: {
    hydrate(state, action) {
      const session = action.payload;

      state.token = session?.token || null;
      state.user = session?.user || null;
      state.ready = true;
      state.expired = false;
    },

    setCredentials(state, action) {
      const { token, user } = action.payload || {};

      state.token = token || null;
      state.user = user || null;
      state.ready = true;
      state.expired = false;
    },

    setUser(state, action) {
      state.user = action.payload || null;
    },

    logout(state) {
      state.token = null;
      state.user = null;
      state.ready = true;
      state.expired = false;
    },

    sessionExpired(state) {
      state.token = null;
      state.user = null;
      state.ready = true;
      state.expired = true;
    },
  },
});

export const {
  hydrate,
  setCredentials,
  setUser,
  logout,
  sessionExpired,
} = authSlice.actions;

export default authSlice.reducer;