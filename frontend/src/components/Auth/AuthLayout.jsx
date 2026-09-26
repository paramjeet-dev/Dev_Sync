/**
 * The scribble is a small set of hand-drawn-style SVG strokes — a nod to
 * the whiteboard itself being the product, rather than generic decoration.
 * Kept deliberately understated (low opacity, monochrome) so it reads as
 * texture, not a competing focal point — the form is still the job here.
 */
function Scribble() {
  return (
    <svg className="auth-scribble" viewBox="0 0 400 500" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M60 120 C 90 80, 140 80, 150 130 S 130 200, 90 190"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <rect x="230" y="300" width="90" height="70" rx="4" stroke="currentColor" strokeWidth="2.5" transform="rotate(-4 275 335)" />
      <path d="M80 380 L 220 420" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M200 415 L 220 420 L 210 400" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="310" cy="130" r="38" stroke="currentColor" strokeWidth="2.5" />
    </svg>
  );
}

export default function AuthLayout({ title, subtitle, children }) {
  return (
    <div className="auth-page">
      <div className="auth-identity-panel">
        <Scribble />
        <div className="auth-wordmark">Dev-Sync</div>
        <div className="auth-identity-copy">
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
      </div>
      <div className="auth-form-panel">{children}</div>
    </div>
  );
}
