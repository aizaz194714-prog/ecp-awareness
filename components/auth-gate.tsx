'use client';

import { useRouter } from 'next/navigation';
import { ReactNode, useEffect, useState } from 'react';
import { getToken } from '@/lib/voter-api';

export function AuthGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getToken()) router.replace(`/register?next=${encodeURIComponent(location.pathname)}`);
    else setReady(true);
  }, [router]);

  if (!ready) {
    return <main className="app"><div className="state-card"><span className="spinner dark-spinner" /><p className="hint loading-copy">Loading your journey…</p></div></main>;
  }
  return children;
}
