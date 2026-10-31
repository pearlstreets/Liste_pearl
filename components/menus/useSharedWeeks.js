// Semaines partagées avec moi : relues à l'ouverture et au retour dans l'application.
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, DeviceEventEmitter } from 'react-native';
import { fetchSharedWeeks } from '../../services/sharedMenus';

export const SHARED_REFRESH_MS = 60000;

export default function useSharedWeeks(active) {
  const [weeks, setWeeks] = useState([]);
  const last = useRef(0);
  const seq = useRef(0);

  const refresh = useCallback(async () => {
    if (Date.now() - last.current < SHARED_REFRESH_MS) return;
    last.current = Date.now();
    const n = ++seq.current;
    const list = await fetchSharedWeeks();
    if (n === seq.current) setWeeks(list);
  }, []);

  useEffect(() => {
    if (!active) return undefined;
    refresh();
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') refresh();
    });
    return () => sub.remove();
  }, [active, refresh]);

  // Déconnexion : plus rien en mémoire, et une réponse encore en route est ignorée.
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('USER_DATA_CLEARED', () => {
      seq.current += 1;
      last.current = 0;
      setWeeks([]);
    });
    return () => {
      seq.current += 1;
      sub.remove();
    };
  }, []);

  return weeks;
}
