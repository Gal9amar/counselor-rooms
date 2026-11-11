import React, { useCallback, useEffect, useState } from 'react';
import { Mail, Send, AlertTriangle, Info, CheckCircle2 } from 'lucide-react';
import RouteError from './RouteError';
import { getSettings, updateSettings, sendTestEmail } from '../services/api';
import { handleAdminDenied } from '../services/adminAuth';

const INVALID_MSG = 'כתובת המייל אינה תקינה';
const GENERIC_ERR = 'לא הצלחנו להשלים את הפעולה. נסו שוב.';

// Mirrors the server: a single address, no spaces/commas, up to 254 characters. Empty is allowed (clears).
function isValidEmail(v) {
  if (v === '') return true;
  if (v.length > 254 || /[\s,;]/.test(v)) return false;
  return /^[^@]+@[^@.]+(\.[^@.]+)+$/.test(v);
}

function serverMessage(e) {
  const m = e?.response?.data?.error;
  return typeof m === 'string' && /[֐-׿]/.test(m) ? m : GENERIC_ERR;
}

export default function NotifyEmailCard() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [saved, setSaved] = useState('');
  const [envFallback, setEnvFallback] = useState(false);
  const [value, setValue] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [busy, setBusy] = useState(null); // 'save' | 'test' | null
  const [status, setStatus] = useState(null); // {type:'ok'|'err', text}

  const apply = (d) => {
    setSaved(d?.notifyEmail || '');
    setEnvFallback(!!d?.envFallback);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const d = await getSettings();
      apply(d);
      setValue(d?.notifyEmail || '');
    } catch (e) {
      if (!handleAdminDenied(e)) setLoadError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const trimmed = value.trim();
  const dirty = trimmed !== saved;
  const sending = busy !== null;

  const onSave = async (ev) => {
    ev.preventDefault();
    if (sending) return;
    setStatus(null);
    if (!isValidEmail(trimmed)) { setFieldError(INVALID_MSG); return; }
    setFieldError('');
    setBusy('save');
    try {
      const d = await updateSettings(trimmed);
      apply(d);
      setValue(d?.notifyEmail || '');
      setStatus({ type: 'ok', text: d?.notifyEmail ? 'הכתובת נשמרה.' : 'הכתובת נמחקה.' });
    } catch (e) {
      if (!handleAdminDenied(e)) setStatus({ type: 'err', text: serverMessage(e) });
    } finally {
      setBusy(null);
    }
  };

  const onTest = async () => {
    if (sending || dirty) return;
    setStatus(null);
    setBusy('test');
    try {
      await sendTestEmail();
      setStatus({ type: 'ok', text: 'נשלח מייל בדיקה אל הכתובת. בדקו גם את תיקיית הספאם.' });
    } catch (e) {
      if (!handleAdminDenied(e)) setStatus({ type: 'err', text: serverMessage(e) });
    } finally {
      setBusy(null);
    }
  };

  const noAddress = !saved && !envFallback;
  const canTest = !loading && !sending && !dirty && !noAddress;

  return (
    <section className="card rounded-2xl p-4" aria-labelledby="notify-email-title">
      <div className="flex items-center gap-2 mb-3">
        <Mail size={18} className="text-green-600 shrink-0" aria-hidden="true" />
        <h2 id="notify-email-title" className="font-bold text-gray-800">כתובת לקבלת בקשות שיבוץ</h2>
      </div>

      {loadError ? (
        <RouteError error={loadError} onRetry={load} compact />
      ) : (
        <form onSubmit={onSave} noValidate>
          <label htmlFor="notify-email" className="block text-sm font-medium text-gray-700 mb-1.5">כתובת מייל</label>
          <input
            id="notify-email"
            type="email"
            dir="ltr"
            inputMode="email"
            autoComplete="off"
            spellCheck={false}
            maxLength={254}
            disabled={loading}
            value={value}
            onChange={(e) => { setValue(e.target.value); setFieldError(''); setStatus(null); }}
            aria-invalid={!!fieldError}
            aria-describedby={`notify-email-help${fieldError ? ' notify-email-err' : ''}`}
            placeholder={loading ? 'טוען...' : 'name@example.com'}
            className={`input text-base min-h-[44px] text-start ${fieldError ? 'border-red-400' : ''}`}
          />
          <p id="notify-email-help" className="text-xs text-gray-500 mt-1.5">לכתובת הזו יישלח מייל על כל בקשת שיבוץ חדשה. אפשר לשנות אותה בכל עת.</p>
          {fieldError && <p id="notify-email-err" role="alert" className="text-xs text-red-600 mt-1.5">{fieldError}</p>}

          {!loading && !saved && (
            envFallback ? (
              <p className="flex items-start gap-1.5 text-xs text-gray-600 bg-gray-50 rounded-xl px-3 py-2 mt-3">
                <Info size={14} className="shrink-0 mt-0.5" aria-hidden="true" />
                <span>לא הוגדרה כתובת כאן. נעשה שימוש בכתובת ברירת המחדל של המערכת.</span>
              </p>
            ) : (
              <p className="flex items-start gap-1.5 text-xs text-amber-800 bg-amber-50 rounded-xl px-3 py-2 mt-3">
                <AlertTriangle size={14} className="shrink-0 mt-0.5" aria-hidden="true" />
                <span>לא הוגדרה כתובת. בקשות חדשות לא ישלחו מייל.</span>
              </p>
            )
          )}

          <div className="flex flex-wrap gap-2 mt-3">
            <button type="submit" disabled={loading || sending || !dirty} className="btn-primary px-5 min-h-[44px] flex items-center justify-center gap-2">
              {busy === 'save' ? 'שומר...' : 'שמירה'}
            </button>
            <button type="button" onClick={onTest} disabled={!canTest} className="btn-secondary px-5 min-h-[44px] flex items-center justify-center gap-2">
              <Send size={15} aria-hidden="true" />
              {busy === 'test' ? 'שולח...' : 'שליחת מייל בדיקה'}
            </button>
          </div>
          {dirty && !loading && !noAddress && saved && (
            <p className="text-xs text-gray-500 mt-2">יש לשמור את השינויים לפני שליחת מייל בדיקה.</p>
          )}
          {dirty && !loading && !saved && trimmed && (
            <p className="text-xs text-gray-500 mt-2">יש לשמור את הכתובת לפני שליחת מייל בדיקה.</p>
          )}
          <div aria-live="polite" role="status">
            {status && (
              <p className={`flex items-start gap-1.5 text-sm mt-3 ${status.type === 'ok' ? 'text-green-700' : 'text-red-600'}`}>
                {status.type === 'ok' ? <CheckCircle2 size={16} className="shrink-0 mt-0.5" aria-hidden="true" /> : <AlertTriangle size={16} className="shrink-0 mt-0.5" aria-hidden="true" />}
                <span>{status.text}</span>
              </p>
            )}
          </div>
        </form>
      )}
    </section>
  );
}
