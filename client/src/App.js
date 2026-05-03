import React, { useState, useEffect } from 'react';
import LoginPage from './components/LoginPage';
import AdminDashboard from './components/AdminDashboard';
import AgentDashboard from './components/AgentDashboard';

/**
 * App — Root component with role-based dashboard routing.
 * Stores auth user object in localStorage.
 */
const AUTH_KEY = 'leadbridge_user_v2';

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(AUTH_KEY);
    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch (e) {
        localStorage.removeItem(AUTH_KEY);
      }
    }
    setLoading(false);
  }, []);

  function handleLogin(userData) {
    localStorage.setItem(AUTH_KEY, JSON.stringify(userData));
    setUser(userData);
  }

  function handleLogout() {
    localStorage.removeItem(AUTH_KEY);
    setUser(null);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-10 h-10 border-4 border-primary-100 border-t-primary-600 rounded-full animate-spin" />
      </div>
    );
  }

  // Render logic
  if (!user) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return user.role === 'admin' ? (
    <AdminDashboard user={user} onLogout={handleLogout} />
  ) : (
    <AgentDashboard user={user} onLogout={handleLogout} />
  );
}
