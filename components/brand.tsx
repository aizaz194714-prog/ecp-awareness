export function Brand({ subtitle = 'Your learning journey' }: { subtitle?: string }) {
  return <div className="brand"><span className="brand-mark">ECP</span><span className="brand-copy">Voter Awareness<small>{subtitle}</small></span></div>;
}
