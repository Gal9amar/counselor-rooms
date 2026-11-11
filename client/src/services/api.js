import axios from 'axios';

// Global loading counter (works without React context in axios layer)
let _loadingCount = 0;
function setGlobalLoading(val) {
  _loadingCount += val ? 1 : -1;
  // Dispatch custom event that App.jsx listens to
  window.dispatchEvent(new CustomEvent('apiLoading', { detail: { active: _loadingCount > 0 } }));
}

const BASE_URL = import.meta.env.VITE_API_URL || '/api';
const api = axios.create({ baseURL: BASE_URL });

api.interceptors.request.use(cfg => { if (!cfg.silent) setGlobalLoading(true); return cfg; });
api.interceptors.response.use(
  res => { if (!res.config.silent) setGlobalLoading(false); return res; },
  err => { if (!err.config?.silent) setGlobalLoading(false); return Promise.reject(err); }
);

// Silent API instance — skips the global loading overlay
const silentApi = axios.create({ baseURL: BASE_URL });
silentApi.interceptors.request.use(cfg => { api.defaults.headers.common['x-admin-password'] && (cfg.headers['x-admin-password'] = api.defaults.headers.common['x-admin-password']); return cfg; });

// Sets (or clears, when falsy) the admin header. silentApi copies it from api.defaults in its interceptor,
// but we also set it explicitly so both instances are always in sync.
export const setAdminPassword = (password) => {
  if (password) {
    api.defaults.headers.common['x-admin-password'] = password;
    silentApi.defaults.headers.common['x-admin-password'] = password;
  } else {
    delete api.defaults.headers.common['x-admin-password'];
    delete silentApi.defaults.headers.common['x-admin-password'];
  }
};

// Restore the admin header after a page reload (sessionStorage may throw, e.g. blocked storage)
try {
  const stored = sessionStorage.getItem('adminPass');
  if (stored) setAdminPassword(stored);
} catch { /* ignore */ }

// Settings (admin only)
export const getSettings = () => api.get('/settings').then((r) => r.data);
export const updateSettings = (notifyEmail) => api.put('/settings', { notifyEmail }).then((r) => r.data);
export const sendTestEmail = () => api.post('/settings/test-email').then((r) => r.data);

// Rooms
export const getRooms = () => api.get('/rooms').then((r) => r.data);
export const addRoom = (name) => api.post('/rooms', { name }).then((r) => r.data);
export const updateRoom = (id, name) => api.patch(`/rooms/${id}`, { name }).then((r) => r.data);
export const deleteRoom = (id) => api.delete(`/rooms/${id}`).then((r) => r.data);
export const reorderRooms = (ids) => api.post('/rooms/reorder', { ids }).then((r) => r.data);

// Therapists
export const getTherapists = () => api.get('/therapists').then((r) => r.data);
export const addTherapist = (name) => api.post('/therapists', { name }).then((r) => r.data);
export const updateTherapist = (id, name) => api.patch(`/therapists/${id}`, { name }).then((r) => r.data);
export const deleteTherapist = (id) => api.delete(`/therapists/${id}`).then((r) => r.data);

// Schedule
const scheduleParams = ({ roomId, therapistId, date, from, to } = {}) => ({
  ...(roomId != null ? { roomId } : {}),
  ...(therapistId != null ? { therapistId } : {}),
  ...(date ? { date } : {}),
  ...(from ? { from } : {}),
  ...(to ? { to } : {}),
});
export const getSchedule = (opts) =>
  api.get('/schedule', { params: scheduleParams(opts) }).then((r) => r.data);

// One round trip for the dashboard: {rooms, therapists, roomNotes, slots}.
// If the endpoint is missing (404, e.g. mid-deploy) or the network failed, falls back ONCE to the separate calls.
export const getBootstrap = async ({ from, to } = {}) => {
  try {
    const data = await api.get('/bootstrap', { params: { from, to } }).then((r) => r.data);
    if (!data || typeof data !== 'object' || !Array.isArray(data.rooms)) return await bootstrapFallback({ from, to });
    return data;
  } catch (e) {
    if (e?.response && e.response.status !== 404) throw e;
    return bootstrapFallback({ from, to });
  }
};
const bootstrapFallback = async ({ from, to }) => {
  const [rooms, slots, roomNotes, therapists] = await Promise.all([
    getRooms(), getSchedule({ from, to }), getRoomNotes(), getTherapists(),
  ]);
  return { rooms, therapists, roomNotes, slots };
};

export const bookSlot = (roomId, date, startHour, endHour, therapistId, note, forcePending) =>
  api.post('/schedule', { roomId, date, startHour, endHour, therapistId, ...(note ? { note } : {}), ...(forcePending ? { forcePending: true } : {}) }).then((r) => r.data);

export const updateSlot = (id, startHour, endHour, therapistId, note, roomId, date) =>
  api.patch(`/schedule/${id}`, { startHour, endHour, therapistId, note: note ?? null, roomId, date }).then((r) => r.data);

export const clearSlot = (id, scope = 'single') =>
  api.delete(`/schedule/${id}`, { params: { scope } }).then((r) => r.data);

// Recurring
export const bookRecurring = (data) => api.post('/recurring', data).then((r) => r.data);
export const updateRecurring = (id, data) => api.patch(`/recurring/${id}`, data).then((r) => r.data);
export const deleteRecurring = (id) => api.delete(`/recurring/${id}`).then((r) => r.data);

// Room Notes
export const getRoomNotes = (roomId) =>
  api.get('/room-notes', { params: roomId != null ? { roomId } : {} }).then((r) => r.data);
export const addRoomNote = (data) => api.post('/room-notes', data).then((r) => r.data);
export const deleteRoomNote = (id) => api.delete(`/room-notes/${id}`).then((r) => r.data);

// Admin
export const verifyAdmin = (password) =>
  api.post('/admin/verify', { password }).then((r) => r.data);
// Background re-verification (no global loading overlay)
export const verifyAdminSilent = (password) =>
  silentApi.post('/admin/verify', { password }).then((r) => r.data);
export const getPendingRequestsSilent = () =>
  silentApi.get('/booking-requests', { params: { status: 'pending' } }).then((r) => r.data);

// Pending count for the nav badge. Falls back to the list call if the server predates countOnly.
export const getPendingCountSilent = async () => {
  const data = await silentApi.get('/booking-requests', { params: { status: 'pending', countOnly: 1 } }).then((r) => r.data);
  if (data && typeof data.count === 'number') return data.count;
  return Array.isArray(data) ? data.length : 0;
};

// Booking Requests
export const getBookingRequests = (status) =>
  api.get('/booking-requests', { params: status ? { status } : {} }).then((r) => r.data);
export const createBookingRequest = (data) =>
  api.post('/booking-requests', data).then((r) => r.data);
export const approveBookingRequest = (id, overrides = {}) =>
  api.patch(`/booking-requests/${id}`, { status: 'approved', ...overrides }).then((r) => r.data);
export const rejectBookingRequest = (id) =>
  api.patch(`/booking-requests/${id}`, { status: 'rejected' }).then((r) => r.data);
export const updateBookingRequest = (id, data) =>
  api.patch(`/booking-requests/${id}`, data).then((r) => r.data);
export const deleteBookingRequest = (id) =>
  api.delete(`/booking-requests/${id}`).then((r) => r.data);

// Silent variants — same API calls but without triggering the global loading overlay
export const getScheduleSilent = (opts) =>
  silentApi.get('/schedule', { params: scheduleParams(opts) }).then((r) => r.data);
export const getRoomsSilent = () => silentApi.get('/rooms').then((r) => r.data);
export const getTherapistsSilent = () => silentApi.get('/therapists').then((r) => r.data);
export const getRoomNotesSilentAll = () => silentApi.get('/room-notes').then((r) => r.data);
export const getRoomNotesSilent = (roomId) =>
  silentApi.get('/room-notes', { params: roomId != null ? { roomId } : {} }).then((r) => r.data);
export const bookSlotSilent = (roomId, date, startHour, endHour, therapistId, note, forcePending) =>
  silentApi.post('/schedule', { roomId, date, startHour, endHour, therapistId, ...(note ? { note } : {}), ...(forcePending ? { forcePending: true } : {}) }).then((r) => r.data);
export const bookRecurringSilent = (data) => silentApi.post('/recurring', data).then((r) => r.data);
