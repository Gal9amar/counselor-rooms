import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || '/api';
const api = axios.create({ baseURL: BASE_URL });

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

// Shifts
export const startShift = (therapistId, roomId) =>
  api.post('/shifts/start', { therapistId, roomId }).then((r) => r.data);
export const endShift = (therapistId) =>
  api.post('/shifts/end', { therapistId }).then((r) => r.data);
export const getActiveShift = (therapistId) =>
  api.get(`/shifts/active/${therapistId}`).then((r) => r.data);
export const getHistory = (therapistId) =>
  api.get('/shifts/history', { params: therapistId ? { therapistId } : {} }).then((r) => r.data);

// Schedule
export const getSchedule = (roomId) =>
  api.get('/schedule', { params: roomId ? { roomId } : {} }).then((r) => r.data);
export const bookSlot = (roomId, dayOfWeek, hour, therapistId) =>
  api.post('/schedule', { roomId, dayOfWeek, hour, therapistId }).then((r) => r.data);
export const clearSlot = (id) => api.delete(`/schedule/${id}`).then((r) => r.data);

// Admin
export const verifyAdmin = (password) =>
  api.post('/admin/verify', { password }).then((r) => r.data);
