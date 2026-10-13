import React from 'react';

export interface ReceptionIllustrationProps {
  /** Controls reveal visibility state. Defaults to true. */
  isVisible?: boolean;
  className?: string;
}

/**
 * Hook to detect prefers-reduced-motion media query.
 * Updates dynamically if user preference changes.
 */
function usePrefersReducedMotion(): boolean {
  const [reducedMotion, setReducedMotion] = React.useState<boolean>(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  React.useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(mediaQuery.matches);
    update();

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', update);
      return () => mediaQuery.removeEventListener('change', update);
    } else if (mediaQuery.addListener) {
      mediaQuery.addListener(update);
      return () => mediaQuery.removeListener(update);
    }
  }, []);

  return reducedMotion;
}

/**
 * ReceptionIllustration component renders a bespoke, wide panoramic SVG illustration
 * of a banquet reception table anchoring the bottom of the hero section.
 *
 * Features:
 * - Flowing ivory table linen / runner (#FAF7F0, #EDE5D8, #D5D7C6) with soft fabric drapes
 * - Slender brass taper candleholders (#A3894F, #C9B580, #7D6633) of staggered heights
 * - Slender ivory candles with gentle warm glowing flames (#FDE68A, #F59E0B)
 * - Fine crystal stemware / wine glasses with delicate reflections
 * - Low botanical olive & eucalyptus floral garlands weaving along the runner
 * - Non-blocking interaction (pointer-events: none) and aria-hidden="true" for screen reader hygiene
 * - Respects prefers-reduced-motion for accessible animations
 */
export const ReceptionIllustration: React.FC<ReceptionIllustrationProps> = ({
  isVisible = true,
  className = '',
}) => {
  const reducedMotion = usePrefersReducedMotion();

  const style: React.CSSProperties = {
    pointerEvents: 'none',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    width: '100%',
    transform: reducedMotion
      ? 'none'
      : isVisible
      ? 'translateY(0)'
      : 'translateY(20px)',
    opacity: isVisible ? 1 : 0,
    transition: reducedMotion
      ? 'none'
      : 'opacity 800ms cubic-bezier(0.22, 1, 0.36, 1), transform 800ms cubic-bezier(0.22, 1, 0.36, 1)',
    zIndex: 'var(--z-illustration, 1)',
  };

  return (
    <div
      className={`reception-illustration pointer-events-none absolute bottom-0 left-0 right-0 w-full overflow-hidden select-none ${
        !isVisible ? 'opacity-0' : 'opacity-100'
      } ${className}`}
      aria-hidden="true"
      style={style}
    >
      <svg
        className="reception-svg w-full h-auto max-h-[220px] sm:max-h-[260px] overflow-visible pointer-events-none"
        viewBox="0 0 1200 240"
        preserveAspectRatio="xMidYMax meet"
        aria-hidden="true"
      >
        <defs>
          {/* Flame radiant glow filter */}
          <filter id="reception-flame-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>

          {/* Candle flame gradients */}
          <radialGradient id="reception-flame-grad" cx="50%" cy="65%" r="65%">
            <stop offset="0%" stopColor="#FFFDF7" stopOpacity="1" />
            <stop offset="35%" stopColor="#FDE68A" stopOpacity="0.95" />
            <stop offset="75%" stopColor="#F59E0B" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#D97706" stopOpacity="0" />
          </radialGradient>

          <radialGradient id="reception-flame-halo" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FEF3C7" stopOpacity="0.55" />
            <stop offset="50%" stopColor="#FDE68A" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#FDE68A" stopOpacity="0" />
          </radialGradient>

          {/* Brass metallic linear gradient */}
          <linearGradient id="reception-brass" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#7D6633" />
            <stop offset="35%" stopColor="#C9B580" />
            <stop offset="70%" stopColor="#A3894F" />
            <stop offset="100%" stopColor="#7D6633" />
          </linearGradient>

          {/* Linen runner shadow gradient */}
          <linearGradient id="reception-linen-shadow" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#EDE5D8" stopOpacity="0.4" />
            <stop offset="60%" stopColor="#D5D7C6" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#D5D7C6" stopOpacity="0.9" />
          </linearGradient>
        </defs>

        {/* ============================================================== */}
        {/* DRAPED IVORY TABLE RUNNER & LINEN SWAGS                        */}
        {/* ============================================================== */}
        <g id="reception-table-runner" className="reception-runner" data-part="runner">
          {/* Base table plane shadow */}
          <path
            d="M -20 205 Q 300 215 600 208 Q 900 215 1220 205 L 1220 240 L -20 240 Z"
            fill="url(#reception-linen-shadow)"
          />

          {/* Main draped ivory table runner */}
          <path
            d="M -20 190 C 120 184, 280 198, 440 190 C 600 182, 760 198, 920 188 C 1060 182, 1160 194, 1220 190 L 1220 240 L -20 240 Z"
            fill="#FAF7F0"
            stroke="#EDE5D8"
            strokeWidth="1.2"
          />

          {/* Upper runner contour highlight */}
          <path
            d="M -20 190 C 120 184, 280 198, 440 190 C 600 182, 760 198, 920 188 C 1060 182, 1160 194, 1220 190"
            fill="none"
            stroke="#FAF8F2"
            strokeWidth="2"
            strokeOpacity="0.9"
          />

          {/* Linen swags & organic fabric folds */}
          <path
            d="M 60 195 C 180 206, 260 210, 360 200"
            fill="none"
            stroke="#EDE5D8"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
          <path
            d="M 80 200 C 190 214, 250 216, 340 206"
            fill="none"
            stroke="#D5D7C6"
            strokeWidth="0.8"
            strokeOpacity="0.75"
          />

          <path
            d="M 420 196 C 520 208, 620 208, 720 198"
            fill="none"
            stroke="#EDE5D8"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
          <path
            d="M 440 202 C 530 214, 610 214, 700 204"
            fill="none"
            stroke="#D5D7C6"
            strokeWidth="0.8"
            strokeOpacity="0.75"
          />

          <path
            d="M 780 196 C 880 208, 980 208, 1080 198"
            fill="none"
            stroke="#EDE5D8"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
          <path
            d="M 800 202 C 890 214, 970 214, 1060 204"
            fill="none"
            stroke="#D5D7C6"
            strokeWidth="0.8"
            strokeOpacity="0.75"
          />

          {/* Additional delicate fold creases */}
          <path
            d="M 220 210 C 270 220, 310 218, 350 212"
            fill="none"
            stroke="#EDE5D8"
            strokeWidth="0.8"
            strokeOpacity="0.7"
          />
          <path
            d="M 580 210 C 630 220, 670 218, 710 212"
            fill="none"
            stroke="#EDE5D8"
            strokeWidth="0.8"
            strokeOpacity="0.7"
          />
          <path
            d="M 940 210 C 990 220, 1030 218, 1070 212"
            fill="none"
            stroke="#EDE5D8"
            strokeWidth="0.8"
            strokeOpacity="0.7"
          />
        </g>

        {/* ============================================================== */}
        {/* SLENDER BRASS TAPER CANDLEHOLDERS & WARM GLOWING FLAMES        */}
        {/* ============================================================== */}
        <g id="reception-candlesticks">
          {/* --- CANDLESTICK 1 (X=160, Mid height) --- */}
          <g>
            <g className="reception-candleholder" data-part="candleholder">
              {/* Stepped round pedestal base */}
              <ellipse cx="160" cy="194" rx="16" ry="4" fill="#7D6633" stroke="#A3894F" strokeWidth="0.8" />
              <ellipse cx="160" cy="192" rx="12" ry="3" fill="#A3894F" stroke="#C9B580" strokeWidth="0.8" />
              <ellipse cx="160" cy="190" rx="7" ry="2" fill="#C9B580" />
              {/* Slender turned brass stem */}
              <path d="M 157.5 190 L 158 152 L 162 152 L 162.5 190 Z" fill="url(#reception-brass)" />
              {/* Turned collar node */}
              <ellipse cx="160" cy="152" rx="4.5" ry="1.8" fill="#C9B580" stroke="#7D6633" strokeWidth="0.6" />
              {/* Upper stem */}
              <path d="M 158 152 L 158.5 116 L 161.5 116 L 162 152 Z" fill="url(#reception-brass)" />
              {/* Top candle cup / bobeche */}
              <ellipse cx="160" cy="116" rx="6.5" ry="2.2" fill="#A3894F" stroke="#7D6633" strokeWidth="0.6" />
              <ellipse cx="160" cy="115" rx="4.5" ry="1.5" fill="#C9B580" />
            </g>
            {/* Candle Taper */}
            <g className="reception-candle" data-part="candle">
              <rect x="158" y="76" width="4" height="39" rx="1" fill="#FAF8F2" stroke="#EDE5D8" strokeWidth="0.5" />
              <line x1="159" y1="78" x2="159" y2="114" stroke="#FFFFFF" strokeWidth="0.7" strokeOpacity="0.8" />
              <line x1="160" y1="76" x2="160" y2="72" stroke="#7D6633" strokeWidth="0.9" strokeLinecap="round" />
            </g>
            {/* Warm Flame */}
            <g className="reception-flame" data-part="flame">
              <ellipse cx="160" cy="65" rx="8" ry="12" fill="url(#reception-flame-halo)" />
              <path
                d="M 160 58 C 162.5 62, 163.5 66, 162 69 C 161 70.5, 159 70.5, 158 69 C 156.5 66, 157.5 62, 160 58 Z"
                fill="url(#reception-flame-grad)"
                filter="url(#reception-flame-glow)"
              />
              <ellipse cx="160" cy="68" rx="1.2" ry="2.5" fill="#FFFDF7" fillOpacity="0.95" />
            </g>
          </g>

          {/* --- CANDLESTICK 2 (X=380, Tall height) --- */}
          <g>
            <g className="reception-candleholder" data-part="candleholder">
              <ellipse cx="380" cy="195" rx="18" ry="4.5" fill="#7D6633" stroke="#A3894F" strokeWidth="0.8" />
              <ellipse cx="380" cy="193" rx="13" ry="3.2" fill="#A3894F" stroke="#C9B580" strokeWidth="0.8" />
              <ellipse cx="380" cy="191" rx="8" ry="2.2" fill="#C9B580" />
              <path d="M 377.5 191 L 378 142 L 382 142 L 382.5 191 Z" fill="url(#reception-brass)" />
              <ellipse cx="380" cy="142" rx="5" ry="2" fill="#C9B580" stroke="#7D6633" strokeWidth="0.6" />
              <path d="M 378 142 L 378.5 96 L 381.5 96 L 382 142 Z" fill="url(#reception-brass)" />
              <ellipse cx="380" cy="96" rx="7" ry="2.4" fill="#A3894F" stroke="#7D6633" strokeWidth="0.6" />
              <ellipse cx="380" cy="95" rx="5" ry="1.6" fill="#C9B580" />
            </g>
            <g className="reception-candle" data-part="candle">
              <rect x="378" y="52" width="4" height="43" rx="1" fill="#FAF8F2" stroke="#EDE5D8" strokeWidth="0.5" />
              <line x1="379" y1="54" x2="379" y2="94" stroke="#FFFFFF" strokeWidth="0.7" strokeOpacity="0.8" />
              <line x1="380" y1="52" x2="380" y2="48" stroke="#7D6633" strokeWidth="0.9" strokeLinecap="round" />
            </g>
            <g className="reception-flame" data-part="flame">
              <ellipse cx="380" cy="41" rx="9" ry="13" fill="url(#reception-flame-halo)" />
              <path
                d="M 380 34 C 382.5 38, 383.5 42, 382 45 C 381 46.5, 379 46.5, 378 45 C 376.5 42, 377.5 38, 380 34 Z"
                fill="url(#reception-flame-grad)"
                filter="url(#reception-flame-glow)"
              />
              <ellipse cx="380" cy="44" rx="1.2" ry="2.5" fill="#FFFDF7" fillOpacity="0.95" />
            </g>
          </g>

          {/* --- CANDLESTICK 3 (X=600, Center Mid-tall height) --- */}
          <g>
            <g className="reception-candleholder" data-part="candleholder">
              <ellipse cx="600" cy="192" rx="17" ry="4.2" fill="#7D6633" stroke="#A3894F" strokeWidth="0.8" />
              <ellipse cx="600" cy="190" rx="12" ry="3" fill="#A3894F" stroke="#C9B580" strokeWidth="0.8" />
              <ellipse cx="600" cy="188" rx="7.5" ry="2" fill="#C9B580" />
              <path d="M 597.5 188 L 598 146 L 602 146 L 602.5 188 Z" fill="url(#reception-brass)" />
              <ellipse cx="600" cy="146" rx="4.8" ry="1.9" fill="#C9B580" stroke="#7D6633" strokeWidth="0.6" />
              <path d="M 598 146 L 598.5 106 L 601.5 106 L 602 146 Z" fill="url(#reception-brass)" />
              <ellipse cx="600" cy="106" rx="6.5" ry="2.2" fill="#A3894F" stroke="#7D6633" strokeWidth="0.6" />
              <ellipse cx="600" cy="105" rx="4.5" ry="1.5" fill="#C9B580" />
            </g>
            <g className="reception-candle" data-part="candle">
              <rect x="598" y="64" width="4" height="41" rx="1" fill="#FAF8F2" stroke="#EDE5D8" strokeWidth="0.5" />
              <line x1="599" y1="66" x2="599" y2="104" stroke="#FFFFFF" strokeWidth="0.7" strokeOpacity="0.8" />
              <line x1="600" y1="64" x2="600" y2="60" stroke="#7D6633" strokeWidth="0.9" strokeLinecap="round" />
            </g>
            <g className="reception-flame" data-part="flame">
              <ellipse cx="600" cy="53" rx="8.5" ry="12.5" fill="url(#reception-flame-halo)" />
              <path
                d="M 600 46 C 602.5 50, 603.5 54, 602 57 C 601 58.5, 599 58.5, 598 57 C 596.5 54, 597.5 50, 600 46 Z"
                fill="url(#reception-flame-grad)"
                filter="url(#reception-flame-glow)"
              />
              <ellipse cx="600" cy="56" rx="1.2" ry="2.5" fill="#FFFDF7" fillOpacity="0.95" />
            </g>
          </g>

          {/* --- CANDLESTICK 4 (X=820, Tall height) --- */}
          <g>
            <g className="reception-candleholder" data-part="candleholder">
              <ellipse cx="820" cy="195" rx="18" ry="4.5" fill="#7D6633" stroke="#A3894F" strokeWidth="0.8" />
              <ellipse cx="820" cy="193" rx="13" ry="3.2" fill="#A3894F" stroke="#C9B580" strokeWidth="0.8" />
              <ellipse cx="820" cy="191" rx="8" ry="2.2" fill="#C9B580" />
              <path d="M 817.5 191 L 818 142 L 822 142 L 822.5 191 Z" fill="url(#reception-brass)" />
              <ellipse cx="820" cy="142" rx="5" ry="2" fill="#C9B580" stroke="#7D6633" strokeWidth="0.6" />
              <path d="M 818 142 L 818.5 96 L 821.5 96 L 822 142 Z" fill="url(#reception-brass)" />
              <ellipse cx="820" cy="96" rx="7" ry="2.4" fill="#A3894F" stroke="#7D6633" strokeWidth="0.6" />
              <ellipse cx="820" cy="95" rx="5" ry="1.6" fill="#C9B580" />
            </g>
            <g className="reception-candle" data-part="candle">
              <rect x="818" y="52" width="4" height="43" rx="1" fill="#FAF8F2" stroke="#EDE5D8" strokeWidth="0.5" />
              <line x1="819" y1="54" x2="819" y2="94" stroke="#FFFFFF" strokeWidth="0.7" strokeOpacity="0.8" />
              <line x1="820" y1="52" x2="820" y2="48" stroke="#7D6633" strokeWidth="0.9" strokeLinecap="round" />
            </g>
            <g className="reception-flame" data-part="flame">
              <ellipse cx="820" cy="41" rx="9" ry="13" fill="url(#reception-flame-halo)" />
              <path
                d="M 820 34 C 822.5 38, 823.5 42, 822 45 C 821 46.5, 819 46.5, 818 45 C 816.5 42, 817.5 38, 820 34 Z"
                fill="url(#reception-flame-grad)"
                filter="url(#reception-flame-glow)"
              />
              <ellipse cx="820" cy="44" rx="1.2" ry="2.5" fill="#FFFDF7" fillOpacity="0.95" />
            </g>
          </g>

          {/* --- CANDLESTICK 5 (X=1040, Mid height) --- */}
          <g>
            <g className="reception-candleholder" data-part="candleholder">
              <ellipse cx="1040" cy="194" rx="16" ry="4" fill="#7D6633" stroke="#A3894F" strokeWidth="0.8" />
              <ellipse cx="1040" cy="192" rx="12" ry="3" fill="#A3894F" stroke="#C9B580" strokeWidth="0.8" />
              <ellipse cx="1040" cy="190" rx="7" ry="2" fill="#C9B580" />
              <path d="M 1037.5 190 L 1038 152 L 1042 152 L 1042.5 190 Z" fill="url(#reception-brass)" />
              <ellipse cx="1040" cy="152" rx="4.5" ry="1.8" fill="#C9B580" stroke="#7D6633" strokeWidth="0.6" />
              <path d="M 1038 152 L 1038.5 116 L 1041.5 116 L 1042 152 Z" fill="url(#reception-brass)" />
              <ellipse cx="1040" cy="116" rx="6.5" ry="2.2" fill="#A3894F" stroke="#7D6633" strokeWidth="0.6" />
              <ellipse cx="1040" cy="115" rx="4.5" ry="1.5" fill="#C9B580" />
            </g>
            <g className="reception-candle" data-part="candle">
              <rect x="1038" y="76" width="4" height="39" rx="1" fill="#FAF8F2" stroke="#EDE5D8" strokeWidth="0.5" />
              <line x1="1039" y1="78" x2="1039" y2="114" stroke="#FFFFFF" strokeWidth="0.7" strokeOpacity="0.8" />
              <line x1="1040" y1="76" x2="1040" y2="72" stroke="#7D6633" strokeWidth="0.9" strokeLinecap="round" />
            </g>
            <g className="reception-flame" data-part="flame">
              <ellipse cx="1040" cy="65" rx="8" ry="12" fill="url(#reception-flame-halo)" />
              <path
                d="M 1040 58 C 1042.5 62, 1043.5 66, 1042 69 C 1041 70.5, 1039 70.5, 1038 69 C 1036.5 66, 1037.5 62, 1040 58 Z"
                fill="url(#reception-flame-grad)"
                filter="url(#reception-flame-glow)"
              />
              <ellipse cx="1040" cy="68" rx="1.2" ry="2.5" fill="#FFFDF7" fillOpacity="0.95" />
            </g>
          </g>
        </g>

        {/* ============================================================== */}
        {/* FINE CRYSTAL STEMWARE / WINE GLASSES & REFLECTIONS             */}
        {/* ============================================================== */}
        <g id="reception-stemware">
          {/* Glass 1 (X=270, Wine glass) */}
          <g className="reception-glassware" data-part="glassware">
            {/* Foot base */}
            <ellipse cx="270" cy="194" rx="10" ry="2.5" fill="none" stroke="#D5D7C6" strokeWidth="0.8" />
            {/* Stem */}
            <line x1="270" y1="194" x2="270" y2="168" stroke="#EDE5D8" strokeWidth="1" />
            {/* Bowl */}
            <path
              d="M 264 148 C 263 158, 266 168, 270 168 C 274 168, 277 158, 276 148 Z"
              fill="rgba(255, 255, 255, 0.2)"
              stroke="#D5D7C6"
              strokeWidth="0.8"
            />
            {/* Rim ellipse */}
            <ellipse cx="270" cy="148" rx="6" ry="1.8" fill="none" stroke="#FAF8F2" strokeWidth="0.8" strokeOpacity="0.9" />
            {/* Wine meniscus line */}
            <path d="M 265 158 Q 270 161 275 158" fill="none" stroke="#EDE5D8" strokeWidth="0.6" strokeOpacity="0.75" />
            {/* Glass light reflection */}
            <path d="M 265 150 C 264.5 155, 266 162, 268 165" fill="none" stroke="#FFFFFF" strokeWidth="0.7" strokeOpacity="0.8" />
          </g>

          {/* Glass 2 (X=490, Flute glass) */}
          <g className="reception-glassware" data-part="glassware">
            <ellipse cx="490" cy="193" rx="9" ry="2.2" fill="none" stroke="#D5D7C6" strokeWidth="0.8" />
            <line x1="490" y1="193" x2="490" y2="165" stroke="#EDE5D8" strokeWidth="1" />
            <path
              d="M 486 138 C 485.5 152, 487 165, 490 165 C 493 165, 494.5 152, 494 138 Z"
              fill="rgba(255, 255, 255, 0.22)"
              stroke="#D5D7C6"
              strokeWidth="0.8"
            />
            <ellipse cx="490" cy="138" rx="4" ry="1.4" fill="none" stroke="#FAF8F2" strokeWidth="0.8" strokeOpacity="0.9" />
            <path d="M 486.5 142 C 486 150, 487.5 158, 489 162" fill="none" stroke="#FFFFFF" strokeWidth="0.7" strokeOpacity="0.8" />
          </g>

          {/* Glass 3 (X=710, Wine glass) */}
          <g className="reception-glassware" data-part="glassware">
            <ellipse cx="710" cy="193" rx="10" ry="2.5" fill="none" stroke="#D5D7C6" strokeWidth="0.8" />
            <line x1="710" y1="193" x2="710" y2="168" stroke="#EDE5D8" strokeWidth="1" />
            <path
              d="M 704 148 C 703 158, 706 168, 710 168 C 714 168, 717 158, 716 148 Z"
              fill="rgba(255, 255, 255, 0.2)"
              stroke="#D5D7C6"
              strokeWidth="0.8"
            />
            <ellipse cx="710" cy="148" rx="6" ry="1.8" fill="none" stroke="#FAF8F2" strokeWidth="0.8" strokeOpacity="0.9" />
            <path d="M 705 158 Q 710 161 715 158" fill="none" stroke="#EDE5D8" strokeWidth="0.6" strokeOpacity="0.75" />
            <path d="M 705 150 C 704.5 155, 706 162, 708 165" fill="none" stroke="#FFFFFF" strokeWidth="0.7" strokeOpacity="0.8" />
          </g>

          {/* Glass 4 (X=930, Flute glass) */}
          <g className="reception-glassware" data-part="glassware">
            <ellipse cx="930" cy="193" rx="9" ry="2.2" fill="none" stroke="#D5D7C6" strokeWidth="0.8" />
            <line x1="930" y1="193" x2="930" y2="165" stroke="#EDE5D8" strokeWidth="1" />
            <path
              d="M 926 138 C 925.5 152, 927 165, 930 165 C 933 165, 934.5 152, 934 138 Z"
              fill="rgba(255, 255, 255, 0.22)"
              stroke="#D5D7C6"
              strokeWidth="0.8"
            />
            <ellipse cx="930" cy="138" rx="4" ry="1.4" fill="none" stroke="#FAF8F2" strokeWidth="0.8" strokeOpacity="0.9" />
            <path d="M 926.5 142 C 926 150, 927.5 158, 929 162" fill="none" stroke="#FFFFFF" strokeWidth="0.7" strokeOpacity="0.8" />
          </g>

          {/* Glass 5 (X=1120, Wine glass) */}
          <g className="reception-glassware" data-part="glassware">
            <ellipse cx="1120" cy="194" rx="10" ry="2.5" fill="none" stroke="#D5D7C6" strokeWidth="0.8" />
            <line x1="1120" y1="194" x2="1120" y2="168" stroke="#EDE5D8" strokeWidth="1" />
            <path
              d="M 1114 148 C 1113 158, 1116 168, 1120 168 C 1124 168, 1127 158, 1126 148 Z"
              fill="rgba(255, 255, 255, 0.2)"
              stroke="#D5D7C6"
              strokeWidth="0.8"
            />
            <ellipse cx="1120" cy="148" rx="6" ry="1.8" fill="none" stroke="#FAF8F2" strokeWidth="0.8" strokeOpacity="0.9" />
            <path d="M 1115 150 C 1114.5 155, 1116 162, 1118 165" fill="none" stroke="#FFFFFF" strokeWidth="0.7" strokeOpacity="0.8" />
          </g>
        </g>

        {/* ============================================================== */}
        {/* BOTANICAL FLORAL & OLIVE GARLANDS WEAVING ALONG THE RUNNER     */}
        {/* ============================================================== */}
        <g id="reception-botanical-garlands" className="reception-garland" data-part="garland">
          {/* Main meandering vine stems */}
          <path
            d="M 0 206 C 100 190, 220 216, 340 198 C 460 186, 560 214, 680 196 C 800 186, 900 214, 1020 196 C 1120 186, 1180 208, 1220 200"
            fill="none"
            stroke="#505B46"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <path
            d="M 20 208 C 140 216, 260 192, 390 210 C 520 194, 640 214, 770 198 C 890 214, 1010 194, 1140 210 C 1180 204, 1200 202, 1220 204"
            fill="none"
            stroke="#68745C"
            strokeWidth="1.6"
            strokeLinecap="round"
          />

          {/* --- LEAF CLUSTERS: SECTION 1 (X: 20 - 240) --- */}
          <g>
            {/* Olive Leaf 1 */}
            <path
              className="reception-leaf"
              data-part="leaf"
              d="M 40 205 C 50 192, 65 190, 75 194 C 68 204, 55 208, 40 205 Z"
              fill="#505B46"
              fillOpacity="0.9"
            />
            <path d="M 40 205 Q 60 196 75 194" fill="none" stroke="#8F9A83" strokeWidth="0.6" />

            {/* Eucalyptus Leaf 1 (rounded sage) */}
            <ellipse
              className="reception-leaf"
              data-part="leaf"
              cx="95"
              cy="200"
              rx="9"
              ry="7"
              transform="rotate(-15 95 200)"
              fill="#A7B09A"
              fillOpacity="0.85"
              stroke="#8F9A83"
              strokeWidth="0.6"
            />

            {/* Olive Leaf 2 */}
            <path
              className="reception-leaf"
              data-part="leaf"
              d="M 120 206 C 130 218, 145 220, 155 214 C 148 206, 134 204, 120 206 Z"
              fill="#68745C"
              fillOpacity="0.85"
            />

            {/* Olive fruit 1 */}
            <ellipse cx="140" cy="216" rx="3.5" ry="5" transform="rotate(25 140 216)" fill="#3A4233" />
            <circle cx="139" cy="214" r="0.9" fill="#8F9A83" fillOpacity="0.8" />

            {/* Olive Leaf 3 */}
            <path
              className="reception-leaf"
              data-part="leaf"
              d="M 195 198 C 210 188, 225 188, 235 195 C 224 202, 210 204, 195 198 Z"
              fill="#505B46"
              fillOpacity="0.9"
            />
            <path d="M 195 198 Q 215 192 235 195" fill="none" stroke="#8F9A83" strokeWidth="0.6" />
          </g>

          {/* Delicate Ivory Floral Blossom 1 (X=210, Y=208) */}
          <g>
            <circle cx="210" cy="208" r="5" fill="#FAF7F0" stroke="#EDE5D8" strokeWidth="0.6" />
            <circle cx="207" cy="206" r="3" fill="#FAF8F2" fillOpacity="0.8" />
            <circle cx="212" cy="207" r="3" fill="#FAF8F2" fillOpacity="0.8" />
            <circle cx="210" cy="208" r="1.5" fill="#C9B580" fillOpacity="0.9" />
          </g>

          {/* --- LEAF CLUSTERS: SECTION 2 (X: 250 - 480) --- */}
          <g>
            {/* Eucalyptus Leaf 2 */}
            <ellipse
              className="reception-leaf"
              data-part="leaf"
              cx="295"
              cy="204"
              rx="10"
              ry="7.5"
              transform="rotate(20 295 204)"
              fill="#A7B09A"
              fillOpacity="0.85"
              stroke="#8F9A83"
              strokeWidth="0.6"
            />

            {/* Olive Leaf 4 */}
            <path
              className="reception-leaf"
              data-part="leaf"
              d="M 320 202 C 332 190, 348 188, 358 194 C 350 202, 335 206, 320 202 Z"
              fill="#505B46"
              fillOpacity="0.9"
            />
            <path d="M 320 202 Q 340 193 358 194" fill="none" stroke="#8F9A83" strokeWidth="0.6" />

            {/* Olive Leaf 5 */}
            <path
              className="reception-leaf"
              data-part="leaf"
              d="M 410 205 C 420 216, 435 218, 446 212 C 438 204, 424 202, 410 205 Z"
              fill="#68745C"
              fillOpacity="0.85"
            />

            {/* Eucalyptus Leaf 3 */}
            <ellipse
              className="reception-leaf"
              data-part="leaf"
              cx="455"
              cy="198"
              rx="9"
              ry="7"
              transform="rotate(-10 455 198)"
              fill="#A7B09A"
              fillOpacity="0.85"
              stroke="#8F9A83"
              strokeWidth="0.6"
            />
          </g>

          {/* Delicate Ivory Floral Blossom 2 (X=430, Y=205) */}
          <g>
            <circle cx="430" cy="205" r="5.5" fill="#FAF7F0" stroke="#EDE5D8" strokeWidth="0.6" />
            <circle cx="427" cy="203" r="3.2" fill="#FAF8F2" fillOpacity="0.8" />
            <circle cx="432" cy="204" r="3.2" fill="#FAF8F2" fillOpacity="0.8" />
            <circle cx="430" cy="205" r="1.6" fill="#C9B580" fillOpacity="0.9" />
          </g>

          {/* --- LEAF CLUSTERS: SECTION 3 (X: 500 - 720) --- */}
          <g>
            {/* Olive Leaf 6 */}
            <path
              className="reception-leaf"
              data-part="leaf"
              d="M 520 200 C 535 188, 550 188, 560 196 C 548 204, 534 205, 520 200 Z"
              fill="#505B46"
              fillOpacity="0.9"
            />
            <path d="M 520 200 Q 540 192 560 196" fill="none" stroke="#8F9A83" strokeWidth="0.6" />

            {/* Olive fruit 2 */}
            <ellipse cx="570" cy="208" rx="3.5" ry="5" transform="rotate(-20 570 208)" fill="#3A4233" />
            <circle cx="571" cy="206" r="0.9" fill="#8F9A83" fillOpacity="0.8" />

            {/* Eucalyptus Leaf 4 */}
            <ellipse
              className="reception-leaf"
              data-part="leaf"
              cx="640"
              cy="204"
              rx="10"
              ry="7.5"
              transform="rotate(15 640 204)"
              fill="#A7B09A"
              fillOpacity="0.85"
              stroke="#8F9A83"
              strokeWidth="0.6"
            />

            {/* Olive Leaf 7 */}
            <path
              className="reception-leaf"
              data-part="leaf"
              d="M 660 198 C 672 186, 688 186, 698 194 C 688 202, 674 204, 660 198 Z"
              fill="#68745C"
              fillOpacity="0.85"
            />
          </g>

          {/* Delicate Ivory Floral Blossom 3 (X=650, Y=208) */}
          <g>
            <circle cx="650" cy="208" r="5" fill="#FAF7F0" stroke="#EDE5D8" strokeWidth="0.6" />
            <circle cx="647" cy="206" r="3" fill="#FAF8F2" fillOpacity="0.8" />
            <circle cx="652" cy="207" r="3" fill="#FAF8F2" fillOpacity="0.8" />
            <circle cx="650" cy="208" r="1.5" fill="#C9B580" fillOpacity="0.9" />
          </g>

          {/* --- LEAF CLUSTERS: SECTION 4 (X: 740 - 960) --- */}
          <g>
            {/* Olive Leaf 8 */}
            <path
              className="reception-leaf"
              data-part="leaf"
              d="M 750 202 C 762 214, 778 216, 788 208 C 780 200, 765 198, 750 202 Z"
              fill="#505B46"
              fillOpacity="0.9"
            />

            {/* Eucalyptus Leaf 5 */}
            <ellipse
              className="reception-leaf"
              data-part="leaf"
              cx="865"
              cy="200"
              rx="9"
              ry="7"
              transform="rotate(-20 865 200)"
              fill="#A7B09A"
              fillOpacity="0.85"
              stroke="#8F9A83"
              strokeWidth="0.6"
            />

            {/* Olive Leaf 9 */}
            <path
              className="reception-leaf"
              data-part="leaf"
              d="M 885 204 C 898 192, 914 190, 924 196 C 916 204, 900 208, 885 204 Z"
              fill="#68745C"
              fillOpacity="0.85"
            />
            <path d="M 885 204 Q 905 195 924 196" fill="none" stroke="#8F9A83" strokeWidth="0.6" />
          </g>

          {/* Delicate Ivory Floral Blossom 4 (X=870, Y=208) */}
          <g>
            <circle cx="870" cy="208" r="5" fill="#FAF7F0" stroke="#EDE5D8" strokeWidth="0.6" />
            <circle cx="867" cy="206" r="3" fill="#FAF8F2" fillOpacity="0.8" />
            <circle cx="872" cy="207" r="3" fill="#FAF8F2" fillOpacity="0.8" />
            <circle cx="870" cy="208" r="1.5" fill="#C9B580" fillOpacity="0.9" />
          </g>

          {/* --- LEAF CLUSTERS: SECTION 5 (X: 980 - 1200) --- */}
          <g>
            {/* Olive Leaf 10 */}
            <path
              className="reception-leaf"
              data-part="leaf"
              d="M 980 202 C 994 190, 1010 190, 1020 198 C 1010 206, 995 208, 980 202 Z"
              fill="#505B46"
              fillOpacity="0.9"
            />

            {/* Olive fruit 3 */}
            <ellipse cx="1070" cy="215" rx="3.5" ry="5" transform="rotate(15 1070 215)" fill="#3A4233" />
            <circle cx="1069" cy="213" r="0.9" fill="#8F9A83" fillOpacity="0.8" />

            {/* Eucalyptus Leaf 6 */}
            <ellipse
              className="reception-leaf"
              data-part="leaf"
              cx="1090"
              cy="202"
              rx="10"
              ry="7.5"
              transform="rotate(15 1090 202)"
              fill="#A7B09A"
              fillOpacity="0.85"
              stroke="#8F9A83"
              strokeWidth="0.6"
            />

            {/* Olive Leaf 11 */}
            <path
              className="reception-leaf"
              data-part="leaf"
              d="M 1150 202 C 1162 192, 1178 192, 1188 200 C 1178 208, 1164 208, 1150 202 Z"
              fill="#68745C"
              fillOpacity="0.85"
            />
          </g>
        </g>
      </svg>
    </div>
  );
};
