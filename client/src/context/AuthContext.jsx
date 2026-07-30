import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import api, { setToken, getToken } from '../api/client.js';
import { connectSocket, disconnectSocket } from '../socket.js';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadMe = useCallback(async () => {
    if (!getToken()) { setLoading(false); return; }
    try {
      const { user } = await api.me();
      setUser(user);
      connectSocket();
    } catch {
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadMe(); }, [loadMe]);

  const login = async (email, password) => {
    const { token, user } = await api.login(email, password);
    setToken(token);
    setUser(user);
    connectSocket();
    return user;
  };

  const loginWithToken = async (token) => {
    setToken(token);
    const { user } = await api.me();
    setUser(user);
    connectSocket();
    return user;
  };

  const loginWithGoogleCode = async (code) => {
    const { token, user } = await api.exchangeGoogleCode(code);
    setToken(token);
    setUser(user);
    connectSocket();
    return user;
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    disconnectSocket();
  };

  const refreshUser = async () => {
    const { user } = await api.me();
    setUser(user);
  };

  return (
    <AuthCtx.Provider value={{ user, loading, login, loginWithToken, loginWithGoogleCode, logout, refreshUser, isAdmin: user?.role === 'admin' }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  return useContext(AuthCtx);
}
