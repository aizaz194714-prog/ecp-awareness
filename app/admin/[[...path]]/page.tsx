import Script from 'next/script';

export const metadata = { title: 'Administration' };

export default function AdminPage() {
  return <><link rel="stylesheet" href="/assets/admin.css" /><div id="app"><div className="admin-loading"><span /><p>Loading administration…</p></div></div><Script src="/assets/admin.js" strategy="afterInteractive" /></>;
}
