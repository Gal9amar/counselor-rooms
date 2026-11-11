import React, { useEffect, useRef, useState } from 'react';
import { LogIn, X } from 'lucide-react';
import { loginAdmin } from '../services/adminAuth';

// Admin login dialog. The password is accepted only after server verification (loginAdmin).
export default function AdminLoginModal({ onClose, onSuccess }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const dialogRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const prevFocus = document.activeElement;
    inputRef.current?.focus();
    return () => { try { prevFocus?.focus?.(); } catch { /* ignore */ } };
  }, []);

  // Escape works even when focus was lost (e.g. right after the input was disabled while sending)
  useEffect(() => {
    const esc = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);

  useEffect(() => { if (error) inputRef.current?.focus(); }, [error]);

  const onKeyDown = (e) => {
    if (e.key !== 'Tab') return;
    const items = dialogRef.current?.querySelectorAll('button:not([disabled]), input:not([disabled])');
    if (!items || items.length === 0) return;
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (busy || !password) return;
    setBusy(true); setError('');
    try {
      await loginAdmin(password);
      onSuccess?.();
      onClose();
    } catch (err) {
      const status = err?.response?.status;
      setError(status === 401 ? 'הסיסמה שגויה. נסו שוב.' : 'לא הצלחנו להתחבר כרגע. בדקו את החיבור ונסו שוב.');
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[60] flex items-center justify-center p-4" onClick={onClose} onKeyDown={onKeyDown}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="admin-login-title" dir="rtl"
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 border border-gray-100" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 id="admin-login-title" className="text-lg font-bold text-gray-800">כניסת מנהל</h2>
          <button type="button" onClick={onClose} aria-label="סגירה" className="btn-ghost p-1.5 min-w-[44px] min-h-[44px] flex items-center justify-center"><X size={20} /></button>
        </div>
        <form onSubmit={submit} noValidate>
          <label htmlFor="admin-login-pass" className="block text-sm font-medium text-gray-600 mb-1.5">סיסמה</label>
          <input id="admin-login-pass" ref={inputRef} type="password" autoComplete="current-password" className="input mb-2"
            value={password} onChange={(e) => { setPassword(e.target.value); setError(''); }}
            aria-invalid={!!error} aria-describedby={error ? 'admin-login-err' : undefined} disabled={busy} />
          {error && <p id="admin-login-err" role="alert" className="text-red-600 text-sm mb-2">{error}</p>}
          <button type="submit" disabled={busy || !password} className="btn-primary w-full min-h-[44px] flex items-center justify-center gap-2 mt-2">
            <LogIn size={16} /> {busy ? 'מתחבר...' : 'כניסה'}
          </button>
        </form>
      </div>
    </div>
  );
}
