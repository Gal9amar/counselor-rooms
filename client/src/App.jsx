import React, { createContext, useContext, useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import DashboardPage from './pages/DashboardPage';
import SchedulePage from './pages/SchedulePage';
import MySchedulePage from './pages/MySchedulePage';
import AdminPage from './pages/AdminPage';

export const LoadingContext = createContext({ loading: false, setLoading: () => {} });
export function useLoading() { return useContext(LoadingContext); }

const LOADING_MESSAGES = [
  'מכין את הלוחות... 📋',
  'בודק פנויות... 🔍',
  'מסדר את החדרים... 🏠',
  'שואל את המטפלים... 👤',
  'מחשב שעות... ⏰',
  'מסנכרן נתונים... 🔄',
  'כמעט מוכן... ✨',
  'טוען שיבוצים... 📅',
  'מארגן את הלוח... 🗓️',
  'עוד רגע קטן... ⚡',
];

function LoadingOverlay() {
  const { loading, setLoading } = useLoading();
  const [msgIdx, setMsgIdx] = useState(() => Math.floor(Math.random() * LOADING_MESSAGES.length));
  const [fade, setFade] = useState(true);

  useEffect(() => {
    const handler = (e) => setLoading(e.detail.active);
    window.addEventListener('apiLoading', handler);
    return () => window.removeEventListener('apiLoading', handler);
  }, [setLoading]);

  // Rotate message every 1.8s with fade
  useEffect(() => {
    if (!loading) return;
    const interval = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setMsgIdx(i => (i + 1) % LOADING_MESSAGES.length);
        setFade(true);
      }, 200);
    }, 1800);
    return () => clearInterval(interval);
  }, [loading]);

  if (!loading) return null;

  return (
    <div className="loading-overlay">
      <div style={{textAlign:'center'}}>
        <div className="spinner" style={{margin:'0 auto 16px'}}/>
        <p style={{
          color: '#15803d',
          fontFamily: 'Rubik, sans-serif',
          fontSize: '16px',
          fontWeight: 600,
          opacity: fade ? 1 : 0,
          transition: 'opacity 0.2s ease',
          minWidth: '180px',
        }}>
          {LOADING_MESSAGES[msgIdx]}
        </p>
      </div>
    </div>
  );
}

export default function App() {
  const [loading, setLoading] = useState(false);
  return (
    <LoadingContext.Provider value={{ loading, setLoading }}>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <LoadingOverlay />
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/schedule" element={<SchedulePage />} />
            <Route path="/my-schedule" element={<MySchedulePage />} />
            <Route path="/admin" element={<AdminPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </LoadingContext.Provider>
  );
}
