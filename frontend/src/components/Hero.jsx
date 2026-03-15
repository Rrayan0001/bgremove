export default function Hero({ theme, onToggleTheme }) {
  return (
    <header className="hero-shell">
      <div>
        <p className="micro-label theme-text-subtle">AI Background Remover</p>
        <h1 className="theme-text-primary mt-2 font-display text-3xl font-semibold tracking-[-0.07em] sm:text-4xl lg:text-5xl">
          Remove backgrounds fast.
        </h1>
      </div>

      <div className="hero-side">
        <div className="hero-meta">
          <span>JPG, PNG, WebP</span>
          <span>10MB max</span>
          <span>One-screen workflow</span>
        </div>

        <button
          type="button"
          className="theme-toggle"
          onClick={onToggleTheme}
          aria-pressed={theme === 'dark'}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          <span className="theme-toggle-copy">{theme === 'dark' ? 'Dark' : 'Light'}</span>
          <span className="theme-toggle-track">
            <span className="theme-toggle-thumb" />
          </span>
        </button>
      </div>
    </header>
  );
}
