// Single source of truth for admin authentication on the client.
// The password lives in sessionStorage ('adminPass') and in the axios default header (see api.js).
import { setAdminPassword, verifyAdmin, verifyAdminSilent } from './api';

const KEY = 'adminPass';
export const ADMIN_EVENT = 'adminAuthChanged';
export const ADMIN_ONLY_MESSAGE = 'פעולה זו מיועדת למנהל בלבד. יש להתחבר מחדש דרך עמוד הניהול.';

export function getStoredAdminPass() {
  try { return sessionStorage.getItem(KEY) || ''; } catch { return ''; }
}

function notify(reason) {
  try { window.dispatchEvent(new CustomEvent(ADMIN_EVENT, { detail: { reason: reason || null } })); } catch { /* ignore */ }
}

// Throws when the password is rejected (the caller shows its own message).
export async function loginAdmin(password) {
  await verifyAdmin(password);
  try { sessionStorage.setItem(KEY, password); } catch { /* storage blocked: session-only header */ }
  setAdminPassword(password);
  verified = password;
  notify();
}

// reason 'denied' = the server rejected an admin-only action (listeners show ADMIN_ONLY_MESSAGE)
export function logoutAdmin(reason) {
  try { sessionStorage.removeItem(KEY); } catch { /* ignore */ }
  setAdminPassword(null);
  verified = null;
  inflight = null;
  notify(typeof reason === 'string' ? reason : null);
}

// Server-verified state is cached per password so many components share one request.
let verified = null;   // password that the server accepted
let inflight = null;   // { pass, promise }

export function isVerified() {
  const pass = getStoredAdminPass();
  return !!pass && verified === pass;
}

// Resolves true only when the server accepts the stored password. Rejected -> clears it.
// Network failures resolve false (fail closed) but keep the password for a later retry.
export function verifyStoredAdmin() {
  const pass = getStoredAdminPass();
  if (!pass) return Promise.resolve(false);
  if (verified === pass) return Promise.resolve(true);
  if (inflight && inflight.pass === pass) return inflight.promise;
  const promise = verifyAdminSilent(pass)
    .then(() => { if (getStoredAdminPass() === pass) verified = pass; return getStoredAdminPass() === pass; })
    .catch((e) => {
      if (e?.response?.status === 401 && getStoredAdminPass() === pass) logoutAdmin();
      return false;
    })
    .finally(() => { if (inflight?.pass === pass) inflight = null; });
  inflight = { pass, promise };
  return promise;
}

// Call from a catch block after a booking/admin action. Returns true if it was a 401
// (admin-only action): the stale admin state is cleared so admin-only buttons disappear.
export function handleAdminDenied(e) {
  if (e?.response?.status === 401) {
    logoutAdmin('denied');
    return true;
  }
  return false;
}
