import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { KEY_AUTH, KEY_PROFILE } from '../constants/storageKeys';
import { loginUser, logoutUser } from '../services/auth';
import { clearTokens } from '../services/api';

function _getOneSignal() {
  try { const m = require('react-native-onesignal'); return m.OneSignal || m.default || m; } catch { return null; }
}

export function useAuth() {
  const [isAuth, setIsAuth] = useState(null); // null = loading
  const [user, setUser] = useState(null);

  useEffect(() => {
    (async () => {
      const raw = await AsyncStorage.getItem(KEY_AUTH);
      setIsAuth(!!raw);
      if (raw) setUser(JSON.parse(raw));
    })();
  }, []);

  const login = useCallback(async (identifier, password) => {
    const result = await loginUser(identifier, password);
    if (result.success) {
      setUser(result.user);
      setIsAuth(true);
      try {
        const OS = _getOneSignal();
        if (OS && result.user?.id) OS.login(String(result.user.id));
      } catch {}
    }
    return result;
  }, []);

  const logout = useCallback(async () => {
    try { const OS = _getOneSignal(); if (OS) OS.logout(); } catch {}
    await logoutUser();
    await AsyncStorage.removeItem(KEY_AUTH);
    await AsyncStorage.removeItem(KEY_PROFILE);
    setUser(null);
    setIsAuth(false);
  }, []);

  return { isAuth, user, login, logout, setIsAuth };
}
