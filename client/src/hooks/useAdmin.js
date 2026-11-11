import { useEffect, useState } from 'react';
import { ADMIN_EVENT, getStoredAdminPass, isVerified, verifyStoredAdmin } from '../services/adminAuth';

// Returns { isAdmin, checking, denied, clearDenied }.
// Fail closed: isAdmin is true only after the server accepted the stored password.
// While the first verification runs, isAdmin is false and checking is true.
// denied = the server just rejected an admin-only action (show ADMIN_ONLY_MESSAGE).
export default function useAdmin() {
  const [state, setState] = useState(() => {
    const has = !!getStoredAdminPass();
    return { isAdmin: has && isVerified(), checking: has && !isVerified() };
  });
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    let alive = true;
    const sync = (ev) => {
      if (!alive) return;
      if (ev?.detail?.reason === 'denied') setDenied(true);
      if (!getStoredAdminPass()) { setState({ isAdmin: false, checking: false }); return; }
      if (isVerified()) { setState({ isAdmin: true, checking: false }); return; }
      setState({ isAdmin: false, checking: true });
      verifyStoredAdmin().then((ok) => {
        if (alive) setState({ isAdmin: ok && !!getStoredAdminPass(), checking: false });
      });
    };
    sync();
    window.addEventListener(ADMIN_EVENT, sync);
    window.addEventListener('storage', sync); // other tabs
    return () => {
      alive = false;
      window.removeEventListener(ADMIN_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  return { ...state, denied, clearDenied: () => setDenied(false) };
}
