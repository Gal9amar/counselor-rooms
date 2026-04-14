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

api.interceptors.request.use(cfg => { setGlobalLoading(true); return cfg; });
api.interceptors.response.use(
  res => { setGlobalLoading(false); return res; },
  err => { setGlobalLoading(false); return Promise.reject(err); }
);

export const setAdminPassword = (password) => {
  api.defaults.headers.common['x-admin-password'] = password;
};

// Rooms
export const getRooms = () => api.get('/rooms').then((r) => r.data);
export const addRoom = (name) => api.post('/rooms', { name }).then((r) => r.data);
export const updateRoom = (id, name) => api.patch(`/rooms/${id}`, { name }).then((r) => r.data);
export const deleteRoom = (id) => api.delete(`/rooms/${id}`).then((r) => r.data);

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

// Admin
export const verifyAdmin = (password) =>
  api.post('/admin/verify', { password }).then((r) => r.data);
