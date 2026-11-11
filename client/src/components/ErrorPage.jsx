import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { FileQuestion, ShieldAlert, ServerCrash, WifiOff, CircleAlert, Home, RefreshCw } from 'lucide-react';

const SITE_TITLE = 'ניהול חדרי טיפול';

const HOME_ACTION = { label: 'חזרה לעמוד הראשי', to: '/', icon: Home };
const RETRY_ACTION = { label: 'נסו שוב', onClick: () => window.location.reload(), icon: RefreshCw };

/** Friendly Hebrew presets, keyed by HTTP-like code or a named kind. */
export const ERROR_PRESETS = {
  404: {
    icon: FileQuestion,
    title: 'העמוד לא נמצא',
    message: 'הכתובת שחיפשתם אינה קיימת, או שהעמוד הועבר. אפשר לחזור לעמוד הראשי ולהמשיך משם.',
    primaryAction: HOME_ACTION,
  },
  403: {
    icon: ShieldAlert,
    title: 'אין הרשאה לצפות בעמוד',
    message: 'העמוד הזה שמור למנהלים. אם נראה לכם שזו טעות, פנו למנהל המערכת.',
    primaryAction: HOME_ACTION,
  },
  500: {
    icon: ServerCrash,
    title: 'תקלה בשרת',
    message: 'הבעיה היא בצד שלנו והיא זמנית. הנתונים שלכם לא נפגעו. נסו שוב בעוד רגע, ואם התקלה נמשכת, פנו למנהל המערכת.',
    primaryAction: RETRY_ACTION,
    secondaryAction: HOME_ACTION,
  },
  offline: {
    icon: WifiOff,
    title: 'אין חיבור לאינטרנט',
    message: 'לא הצלחנו להתחבר. בדקו את החיבור ונסו שוב.',
    primaryAction: RETRY_ACTION,
    secondaryAction: HOME_ACTION,
  },
  fallback: {
    icon: CircleAlert,
    title: 'משהו השתבש',
    message: 'אירעה שגיאה לא צפויה. נסו שוב, ואם זה חוזר, פנו למנהל המערכת.',
    primaryAction: RETRY_ACTION,
    secondaryAction: HOME_ACTION,
  },
};
ERROR_PRESETS[401] = ERROR_PRESETS[403];
ERROR_PRESETS.network = ERROR_PRESETS.offline;

/** Pick a preset key from an HTTP status, a named kind, or an axios-like error. */
export function resolvePresetKey(codeOrError) {
  if (codeOrError && typeof codeOrError === 'object') {
    const err = codeOrError;
    const status = err.response?.status;
    if (status) return resolvePresetKey(status);
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'offline';
    if (err.request || err.code === 'ERR_NETWORK') return 'network';
    return 'fallback';
  }
  if (codeOrError in ERROR_PRESETS) return codeOrError;
  const n = Number(codeOrError);
  if (n >= 500) return 500;
  if (n === 401 || n === 403) return 403;
  if (n === 404) return 404;
  return 'fallback';
}

/**
 * Map a caught (axios) error to { key, code }.
 * 5xx -> server page, 401/403 -> permission page, 404 -> not found,
 * no response -> offline / network. `code` is the number to display (if any).
 */
export function errorToPreset(err) {
  const status = err?.response?.status;
  const key = resolvePresetKey(err);
  return { key, code: status || key };
}

function ActionButton({ action, variant }) {
  if (!action) return null;
  const Icon = action.icon;
  const cls = `${variant === 'primary' ? 'btn-primary' : 'btn-secondary'} inline-flex items-center justify-center gap-2 px-6 py-3 min-h-[2.75rem] w-full sm:w-auto no-underline`;
  const inner = (
    <>
      {Icon && <Icon size={18} aria-hidden="true" />}
      <span>{action.label}</span>
    </>
  );
  if (action.to) return <Link to={action.to} className={cls}>{inner}</Link>;
  return <button type="button" onClick={action.onClick} className={cls}>{inner}</button>;
}

/**
 * Generic error screen. `code` may be 404, 403, 500, 'offline', ... and selects
 * a Hebrew preset; any explicit prop overrides the preset.
 * `compact` renders inline (no page-height centering) for use inside a page.
 * `runtime` marks errors that appear without navigation (role="alert").
 * `showLogos` adds the organisation logos (for use outside Layout).
 */
export default function ErrorPage({
  code = 'fallback',
  title,
  message,
  primaryAction,
  secondaryAction,
  details,
  compact = false,
  runtime,
  showLogos = false,
}) {
  const key = resolvePresetKey(code);
  const preset = ERROR_PRESETS[key];
  const Icon = preset.icon;
  const finalTitle = title ?? preset.title;
  const finalMessage = message ?? preset.message;
  const primary = primaryAction === undefined ? preset.primaryAction : primaryAction;
  const secondary = secondaryAction === undefined ? preset.secondaryAction : secondaryAction;
  const isRuntime = runtime ?? (key !== 404 && key !== 403);
  const showCode = typeof code === 'number' || /^\d+$/.test(String(code));

  const headingRef = useRef(null);

  // Move focus to the heading so screen readers announce the error; restore the document title on leave.
  useEffect(() => {
    if (!compact) headingRef.current?.focus({ preventScroll: true });
    const prev = document.title;
    document.title = `${finalTitle} | ${SITE_TITLE}`;
    return () => { document.title = prev; };
  }, [finalTitle, compact]);

  return (
    <div
      className={`nb-root ${compact ? 'py-8' : 'min-h-[70vh] py-10 sm:py-16'} flex flex-col items-center justify-center px-4 sm:px-6`}
      dir="rtl"
    >
      {showLogos && (
        <div className="flex items-center justify-between w-full max-w-md mb-8">
          <img src="/logo-right.png" alt="מרכז אופק" className="h-8 w-auto object-contain" />
          <img src="/logo-left.png" alt="חוף אשקלון" className="h-8 w-auto object-contain" />
        </div>
      )}
      <section
        role={isRuntime ? 'alert' : undefined}
        aria-labelledby="error-page-title"
        className="card fade-up w-full max-w-md text-center px-6 py-8 sm:px-10 sm:py-10"
      >
        <div className="w-16 h-16 sm:w-20 sm:h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
          <Icon size={34} className="text-green-700" aria-hidden="true" />
        </div>
        <h1
          id="error-page-title"
          ref={headingRef}
          tabIndex={-1}
          className="text-2xl font-bold text-gray-800 mb-2 outline-none text-balance"
        >
          {finalTitle}
        </h1>
        <p className="text-base text-gray-600 mb-7 max-w-[34ch] mx-auto">{finalMessage}</p>

        {(primary || secondary) && (
          <div className="flex flex-col sm:flex-row sm:justify-center gap-3">
            <ActionButton action={primary} variant="primary" />
            <ActionButton action={secondary} variant="secondary" />
          </div>
        )}

        {details && (
          <details className="mt-6 text-start text-sm text-gray-600">
            <summary className="cursor-pointer min-h-[2.75rem] flex items-center">פרטים טכניים</summary>
            <pre dir="ltr" className="mt-2 p-3 rounded-xl bg-gray-50 text-xs text-gray-700 whitespace-pre-wrap break-words">{details}</pre>
          </details>
        )}

        {showCode && (
          <p className="mt-6 text-xs text-gray-500">
            קוד שגיאה <span dir="ltr" className="tabular-nums">{code}</span>
          </p>
        )}
      </section>
    </div>
  );
}
