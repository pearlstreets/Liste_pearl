import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { KEY_AUTH, KEY_PROFILE } from '../constants/storageKeys';
import { loginUser, logoutUser } from '../services/auth';
import { clearTokens } from '../services/api';

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
    }
    return result;
  }, []);

  const logout = useCallback(async () => {
    await logoutUser();
    await AsyncStorage.removeItem(KEY_AUTH);
    await AsyncStorage.removeItem(KEY_PROFILE);
    setUser(null);
    setIsAuth(false);
  }, []);

  return { isAuth, user, login, logout, setIsAuth };
}
