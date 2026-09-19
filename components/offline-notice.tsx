'use client';

import { useEffect, useState } from 'react';

export function OfflineNotice() {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    addEventListener('online', update);
    addEventListener('offline', update);
    return () => { removeEventListener('online', update); removeEventListener('offline', update); };
  }, []);
  return <div className={`offline ${offline ? 'show' : ''}`} role="status">You are offline. Reconnect to continue saving progress.</div>;
}
