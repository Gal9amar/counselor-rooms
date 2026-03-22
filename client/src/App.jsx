import React, { createContext, useContext, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import DashboardPage from './pages/DashboardPage';
import SchedulePage from './pages/SchedulePage';
import MySchedulePage from './pages/MySchedulePage';
import AdminPage from './pages/AdminPage';

export const LoadingContext = createContext({ loading: false, setLoading: () => {} });
export function useLoading() { return useContext(LoadingContext); }

function LoadingOverlay() {
  const { loading } = useLoading();
  if (!loading) return null;
  return (
    <div className="loading-overlay">
      <div className="spinner"/>
    </div>
  );
}

export default function App() {
  const [loading, setLoading] = useState(false);
  return (
    <LoadingContext.Provider value={{ loading, setLoading }}>
      <BrowserRouter>
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
