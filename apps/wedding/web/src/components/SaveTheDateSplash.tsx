import React from 'react';
import '../styles/tokens.css';

export interface SaveTheDateSplashProps {
  /** Duração em milissegundos antes do fade-out automático (padrão: 3000ms) */
  autoDismissMs?: number;
  /** Callback acionado quando o splash screen desaparece por completo */
  onDismissed?: () => void;
  className?: string;
}

/**
 * SaveTheDateSplash
 * Ecrã de introdução romântico e elegante com fade-out suave ao fim de ~3s ou por clique.
 */
export const SaveTheDateSplash: React.FC<SaveTheDateSplashProps> = ({
  autoDismissMs = 3000,
  onDismissed,
  className = '',
}) => {
  const [isFadingOut, setIsFadingOut] = React.useState<boolean>(false);
  const [isRemoved, setIsRemoved] = React.useState<boolean>(false);

  const handleDismiss = React.useCallback(() => {
    if (isFadingOut || isRemoved) return;
    setIsFadingOut(true);

    window.setTimeout(() => {
      setIsRemoved(true);
      onDismissed?.();
    }, 1200); // tempo correspondente à transição CSS (1.2s)
  }, [isFadingOut, isRemoved, onDismissed]);

  React.useEffect(() => {
    if (autoDismissMs <= 0) return;

    const timer = window.setTimeout(() => {
      handleDismiss();
    }, autoDismissMs);

    return () => {
      window.clearTimeout(timer);
    };
  }, [autoDismissMs, handleDismiss]);

  React.useEffect(() => {
    if (!isRemoved) {
      const originalBodyOverflow = document.body.style.overflow;
      const originalHtmlOverflow = document.documentElement.style.overflow;
      const originalTouchAction = document.body.style.touchAction;

      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';

      const preventTouchMove = (e: TouchEvent) => {
        e.preventDefault();
      };

      window.addEventListener('touchmove', preventTouchMove, { passive: false });

      return () => {
        document.body.style.overflow = originalBodyOverflow;
        document.documentElement.style.overflow = originalHtmlOverflow;
        document.body.style.touchAction = originalTouchAction;
        window.removeEventListener('touchmove', preventTouchMove);
      };
    }
  }, [isRemoved]);

  if (isRemoved) {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Save the Date"
      onClick={handleDismiss}
      className={`splash-overlay ${isFadingOut ? 'fade-out' : ''} ${className}`}
    >
      <div className="splash-frame" aria-hidden="true" />

      <div className="splash-card">
        <p className="splash-badge">Save the Date</p>

        <h1 className="splash-names">
          João <span className="splash-ampersand">&amp;</span> Madalena
        </h1>

        <div className="splash-divider" aria-hidden="true">
          <span className="splash-divider-line" />
          <span className="splash-divider-diamond">✦</span>
          <span className="splash-divider-line" />
        </div>

        <p className="splash-date">16 · 08 · 2027</p>
        <p className="splash-location">Quinta da Grilla · Portugal</p>

        <button
          type="button"
          className="splash-enter-btn"
          onClick={(e) => {
            e.stopPropagation();
            handleDismiss();
          }}
        >
          Entrar no Site &rarr;
        </button>
      </div>

      <div
        className="splash-progress-bar"
        aria-hidden="true"
        style={{ animationDuration: `${autoDismissMs}ms` }}
      />
    </div>
  );
};
