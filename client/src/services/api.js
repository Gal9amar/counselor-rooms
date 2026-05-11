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

export const setAdminPassword = (password) => {
  api.defaults.headers.common['x-admin-password'] = password;
};

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
export const getSchedule = ({ roomId, date, from, to } = {}) =>
  api.get('/schedule', {
    params: {
      ...(roomId != null ? { roomId } : {}),
      ...(date ? { date } : {}),
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
    },
  }).then((r) => r.data);

export const bookSlot = (roomId, date, startHour, endHour, therapistId, note) =>
  api.post('/schedule', { roomId, date, startHour, endHour, therapistId, ...(note ? { note } : {}) }).then((r) => r.data);

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

// Silent variants — same API calls but without triggering the global loading overlay
export const getScheduleSilent = ({ roomId, date, from, to } = {}) =>
  silentApi.get('/schedule', { params: { ...(roomId != null ? { roomId } : {}), ...(date ? { date } : {}), ...(from ? { from } : {}), ...(to ? { to } : {}) } }).then((r) => r.data);
export const getRoomsSilent = () => silentApi.get('/rooms').then((r) => r.data);
export const getTherapistsSilent = () => silentApi.get('/therapists').then((r) => r.data);
export const getRoomNotesSilentAll = () => silentApi.get('/room-notes').then((r) => r.data);
export const getRoomNotesSilent = (roomId) =>
  silentApi.get('/room-notes', { params: roomId != null ? { roomId } : {} }).then((r) => r.data);
export const bookSlotSilent = (roomId, date, startHour, endHour, therapistId, note) =>
  silentApi.post('/schedule', { roomId, date, startHour, endHour, therapistId, ...(note ? { note } : {}) }).then((r) => r.data);
export const bookRecurringSilent = (data) => silentApi.post('/recurring', data).then((r) => r.data);
