import React from 'react';

export interface ChandelierProps {
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
 * Chandelier component renders a bespoke, artisanal antique gold SVG chandelier.
 *
 * Features:
 * - Antique gold palette tones (#A3894F, #C9B580, #7D6633) with layered opacities
 * - Gracefully sweeping candelabra arms with scrolled acanthus flourishes
 * - Slender ivory candle tapers with warm glowing flames
 * - Faceted crystal bead swags and pendeloque teardrop crystals
 * - Non-blocking interaction (pointer-events: none) and aria-hidden="true" for screen reader hygiene
 * - Respects prefers-reduced-motion for accessible animations
 */
export const Chandelier: React.FC<ChandelierProps> = ({
  isVisible = true,
  className = '',
}) => {
  const reducedMotion = usePrefersReducedMotion();

  const style: React.CSSProperties = {
    pointerEvents: 'none',
    position: 'absolute',
    top: 0,
    left: '50%',
    transform: reducedMotion
      ? 'translateX(-50%)'
      : isVisible
      ? 'translateX(-50%) translateY(0)'
      : 'translateX(-50%) translateY(-20px)',
    opacity: isVisible ? 1 : 0,
    transition: reducedMotion
      ? 'none'
      : 'opacity 800ms cubic-bezier(0.22, 1, 0.36, 1), transform 800ms cubic-bezier(0.22, 1, 0.36, 1)',
    zIndex: 'var(--z-illustration, 1)',
  };

  return (
    <div
      className={`chandelier-container pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 overflow-visible select-none ${
        !isVisible ? 'opacity-0' : 'opacity-100'
      } ${className}`}
      aria-hidden="true"
      style={style}
    >
      <svg
        className="chandelier-svg w-[320px] sm:w-[420px] md:w-[480px] h-auto overflow-visible pointer-events-none"
        viewBox="0 0 460 380"
        preserveAspectRatio="xMidYMin meet"
        aria-hidden="true"
      >
        <defs>
          {/* Flame radiant glow filter */}
          <filter id="chandelier-glow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>

          {/* Candle flame radial gradients */}
          <radialGradient id="flame-gradient" cx="50%" cy="65%" r="65%">
            <stop offset="0%" stopColor="#FFFDF7" stopOpacity="1" />
            <stop offset="35%" stopColor="#FDE68A" stopOpacity="0.95" />
            <stop offset="75%" stopColor="#F59E0B" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#D97706" stopOpacity="0" />
          </radialGradient>

          <radialGradient id="flame-halo" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FEF3C7" stopOpacity="0.6" />
            <stop offset="50%" stopColor="#FDE68A" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#FDE68A" stopOpacity="0" />
          </radialGradient>

          {/* Crystal facet highlights */}
          <linearGradient id="crystal-sheen" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.8" />
            <stop offset="45%" stopColor="#FAF8F2" stopOpacity="0.6" />
            <stop offset="70%" stopColor="#C9B580" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#A3894F" stopOpacity="0.2" />
          </linearGradient>

          {/* Antique gold gradient */}
          <linearGradient id="gold-metallic" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#7D6633" />
            <stop offset="40%" stopColor="#C9B580" />
            <stop offset="70%" stopColor="#A3894F" />
            <stop offset="100%" stopColor="#7D6633" />
          </linearGradient>
        </defs>

        {/* ============================================================== */}
        {/* CEILING CANOPY & HANGING CHAIN                                 */}
        {/* ============================================================== */}
        <g id="chandelier-mount" className="chandelier-chain" data-part="chain">
          {/* Ceiling rosette mount plate */}
          <ellipse cx="230" cy="8" rx="36" ry="6" fill="#7D6633" stroke="#A3894F" strokeWidth="1" />
          <ellipse cx="230" cy="11" rx="28" ry="5" fill="#A3894F" stroke="#C9B580" strokeWidth="0.8" />
          <path d="M 205 10 Q 230 18 255 10" fill="none" stroke="#C9B580" strokeWidth="1" strokeOpacity="0.8" />
          <ellipse cx="230" cy="14" rx="14" ry="4" fill="#C9B580" />

          {/* Ornamental chain links */}
          <ellipse cx="230" cy="22" rx="4" ry="7" fill="none" stroke="#A3894F" strokeWidth="1.8" />
          <line x1="230" y1="20" x2="230" y2="24" stroke="#C9B580" strokeWidth="1.2" />
          <ellipse cx="230" cy="33" rx="4" ry="7" fill="none" stroke="#C9B580" strokeWidth="1.8" />
          <ellipse cx="230" cy="44" rx="4" ry="7" fill="none" stroke="#A3894F" strokeWidth="1.8" />
          <ellipse cx="230" cy="55" rx="4" ry="7" fill="none" stroke="#C9B580" strokeWidth="1.8" />
          <ellipse cx="230" cy="66" rx="4" ry="7" fill="none" stroke="#A3894F" strokeWidth="1.8" />
        </g>

        {/* ============================================================== */}
        {/* CENTRAL BALUSTER STEM & TIER FINIALS                          */}
        {/* ============================================================== */}
        <g id="chandelier-stem">
          {/* Top suspension ring */}
          <circle cx="230" cy="76" r="6" fill="none" stroke="#C9B580" strokeWidth="2.2" />
          <circle cx="230" cy="76" r="3" fill="#7D6633" />

          {/* Upper spindle turned vase finial */}
          <path
            d="M 226 82 L 234 82 L 235 94 L 225 94 Z"
            fill="#A3894F"
            stroke="#7D6633"
            strokeWidth="0.8"
          />
          {/* Baluster bulb upper collar */}
          <ellipse cx="230" cy="98" rx="12" ry="4" fill="#C9B580" stroke="#7D6633" strokeWidth="0.8" />
          {/* Slender neck */}
          <path
            d="M 224 102 C 220 120, 218 135, 214 148 L 246 148 C 242 135, 240 120, 236 102 Z"
            fill="url(#gold-metallic)"
            stroke="#7D6633"
            strokeWidth="0.8"
          />
          {/* Middle carved ring */}
          <ellipse cx="230" cy="148" rx="20" ry="5" fill="#A3894F" stroke="#C9B580" strokeWidth="1.2" />
          <ellipse cx="230" cy="148" rx="16" ry="3" fill="#C9B580" fillOpacity="0.7" />

          {/* Main urn baluster body */}
          <path
            d="M 216 153 C 210 170, 204 185, 212 205 C 218 218, 224 225, 230 228 C 236 225, 242 218, 248 205 C 256 185, 250 170, 244 153 Z"
            fill="url(#gold-metallic)"
            stroke="#7D6633"
            strokeWidth="1"
          />
          {/* Baluster body fluting highlights */}
          <path
            d="M 225 158 C 220 175, 218 190, 226 215"
            fill="none"
            stroke="#C9B580"
            strokeWidth="1.2"
            strokeOpacity="0.8"
          />
          <path
            d="M 235 158 C 240 175, 242 190, 234 215"
            fill="none"
            stroke="#7D6633"
            strokeWidth="1"
            strokeOpacity="0.9"
          />

          {/* Lower arm mounting boss */}
          <ellipse cx="230" cy="230" rx="26" ry="7" fill="#A3894F" stroke="#7D6633" strokeWidth="1.2" />
          <ellipse cx="230" cy="230" rx="22" ry="5" fill="#C9B580" fillOpacity="0.5" />
          <ellipse cx="230" cy="234" rx="18" ry="4" fill="#7D6633" stroke="#A3894F" strokeWidth="0.8" />

          {/* Bottom finial pendant cone */}
          <path
            d="M 222 238 C 224 250, 226 262, 230 272 C 234 262, 236 250, 238 238 Z"
            fill="url(#gold-metallic)"
            stroke="#7D6633"
            strokeWidth="0.8"
          />
          <circle cx="230" cy="275" r="3.5" fill="#C9B580" stroke="#7D6633" strokeWidth="0.8" />
        </g>

        {/* ============================================================== */}
        {/* UPPER TIER DECORATIVE SCROLLS & FLOURISHES                     */}
        {/* ============================================================== */}
        <g id="chandelier-upper-scrolls">
          {/* Upper left scroll */}
          <path
            className="chandelier-arm"
            data-part="arm"
            d="M 220 128 C 195 110, 165 125, 150 148 C 142 160, 144 175, 156 182 C 168 188, 180 180, 182 170 C 184 158, 174 150, 164 152"
            fill="none"
            stroke="#A3894F"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <path
            d="M 218 130 C 196 114, 170 128, 156 148"
            fill="none"
            stroke="#C9B580"
            strokeWidth="1"
            strokeOpacity="0.8"
          />

          {/* Upper right scroll */}
          <path
            className="chandelier-arm"
            data-part="arm"
            d="M 240 128 C 265 110, 295 125, 310 148 C 318 160, 316 175, 304 182 C 292 188, 280 180, 278 170 C 276 158, 286 150, 296 152"
            fill="none"
            stroke="#A3894F"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <path
            d="M 242 130 C 264 114, 290 128, 304 148"
            fill="none"
            stroke="#C9B580"
            strokeWidth="1"
            strokeOpacity="0.8"
          />
        </g>

        {/* ============================================================== */}
        {/* MAIN TIER CANDELABRA SWEEPING ARMS                             */}
        {/* ============================================================== */}
        <g id="chandelier-main-arms">
          {/* --- Outer Left Arm (Position: X=65, Y=175) --- */}
          <path
            className="chandelier-arm"
            data-part="arm"
            d="M 212 228 C 165 240, 105 275, 68 250 C 42 232, 45 198, 65 178"
            fill="none"
            stroke="#A3894F"
            strokeWidth="2.8"
            strokeLinecap="round"
          />
          {/* Highlight line */}
          <path
            d="M 208 226 C 166 237, 108 271, 72 248 C 48 231, 51 202, 65 180"
            fill="none"
            stroke="#C9B580"
            strokeWidth="1.2"
            strokeOpacity="0.85"
          />
          {/* Lower acanthus scroll finial */}
          <path
            d="M 72 248 C 65 264, 80 278, 96 270 C 104 265, 106 254, 98 248 C 92 242, 82 246, 82 254"
            fill="none"
            stroke="#7D6633"
            strokeWidth="1.8"
            strokeLinecap="round"
          />

          {/* --- Mid Left Arm (Position: X=130, Y=205) --- */}
          <path
            className="chandelier-arm"
            data-part="arm"
            d="M 216 232 C 185 252, 145 272, 120 252 C 108 240, 112 222, 130 208"
            fill="none"
            stroke="#A3894F"
            strokeWidth="2.6"
            strokeLinecap="round"
          />
          <path
            d="M 214 230 C 185 249, 147 268, 123 250 C 113 240, 116 225, 130 210"
            fill="none"
            stroke="#C9B580"
            strokeWidth="1"
            strokeOpacity="0.85"
          />

          {/* --- Inner Left Arm (Position: X=185, Y=225) --- */}
          <path
            className="chandelier-arm"
            data-part="arm"
            d="M 220 234 C 205 250, 182 260, 172 248 C 166 240, 172 232, 185 226"
            fill="none"
            stroke="#A3894F"
            strokeWidth="2.4"
            strokeLinecap="round"
          />

          {/* --- Inner Right Arm (Position: X=275, Y=225) --- */}
          <path
            className="chandelier-arm"
            data-part="arm"
            d="M 240 234 C 255 250, 278 260, 288 248 C 294 240, 288 232, 275 226"
            fill="none"
            stroke="#A3894F"
            strokeWidth="2.4"
            strokeLinecap="round"
          />

          {/* --- Mid Right Arm (Position: X=330, Y=205) --- */}
          <path
            className="chandelier-arm"
            data-part="arm"
            d="M 244 232 C 275 252, 315 272, 340 252 C 352 240, 348 222, 330 208"
            fill="none"
            stroke="#A3894F"
            strokeWidth="2.6"
            strokeLinecap="round"
          />
          <path
            d="M 246 230 C 275 249, 313 268, 337 250 C 347 240, 344 225, 330 210"
            fill="none"
            stroke="#C9B580"
            strokeWidth="1"
            strokeOpacity="0.85"
          />

          {/* --- Outer Right Arm (Position: X=395, Y=175) --- */}
          <path
            className="chandelier-arm"
            data-part="arm"
            d="M 248 228 C 295 240, 355 275, 392 250 C 418 232, 415 198, 395 178"
            fill="none"
            stroke="#A3894F"
            strokeWidth="2.8"
            strokeLinecap="round"
          />
          {/* Highlight line */}
          <path
            d="M 252 226 C 294 237, 352 271, 388 248 C 412 231, 409 202, 395 180"
            fill="none"
            stroke="#C9B580"
            strokeWidth="1.2"
            strokeOpacity="0.85"
          />
          {/* Lower acanthus scroll finial */}
          <path
            d="M 388 248 C 395 264, 380 278, 364 270 C 356 265, 354 254, 362 248 C 368 242, 378 246, 378 254"
            fill="none"
            stroke="#7D6633"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </g>

        {/* ============================================================== */}
        {/* CATENARY CRYSTAL GARLAND SWAGS                                 */}
        {/* ============================================================== */}
        <g id="chandelier-crystal-swags">
          {/* Upper swag left: from upper scroll (150, 160) to outer arm (65, 185) */}
          <path
            d="M 152 165 Q 105 195 68 185"
            fill="none"
            stroke="#C9B580"
            strokeWidth="1"
            strokeDasharray="1.5 5"
            strokeOpacity="0.75"
          />
          {/* Upper swag center: between upper scrolls */}
          <path
            d="M 158 155 Q 230 190 302 155"
            fill="none"
            stroke="#C9B580"
            strokeWidth="1"
            strokeDasharray="1.5 5.5"
            strokeOpacity="0.7"
          />
          {/* Upper swag right: from upper scroll (310, 160) to outer arm (395, 185) */}
          <path
            d="M 308 165 Q 355 195 392 185"
            fill="none"
            stroke="#C9B580"
            strokeWidth="1"
            strokeDasharray="1.5 5"
            strokeOpacity="0.75"
          />

          {/* Lower main tier draping crystal swags */}
          <path
            d="M 65 185 Q 98 220 130 212"
            fill="none"
            stroke="#EDE5D8"
            strokeWidth="1.2"
            strokeDasharray="2 5"
            strokeOpacity="0.85"
          />
          <path
            d="M 130 212 Q 158 235 185 230"
            fill="none"
            stroke="#EDE5D8"
            strokeWidth="1.2"
            strokeDasharray="2 5"
            strokeOpacity="0.85"
          />
          <path
            d="M 185 230 Q 230 252 275 230"
            fill="none"
            stroke="#EDE5D8"
            strokeWidth="1.2"
            strokeDasharray="2 5"
            strokeOpacity="0.85"
          />
          <path
            d="M 275 230 Q 302 235 330 212"
            fill="none"
            stroke="#EDE5D8"
            strokeWidth="1.2"
            strokeDasharray="2 5"
            strokeOpacity="0.85"
          />
          <path
            d="M 330 212 Q 362 220 395 185"
            fill="none"
            stroke="#EDE5D8"
            strokeWidth="1.2"
            strokeDasharray="2 5"
            strokeOpacity="0.85"
          />

          {/* Additional crystal beads along the curves */}
          <circle cx="100" cy="208" r="2.2" fill="#FAF8F2" stroke="#A3894F" strokeWidth="0.6" />
          <circle cx="158" cy="227" r="2.2" fill="#FAF8F2" stroke="#A3894F" strokeWidth="0.6" />
          <circle cx="230" cy="246" r="2.5" fill="#FAF8F2" stroke="#A3894F" strokeWidth="0.6" />
          <circle cx="302" cy="227" r="2.2" fill="#FAF8F2" stroke="#A3894F" strokeWidth="0.6" />
          <circle cx="360" cy="208" r="2.2" fill="#FAF8F2" stroke="#A3894F" strokeWidth="0.6" />
        </g>

        {/* ============================================================== */}
        {/* CANDELABRA BOBECHES, CANDLES, AND FLAMES                       */}
        {/* ============================================================== */}

        {/* CANDLE 1: Outer Left (X=65, Y=178) */}
        <g id="candle-1">
          {/* Bobeche (wax saucer) */}
          <g className="chandelier-bobeche" data-part="bobeche">
            <ellipse cx="65" cy="178" rx="14" ry="4" fill="#A3894F" stroke="#7D6633" strokeWidth="0.8" />
            <ellipse cx="65" cy="177" rx="11" ry="3" fill="#C9B580" fillOpacity="0.7" />
            <path d="M 54 178 Q 65 185 76 178" fill="none" stroke="#7D6633" strokeWidth="0.8" />
          </g>
          {/* Candle Taper */}
          <g className="chandelier-candle" data-part="candle">
            <rect x="62.5" y="148" width="5" height="29" rx="1.5" fill="#FAF8F2" stroke="#EDE5D8" strokeWidth="0.6" />
            {/* Candle wax highlight */}
            <line x1="64" y1="150" x2="64" y2="175" stroke="#FFFFFF" strokeWidth="0.8" strokeOpacity="0.8" />
            {/* Candle wick */}
            <line x1="65" y1="148" x2="65" y2="144" stroke="#7D6633" strokeWidth="1" strokeLinecap="round" />
          </g>
          {/* Flame & Halo */}
          <g className="chandelier-flame" data-part="flame">
            <ellipse cx="65" cy="138" rx="10" ry="14" fill="url(#flame-halo)" />
            <path
              d="M 65 130 C 68 135, 69 140, 67.5 144 C 66 145.5, 64 145.5, 62.5 144 C 61 140, 62 135, 65 130 Z"
              fill="url(#flame-gradient)"
              filter="url(#chandelier-glow)"
            />
            <ellipse cx="65" cy="142" rx="1.5" ry="3" fill="#FFFDF7" fillOpacity="0.95" />
          </g>
        </g>

        {/* CANDLE 2: Mid Left (X=130, Y=208) */}
        <g id="candle-2">
          <g className="chandelier-bobeche" data-part="bobeche">
            <ellipse cx="130" cy="208" rx="13" ry="3.8" fill="#A3894F" stroke="#7D6633" strokeWidth="0.8" />
            <ellipse cx="130" cy="207" rx="10" ry="2.8" fill="#C9B580" fillOpacity="0.7" />
            <path d="M 120 208 Q 130 214 140 208" fill="none" stroke="#7D6633" strokeWidth="0.8" />
          </g>
          <g className="chandelier-candle" data-part="candle">
            <rect x="127.5" y="178" width="5" height="29" rx="1.5" fill="#FAF8F2" stroke="#EDE5D8" strokeWidth="0.6" />
            <line x1="129" y1="180" x2="129" y2="205" stroke="#FFFFFF" strokeWidth="0.8" strokeOpacity="0.8" />
            <line x1="130" y1="178" x2="130" y2="174" stroke="#7D6633" strokeWidth="1" strokeLinecap="round" />
          </g>
          <g className="chandelier-flame" data-part="flame">
            <ellipse cx="130" cy="168" rx="10" ry="14" fill="url(#flame-halo)" />
            <path
              d="M 130 160 C 133 165, 134 170, 132.5 174 C 131 175.5, 129 175.5, 127.5 174 C 126 170, 127 165, 130 160 Z"
              fill="url(#flame-gradient)"
              filter="url(#chandelier-glow)"
            />
            <ellipse cx="130" cy="172" rx="1.5" ry="3" fill="#FFFDF7" fillOpacity="0.95" />
          </g>
        </g>

        {/* CANDLE 3: Inner Left (X=185, Y=226) */}
        <g id="candle-3">
          <g className="chandelier-bobeche" data-part="bobeche">
            <ellipse cx="185" cy="226" rx="12" ry="3.5" fill="#A3894F" stroke="#7D6633" strokeWidth="0.8" />
            <ellipse cx="185" cy="225" rx="9" ry="2.5" fill="#C9B580" fillOpacity="0.7" />
            <path d="M 176 226 Q 185 232 194 226" fill="none" stroke="#7D6633" strokeWidth="0.8" />
          </g>
          <g className="chandelier-candle" data-part="candle">
            <rect x="182.5" y="196" width="5" height="29" rx="1.5" fill="#FAF8F2" stroke="#EDE5D8" strokeWidth="0.6" />
            <line x1="184" y1="198" x2="184" y2="223" stroke="#FFFFFF" strokeWidth="0.8" strokeOpacity="0.8" />
            <line x1="185" y1="196" x2="185" y2="192" stroke="#7D6633" strokeWidth="1" strokeLinecap="round" />
          </g>
          <g className="chandelier-flame" data-part="flame">
            <ellipse cx="185" cy="186" rx="9" ry="13" fill="url(#flame-halo)" />
            <path
              d="M 185 178 C 188 183, 189 188, 187.5 192 C 186 193.5, 184 193.5, 182.5 192 C 181 188, 182 183, 185 178 Z"
              fill="url(#flame-gradient)"
              filter="url(#chandelier-glow)"
            />
            <ellipse cx="185" cy="190" rx="1.4" ry="2.8" fill="#FFFDF7" fillOpacity="0.95" />
          </g>
        </g>

        {/* CANDLE 4: Inner Right (X=275, Y=226) */}
        <g id="candle-4">
          <g className="chandelier-bobeche" data-part="bobeche">
            <ellipse cx="275" cy="226" rx="12" ry="3.5" fill="#A3894F" stroke="#7D6633" strokeWidth="0.8" />
            <ellipse cx="275" cy="225" rx="9" ry="2.5" fill="#C9B580" fillOpacity="0.7" />
            <path d="M 266 226 Q 275 232 284 226" fill="none" stroke="#7D6633" strokeWidth="0.8" />
          </g>
          <g className="chandelier-candle" data-part="candle">
            <rect x="272.5" y="196" width="5" height="29" rx="1.5" fill="#FAF8F2" stroke="#EDE5D8" strokeWidth="0.6" />
            <line x1="274" y1="198" x2="274" y2="223" stroke="#FFFFFF" strokeWidth="0.8" strokeOpacity="0.8" />
            <line x1="275" y1="196" x2="275" y2="192" stroke="#7D6633" strokeWidth="1" strokeLinecap="round" />
          </g>
          <g className="chandelier-flame" data-part="flame">
            <ellipse cx="275" cy="186" rx="9" ry="13" fill="url(#flame-halo)" />
            <path
              d="M 275 178 C 278 183, 279 188, 277.5 192 C 276 193.5, 274 193.5, 272.5 192 C 271 188, 272 183, 275 178 Z"
              fill="url(#flame-gradient)"
              filter="url(#chandelier-glow)"
            />
            <ellipse cx="275" cy="190" rx="1.4" ry="2.8" fill="#FFFDF7" fillOpacity="0.95" />
          </g>
        </g>

        {/* CANDLE 5: Mid Right (X=330, Y=208) */}
        <g id="candle-5">
          <g className="chandelier-bobeche" data-part="bobeche">
            <ellipse cx="330" cy="208" rx="13" ry="3.8" fill="#A3894F" stroke="#7D6633" strokeWidth="0.8" />
            <ellipse cx="330" cy="207" rx="10" ry="2.8" fill="#C9B580" fillOpacity="0.7" />
            <path d="M 320 208 Q 330 214 340 208" fill="none" stroke="#7D6633" strokeWidth="0.8" />
          </g>
          <g className="chandelier-candle" data-part="candle">
            <rect x="327.5" y="178" width="5" height="29" rx="1.5" fill="#FAF8F2" stroke="#EDE5D8" strokeWidth="0.6" />
            <line x1="329" y1="180" x2="329" y2="205" stroke="#FFFFFF" strokeWidth="0.8" strokeOpacity="0.8" />
            <line x1="330" y1="178" x2="330" y2="174" stroke="#7D6633" strokeWidth="1" strokeLinecap="round" />
          </g>
          <g className="chandelier-flame" data-part="flame">
            <ellipse cx="330" cy="168" rx="10" ry="14" fill="url(#flame-halo)" />
            <path
              d="M 330 160 C 333 165, 334 170, 332.5 174 C 331 175.5, 329 175.5, 327.5 174 C 326 170, 327 165, 330 160 Z"
              fill="url(#flame-gradient)"
              filter="url(#chandelier-glow)"
            />
            <ellipse cx="330" cy="172" rx="1.5" ry="3" fill="#FFFDF7" fillOpacity="0.95" />
          </g>
        </g>

        {/* CANDLE 6: Outer Right (X=395, Y=178) */}
        <g id="candle-6">
          <g className="chandelier-bobeche" data-part="bobeche">
            <ellipse cx="395" cy="178" rx="14" ry="4" fill="#A3894F" stroke="#7D6633" strokeWidth="0.8" />
            <ellipse cx="395" cy="177" rx="11" ry="3" fill="#C9B580" fillOpacity="0.7" />
            <path d="M 384 178 Q 395 185 406 178" fill="none" stroke="#7D6633" strokeWidth="0.8" />
          </g>
          <g className="chandelier-candle" data-part="candle">
            <rect x="392.5" y="148" width="5" height="29" rx="1.5" fill="#FAF8F2" stroke="#EDE5D8" strokeWidth="0.6" />
            <line x1="394" y1="150" x2="394" y2="175" stroke="#FFFFFF" strokeWidth="0.8" strokeOpacity="0.8" />
            <line x1="395" y1="148" x2="395" y2="144" stroke="#7D6633" strokeWidth="1" strokeLinecap="round" />
          </g>
          <g className="chandelier-flame" data-part="flame">
            <ellipse cx="395" cy="138" rx="10" ry="14" fill="url(#flame-halo)" />
            <path
              d="M 395 130 C 398 135, 399 140, 397.5 144 C 396 145.5, 394 145.5, 392.5 144 C 391 140, 392 135, 395 130 Z"
              fill="url(#flame-gradient)"
              filter="url(#chandelier-glow)"
            />
            <ellipse cx="395" cy="142" rx="1.5" ry="3" fill="#FFFDF7" fillOpacity="0.95" />
          </g>
        </g>

        {/* ============================================================== */}
        {/* FACETED CRYSTAL PENDELOQUE DROPS                               */}
        {/* ============================================================== */}
        <g id="chandelier-crystals">
          {/* Crystal Drop 1: Under Candle 1 (65, 182) */}
          <g className="chandelier-crystal" data-part="crystal">
            <line x1="65" y1="182" x2="65" y2="187" stroke="#A3894F" strokeWidth="0.9" />
            <circle cx="65" cy="189" r="2" fill="#C9B580" />
            {/* Faceted pendeloque teardrop */}
            <polygon
              points="65,192 61,202 65,214 69,202"
              fill="url(#crystal-sheen)"
              stroke="#A3894F"
              strokeWidth="0.7"
              strokeOpacity="0.9"
            />
            <line x1="65" y1="192" x2="65" y2="214" stroke="#FFFFFF" strokeWidth="0.6" strokeOpacity="0.9" />
            <line x1="61" y1="202" x2="69" y2="202" stroke="#EDE5D8" strokeWidth="0.5" strokeOpacity="0.8" />
          </g>

          {/* Crystal Drop 2: Under Candle 2 (130, 212) */}
          <g className="chandelier-crystal" data-part="crystal">
            <line x1="130" y1="212" x2="130" y2="217" stroke="#A3894F" strokeWidth="0.9" />
            <circle cx="130" cy="219" r="2" fill="#C9B580" />
            <polygon
              points="130,222 126,232 130,244 134,232"
              fill="url(#crystal-sheen)"
              stroke="#A3894F"
              strokeWidth="0.7"
              strokeOpacity="0.9"
            />
            <line x1="130" y1="222" x2="130" y2="244" stroke="#FFFFFF" strokeWidth="0.6" strokeOpacity="0.9" />
            <line x1="126" y1="232" x2="134" y2="232" stroke="#EDE5D8" strokeWidth="0.5" strokeOpacity="0.8" />
          </g>

          {/* Crystal Drop 3: Under Candle 3 (185, 230) */}
          <g className="chandelier-crystal" data-part="crystal">
            <line x1="185" y1="230" x2="185" y2="235" stroke="#A3894F" strokeWidth="0.9" />
            <circle cx="185" cy="237" r="2" fill="#C9B580" />
            <polygon
              points="185,240 181,249 185,260 189,249"
              fill="url(#crystal-sheen)"
              stroke="#A3894F"
              strokeWidth="0.7"
              strokeOpacity="0.9"
            />
            <line x1="185" y1="240" x2="185" y2="260" stroke="#FFFFFF" strokeWidth="0.6" strokeOpacity="0.9" />
            <line x1="181" y1="249" x2="189" y2="249" stroke="#EDE5D8" strokeWidth="0.5" strokeOpacity="0.8" />
          </g>

          {/* Crystal Drop 4: Under Candle 4 (275, 230) */}
          <g className="chandelier-crystal" data-part="crystal">
            <line x1="275" y1="230" x2="275" y2="235" stroke="#A3894F" strokeWidth="0.9" />
            <circle cx="275" cy="237" r="2" fill="#C9B580" />
            <polygon
              points="275,240 271,249 275,260 279,249"
              fill="url(#crystal-sheen)"
              stroke="#A3894F"
              strokeWidth="0.7"
              strokeOpacity="0.9"
            />
            <line x1="275" y1="240" x2="275" y2="260" stroke="#FFFFFF" strokeWidth="0.6" strokeOpacity="0.9" />
            <line x1="271" y1="249" x2="279" y2="249" stroke="#EDE5D8" strokeWidth="0.5" strokeOpacity="0.8" />
          </g>

          {/* Crystal Drop 5: Under Candle 5 (330, 212) */}
          <g className="chandelier-crystal" data-part="crystal">
            <line x1="330" y1="212" x2="330" y2="217" stroke="#A3894F" strokeWidth="0.9" />
            <circle cx="330" cy="219" r="2" fill="#C9B580" />
            <polygon
              points="330,222 326,232 330,244 334,232"
              fill="url(#crystal-sheen)"
              stroke="#A3894F"
              strokeWidth="0.7"
              strokeOpacity="0.9"
            />
            <line x1="330" y1="222" x2="330" y2="244" stroke="#FFFFFF" strokeWidth="0.6" strokeOpacity="0.9" />
            <line x1="326" y1="232" x2="334" y2="232" stroke="#EDE5D8" strokeWidth="0.5" strokeOpacity="0.8" />
          </g>

          {/* Crystal Drop 6: Under Candle 6 (395, 182) */}
          <g className="chandelier-crystal" data-part="crystal">
            <line x1="395" y1="182" x2="395" y2="187" stroke="#A3894F" strokeWidth="0.9" />
            <circle cx="395" cy="189" r="2" fill="#C9B580" />
            <polygon
              points="395,192 391,202 395,214 399,202"
              fill="url(#crystal-sheen)"
              stroke="#A3894F"
              strokeWidth="0.7"
              strokeOpacity="0.9"
            />
            <line x1="395" y1="192" x2="395" y2="214" stroke="#FFFFFF" strokeWidth="0.6" strokeOpacity="0.9" />
            <line x1="391" y1="202" x2="399" y2="202" stroke="#EDE5D8" strokeWidth="0.5" strokeOpacity="0.8" />
          </g>

          {/* Central Grand Pendeloque (Center bottom 230, 278) */}
          <g className="chandelier-crystal" data-part="crystal">
            <line x1="230" y1="278" x2="230" y2="284" stroke="#A3894F" strokeWidth="1" />
            <polygon
              points="230,285 233,288 230,291 227,288"
              fill="#C9B580"
              stroke="#7D6633"
              strokeWidth="0.6"
            />
            {/* Large multi-faceted teardrop */}
            <polygon
              points="230,292 223,306 230,326 237,306"
              fill="url(#crystal-sheen)"
              stroke="#A3894F"
              strokeWidth="0.9"
              strokeOpacity="0.95"
            />
            {/* Center diamond facet */}
            <polygon
              points="230,296 226,306 230,318 234,306"
              fill="#FAF8F2"
              fillOpacity="0.6"
              stroke="#C9B580"
              strokeWidth="0.6"
            />
            <line x1="230" y1="292" x2="230" y2="326" stroke="#FFFFFF" strokeWidth="0.8" strokeOpacity="0.9" />
          </g>

          {/* Upper scroll drop crystals */}
          <g className="chandelier-crystal" data-part="crystal">
            <line x1="150" y1="182" x2="150" y2="187" stroke="#A3894F" strokeWidth="0.8" />
            <circle cx="150" cy="189" r="1.8" fill="#C9B580" />
            <polygon
              points="150,191 147,198 150,206 153,198"
              fill="url(#crystal-sheen)"
              stroke="#A3894F"
              strokeWidth="0.6"
            />
          </g>
          <g className="chandelier-crystal" data-part="crystal">
            <line x1="310" y1="182" x2="310" y2="187" stroke="#A3894F" strokeWidth="0.8" />
            <circle cx="310" cy="189" r="1.8" fill="#C9B580" />
            <polygon
              points="310,191 307,198 310,206 313,198"
              fill="url(#crystal-sheen)"
              stroke="#A3894F"
              strokeWidth="0.6"
            />
          </g>
        </g>
      </svg>
    </div>
  );
};
