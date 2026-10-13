import React from 'react';

export interface BotanicalFrameProps {
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
 * BotanicalFrame component renders an artisanal botanical canopy
 * cascading from the upper-left and upper-right corners.
 *
 * Conceived with natural asymmetrical olive branches, veined foliage,
 * layered depths (deep olive #505B46 and soft sage #A7B09A), and delicate fruit.
 *
 * Conforms to accessibility standards (aria-hidden="true", pointer-events: none)
 * and honors prefers-reduced-motion preferences.
 */
export const BotanicalFrame: React.FC<BotanicalFrameProps> = ({
  isVisible = true,
  className = '',
}) => {
  const reducedMotion = usePrefersReducedMotion();

  // Compute transform and transition styles respecting reduced motion
  const style: React.CSSProperties = {
    pointerEvents: 'none',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    width: '100%',
    zIndex: 'var(--z-illustration, 1)',
    opacity: isVisible ? 1 : 0,
    transform: reducedMotion
      ? 'none'
      : isVisible
      ? 'translateY(0)'
      : 'translateY(-20px)',
    transition: reducedMotion
      ? 'none'
      : 'opacity 800ms cubic-bezier(0.22, 1, 0.36, 1), transform 800ms cubic-bezier(0.22, 1, 0.36, 1)',
  };

  return (
    <div
      className={`botanical-frame pointer-events-none absolute top-0 left-0 right-0 w-full overflow-hidden select-none ${
        !isVisible ? 'opacity-0' : 'opacity-100'
      } ${className}`}
      aria-hidden="true"
      style={style}
    >
      <div className="botanical-canopy-container flex justify-between w-full max-w-[1600px] mx-auto">
        {/* UPPER-LEFT CASCADING BOTANICAL CANOPY */}
        <svg
          className="botanical-canopy botanical-canopy-left w-[44%] max-w-[520px] min-w-[160px] h-auto overflow-visible pointer-events-none"
          data-canopy="left"
          viewBox="0 0 520 380"
          preserveAspectRatio="xMinYMin meet"
          aria-hidden="true"
        >
          <g id="left-canopy-stems">
            {/* Main sweeping branch */}
            <path
              className="botanical-stem"
              data-part="stem"
              d="M -15 -10 C 45 35, 110 95, 155 175 C 185 230, 205 275, 235 325 C 245 342, 258 355, 275 365"
              fill="none"
              stroke="#505B46"
              strokeWidth="3.2"
              strokeLinecap="round"
              strokeOpacity="0.9"
            />
            {/* Center-arching secondary branch */}
            <path
              className="botanical-stem"
              data-part="stem"
              d="M 85 65 C 175 75, 275 105, 355 155 C 405 185, 445 225, 475 265"
              fill="none"
              stroke="#505B46"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeOpacity="0.85"
            />
            {/* Outer cascading branch */}
            <path
              className="botanical-stem"
              data-part="stem"
              d="M 35 35 C 35 115, 55 195, 75 275 C 85 315, 95 345, 105 368"
              fill="none"
              stroke="#68745C"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeOpacity="0.8"
            />
            {/* Delicate twig branches */}
            <path
              className="botanical-stem"
              data-part="stem"
              d="M 125 125 C 150 140, 180 150, 205 158"
              fill="none"
              stroke="#68745C"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeOpacity="0.75"
            />
            <path
              className="botanical-stem"
              data-part="stem"
              d="M 195 240 C 220 255, 245 270, 260 285"
              fill="none"
              stroke="#68745C"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeOpacity="0.75"
            />
            <path
              className="botanical-stem"
              data-part="stem"
              d="M 270 110 C 295 125, 320 135, 345 142"
              fill="none"
              stroke="#68745C"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeOpacity="0.75"
            />
          </g>

          {/* LEFT FOLIAGE: BACKGROUND/DEPTH LAYER */}
          <g id="left-canopy-leaves-depth">
            {/* Leaf 1 (Muted sage background) */}
            <g>
              <path
                className="botanical-leaf"
                data-part="leaf"
                d="M 70 50 C 95 35, 130 38, 145 58 C 128 72, 92 68, 70 50 Z"
                fill="#8F9A83"
                fillOpacity="0.55"
              />
              <path
                className="botanical-vein"
                data-part="vein"
                d="M 70 50 C 100 48, 125 52, 145 58"
                fill="none"
                stroke="#3A4233"
                strokeWidth="0.8"
                strokeOpacity="0.4"
              />
            </g>
            {/* Leaf 2 (Soft background sage) */}
            <g>
              <path
                className="botanical-leaf"
                data-part="leaf"
                d="M 140 100 C 168 85, 202 92, 218 115 C 196 128, 162 120, 140 100 Z"
                fill="#A7B09A"
                fillOpacity="0.6"
              />
              <path
                className="botanical-vein"
                data-part="vein"
                d="M 140 100 C 172 98, 198 105, 218 115"
                fill="none"
                stroke="#3A4233"
                strokeWidth="0.8"
                strokeOpacity="0.45"
              />
            </g>
            {/* Leaf 3 (Pale sage accent) */}
            <g>
              <path
                className="botanical-leaf"
                data-part="leaf"
                d="M 230 130 C 265 120, 305 130, 322 155 C 298 168, 258 158, 230 130 Z"
                fill="#C2C9B8"
                fillOpacity="0.65"
              />
              <path
                className="botanical-vein"
                data-part="vein"
                d="M 230 130 C 270 132, 298 142, 322 155"
                fill="none"
                stroke="#505B46"
                strokeWidth="0.8"
                strokeOpacity="0.5"
              />
            </g>
            {/* Leaf 4 (Deep olive background) */}
            <g>
              <path
                className="botanical-leaf"
                data-part="leaf"
                d="M 60 180 C 88 165, 125 172, 140 198 C 118 210, 82 202, 60 180 Z"
                fill="#3A4233"
                fillOpacity="0.5"
              />
              <path
                className="botanical-vein"
                data-part="vein"
                d="M 60 180 C 92 178, 118 186, 140 198"
                fill="none"
                stroke="#505B46"
                strokeWidth="0.8"
                strokeOpacity="0.4"
              />
            </g>
          </g>

          {/* LEFT FOLIAGE: FOREGROUND VEINED OLIVE & SAGE LEAVES */}
          <g id="left-canopy-leaves-foreground">
            {/* Leaf 5 (Deep olive primary) */}
            <g>
              <path
                className="botanical-leaf"
                data-part="leaf"
                d="M 100 80 C 135 60, 180 68, 202 96 C 175 112, 130 102, 100 80 Z"
                fill="#505B46"
                fillOpacity="0.95"
              />
              <path
                className="botanical-vein"
                data-part="vein"
                d="M 100 80 C 142 78, 175 86, 202 96"
                fill="none"
                stroke="#3A4233"
                strokeWidth="1.1"
                strokeOpacity="0.65"
              />
            </g>
            {/* Leaf 6 (Warm olive drooping) */}
            <g>
              <path
                className="botanical-leaf"
                data-part="leaf"
                d="M 120 145 C 152 130, 192 140, 210 170 C 182 182, 142 172, 120 145 Z"
                fill="#68745C"
                fillOpacity="0.9"
              />
              <path
                className="botanical-vein"
                data-part="vein"
                d="M 120 145 C 158 145, 188 155, 210 170"
                fill="none"
                stroke="#3A4233"
                strokeWidth="1.0"
                strokeOpacity="0.6"
              />
            </g>
            {/* Leaf 7 (Sage foreground cluster) */}
            <g>
              <path
                className="botanical-leaf"
                data-part="leaf"
                d="M 165 185 C 200 170, 242 180, 260 210 C 232 225, 190 215, 165 185 Z"
                fill="#A7B09A"
                fillOpacity="0.88"
              />
              <path
                className="botanical-vein"
                data-part="vein"
                d="M 165 185 C 205 188, 235 198, 260 210"
                fill="none"
                stroke="#505B46"
                strokeWidth="1.0"
                strokeOpacity="0.6"
              />
            </g>
            {/* Leaf 8 (Lower cascading olive) */}
            <g>
              <path
                className="botanical-leaf"
                data-part="leaf"
                d="M 190 250 C 220 235, 258 245, 275 272 C 248 285, 212 278, 190 250 Z"
                fill="#505B46"
                fillOpacity="0.92"
              />
              <path
                className="botanical-vein"
                data-part="vein"
                d="M 190 250 C 225 248, 252 258, 275 272"
                fill="none"
                stroke="#3A4233"
                strokeWidth="1.0"
                strokeOpacity="0.6"
              />
            </g>
            {/* Leaf 9 (Terminal cluster tip) */}
            <g>
              <path
                className="botanical-leaf"
                data-part="leaf"
                d="M 230 315 C 255 305, 285 315, 298 338 C 275 348, 248 340, 230 315 Z"
                fill="#68745C"
                fillOpacity="0.88"
              />
              <path
                className="botanical-vein"
                data-part="vein"
                d="M 230 315 C 258 318, 280 326, 298 338"
                fill="none"
                stroke="#3A4233"
                strokeWidth="0.9"
                strokeOpacity="0.55"
              />
            </g>
            {/* Leaf 10 (High lateral arch olive) */}
            <g>
              <path
                className="botanical-leaf"
                data-part="leaf"
                d="M 290 120 C 330 105, 375 115, 395 142 C 368 158, 325 148, 290 120 Z"
                fill="#505B46"
                fillOpacity="0.9"
              />
              <path
                className="botanical-vein"
                data-part="vein"
                d="M 290 120 C 335 120, 368 130, 395 142"
                fill="none"
                stroke="#3A4233"
                strokeWidth="1.0"
                strokeOpacity="0.6"
              />
            </g>
            {/* Leaf 11 (Mid lateral sage) */}
            <g>
              <path
                className="botanical-leaf"
                data-part="leaf"
                d="M 360 165 C 400 152, 442 165, 460 195 C 430 208, 390 198, 360 165 Z"
                fill="#A7B09A"
                fillOpacity="0.85"
              />
              <path
                className="botanical-vein"
                data-part="vein"
                d="M 360 165 C 402 168, 435 180, 460 195"
                fill="none"
                stroke="#505B46"
                strokeWidth="1.0"
                strokeOpacity="0.55"
              />
            </g>
            {/* Leaf 12 (Right tip leaf) */}
            <g>
              <path
                className="botanical-leaf"
                data-part="leaf"
                d="M 420 230 C 455 220, 490 232, 505 258 C 478 270, 445 260, 420 230 Z"
                fill="#68745C"
                fillOpacity="0.85"
              />
              <path
                className="botanical-vein"
                data-part="vein"
                d="M 420 230 C 458 232, 485 242, 505 258"
                fill="none"
                stroke="#3A4233"
                strokeWidth="0.9"
                strokeOpacity="0.55"
              />
            </g>
            {/* Leaf 13 (Outer margin olive) */}
            <g>
              <path
                className="botanical-leaf"
                data-part="leaf"
                d="M 45 110 C 68 95, 102 102, 115 125 C 95 138, 62 130, 45 110 Z"
                fill="#505B46"
                fillOpacity="0.9"
              />
              <path
                className="botanical-vein"
                data-part="vein"
                d="M 45 110 C 75 108, 98 115, 115 125"
                fill="none"
                stroke="#3A4233"
                strokeWidth="0.9"
                strokeOpacity="0.6"
              />
            </g>
            {/* Leaf 14 (Outer mid sage) */}
            <g>
              <path
                className="botanical-leaf"
                data-part="leaf"
                d="M 55 210 C 78 198, 110 205, 122 228 C 102 240, 72 232, 55 210 Z"
                fill="#A7B09A"
                fillOpacity="0.85"
              />
              <path
                className="botanical-vein"
                data-part="vein"
                d="M 55 210 C 82 208, 105 216, 122 228"
                fill="none"
                stroke="#505B46"
                strokeWidth="0.9"
                strokeOpacity="0.55"
              />
            </g>
            {/* Leaf 15 (Outer low olive) */}
            <g>
              <path
                className="botanical-leaf"
                data-part="leaf"
                d="M 70 290 C 92 278, 125 285, 138 308 C 118 320, 88 312, 70 290 Z"
                fill="#68745C"
                fillOpacity="0.9"
              />
              <path
                className="botanical-vein"
                data-part="vein"
                d="M 70 290 C 98 288, 120 296, 138 308"
                fill="none"
                stroke="#3A4233"
                strokeWidth="0.9"
                strokeOpacity="0.6"
              />
            </g>
          </g>

          {/* LEFT OLIVE FRUIT/DRUPES */}
          <g id="left-canopy-fruit">
            {/* Olive 1 */}
            <g data-part="fruit" className="botanical-fruit">
              <path d="M 158 178 Q 165 195, 168 202" fill="none" stroke="#505B46" strokeWidth="1" />
              <ellipse cx="168" cy="208" rx="5" ry="7.5" fill="#3A4233" transform="rotate(-15 168 208)" />
              <ellipse cx="166" cy="205" rx="1.5" ry="3" fill="#A7B09A" opacity="0.4" transform="rotate(-15 166 205)" />
            </g>
            {/* Olive 2 */}
            <g data-part="fruit" className="botanical-fruit">
              <path d="M 285 158 Q 290 172, 292 180" fill="none" stroke="#505B46" strokeWidth="1" />
              <ellipse cx="292" cy="186" rx="5" ry="7.5" fill="#505B46" transform="rotate(10 292 186)" />
              <ellipse cx="290" cy="183" rx="1.5" ry="3" fill="#A7B09A" opacity="0.4" transform="rotate(10 290 183)" />
            </g>
            {/* Olive 3 */}
            <g data-part="fruit" className="botanical-fruit">
              <path d="M 88 285 Q 92 298, 93 305" fill="none" stroke="#505B46" strokeWidth="1" />
              <ellipse cx="93" cy="311" rx="4.8" ry="7.2" fill="#3A4233" transform="rotate(-8 93 311)" />
              <ellipse cx="91" cy="308" rx="1.4" ry="2.8" fill="#A7B09A" opacity="0.4" transform="rotate(-8 91 308)" />
            </g>
          </g>
        </svg>

        {/* UPPER-RIGHT CASCADING BOTANICAL CANOPY (ASYMMETRICAL BESPOKE DESIGN) */}
        <svg
          className="botanical-canopy botanical-canopy-right w-[44%] max-w-[520px] min-w-[160px] h-auto overflow-visible pointer-events-none"
          data-canopy="right"
          viewBox="0 0 520 380"
          preserveAspectRatio="xMaxYMin meet"
          aria-hidden="true"
        >
          <g id="right-canopy-stems">
            {/* Main descending right branch with distinct curvature */}
            <path
              className="botanical-stem"
              data-part="stem"
              d="M 535 -10 C 465 25, 395 85, 335 155 C 275 225, 235 275, 185 325 C 170 340, 155 352, 138 360"
              fill="none"
              stroke="#505B46"
              strokeWidth="3.2"
              strokeLinecap="round"
              strokeOpacity="0.9"
            />
            {/* Center-sweeping upper branch reaching inward */}
            <path
              className="botanical-stem"
              data-part="stem"
              d="M 445 45 C 355 55, 255 75, 165 115 C 105 145, 55 175, 25 215"
              fill="none"
              stroke="#505B46"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeOpacity="0.85"
            />
            {/* Trailing outer right branch */}
            <path
              className="botanical-stem"
              data-part="stem"
              d="M 485 25 C 495 115, 475 205, 455 285 C 445 325, 435 355, 425 372"
              fill="none"
              stroke="#68745C"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeOpacity="0.8"
            />
            {/* Asymmetrical lateral twigs */}
            <path
              className="botanical-stem"
              data-part="stem"
              d="M 370 120 C 340 135, 310 145, 280 152"
              fill="none"
              stroke="#68745C"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeOpacity="0.75"
            />
            <path
              className="botanical-stem"
              data-part="stem"
              d="M 285 195 C 260 215, 230 230, 205 240"
              fill="none"
              stroke="#68745C"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeOpacity="0.75"
            />
            <path
              className="botanical-stem"
              data-part="stem"
              d="M 215 80 C 185 92, 155 102, 128 108"
              fill="none"
              stroke="#68745C"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeOpacity="0.75"
            />
          </g>

          {/* RIGHT FOLIAGE: BACKGROUND/DEPTH LAYER */}
          <g id="right-canopy-leaves-depth">
            {/* Leaf R1 (Muted sage depth) */}
            <g>
              <path
                className="botanical-leaf"
                data-part="leaf"
                d="M 450 40 C 425 25, 390 28, 375 48 C 392 62, 428 58, 450 40 Z"
                fill="#8F9A83"
                fillOpacity="0.55"
              />
              <path
                className="botanical-vein"
                data-part="vein"
                d="M 450 40 C 420 38, 395 42, 375 48"
                fill="none"
                stroke="#3A4233"
                strokeWidth="0.8"
                strokeOpacity="0.4"
              />
            </g>
            {/* Leaf R2 (Soft sage depth) */}
            <g>
              <path
                className="botanical-leaf"
                data-part="leaf"
                d="M 380 90 C 352 75, 318 82, 302 105 C 324 118, 358 110, 380 90 Z"
                fill="#A7B09A"
                fillOpacity="0.6"
              />
              <path
                className="botanical-vein"
                data-part="vein"
                d="M 380 90 C 348 88, 322 95, 302 105"
                fill="none"
                stroke="#3A4233"
                strokeWidth="0.8"
                strokeOpacity="0.45"
              />
            </g>
            {/* Leaf R3 (Pale sage accent) */}
            <g>
              <path
                className="botanical-leaf"
                data-part="leaf"
                d="M 290 120 C 255 110, 215 120, 198 145 C 222 158, 262 148, 290 120 Z"
                fill="#C2C9B8"
                fillOpacity="0.65"
              />
              <path
                className="botanical-vein"
                data-part="vein"
                d="M 290 120 C 250 122, 222 132, 198 145"
                fill="none"
                stroke="#505B46"
                strokeWidth="0.8"
                strokeOpacity="0.5"
              />
            </g>
            {/* Leaf R4 (Deep olive background) */}
            <g>
              <path
                className="botanical-leaf"
                data-part="leaf"
                d="M 460 170 C 432 155, 395 162, 380 188 C 402 200, 438 192, 460 170 Z"
                fill="#3A4233"
                fillOpacity="0.5"
              />
              <path
                className="botanical-vein"
                data-part="vein"
                d="M 460 170 C 428 168, 402 176, 380 188"
                fill="none"
                stroke="#505B46"
                strokeWidth="0.8"
                strokeOpacity="0.4"
              />
            </g>
          </g>

          {/* RIGHT FOLIAGE: FOREGROUND VEINED OLIVE & SAGE LEAVES */}
          <g id="right-canopy-leaves-foreground">
            {/* Leaf R5 (Deep olive primary) */}
            <g>
              <path
                className="botanical-leaf"
                data-part="leaf"
                d="M 420 70 C 385 50, 340 58, 318 86 C 345 102, 390 92, 420 70 Z"
                fill="#505B46"
                fillOpacity="0.95"
              />
              <path
                className="botanical-vein"
                data-part="vein"
                d="M 420 70 C 378 68, 345 76, 318 86"
                fill="none"
                stroke="#3A4233"
                strokeWidth="1.1"
                strokeOpacity="0.65"
              />
            </g>
            {/* Leaf R6 (Warm olive swooping) */}
            <g>
              <path
                className="botanical-leaf"
                data-part="leaf"
                d="M 400 135 C 368 120, 328 130, 310 160 C 338 172, 378 162, 400 135 Z"
                fill="#68745C"
                fillOpacity="0.9"
              />
              <path
                className="botanical-vein"
                data-part="vein"
                d="M 400 135 C 362 135, 332 145, 310 160"
                fill="none"
                stroke="#3A4233"
                strokeWidth="1.0"
                strokeOpacity="0.6"
              />
            </g>
            {/* Leaf R7 (Sage foreground cluster) */}
            <g>
              <path
                className="botanical-leaf"
                data-part="leaf"
                d="M 355 175 C 320 160, 278 170, 260 200 C 288 215, 330 205, 355 175 Z"
                fill="#A7B09A"
                fillOpacity="0.88"
              />
              <path
                className="botanical-vein"
                data-part="vein"
                d="M 355 175 C 315 178, 285 188, 260 200"
                fill="none"
                stroke="#505B46"
                strokeWidth="1.0"
                strokeOpacity="0.6"
              />
            </g>
            {/* Leaf R8 (Cascading lower olive) */}
            <g>
              <path
                className="botanical-leaf"
                data-part="leaf"
                d="M 330 240 C 300 225, 262 235, 245 262 C 272 275, 308 268, 330 240 Z"
                fill="#505B46"
                fillOpacity="0.92"
              />
              <path
                className="botanical-vein"
                data-part="vein"
                d="M 330 240 C 295 238, 268 248, 245 262"
                fill="none"
                stroke="#3A4233"
                strokeWidth="1.0"
                strokeOpacity="0.6"
              />
            </g>
            {/* Leaf R9 (Terminal leftward cluster) */}
            <g>
              <path
                className="botanical-leaf"
                data-part="leaf"
                d="M 290 305 C 265 295, 235 305, 222 328 C 245 338, 272 330, 290 305 Z"
                fill="#68745C"
                fillOpacity="0.88"
              />
              <path
                className="botanical-vein"
                data-part="vein"
                d="M 290 305 C 262 308, 240 316, 222 328"
                fill="none"
                stroke="#3A4233"
                strokeWidth="0.9"
                strokeOpacity="0.55"
              />
            </g>
            {/* Leaf R10 (Center arch olive) */}
            <g>
              <path
                className="botanical-leaf"
                data-part="leaf"
                d="M 230 110 C 190 95, 145 105, 125 132 C 152 148, 195 138, 230 110 Z"
                fill="#505B46"
                fillOpacity="0.9"
              />
              <path
                className="botanical-vein"
                data-part="vein"
                d="M 230 110 C 185 110, 152 120, 125 132"
                fill="none"
                stroke="#3A4233"
                strokeWidth="1.0"
                strokeOpacity="0.6"
              />
            </g>
            {/* Leaf R11 (Deep center sage) */}
            <g>
              <path
                className="botanical-leaf"
                data-part="leaf"
                d="M 160 155 C 120 142, 78 155, 60 185 C 90 198, 130 188, 160 155 Z"
                fill="#A7B09A"
                fillOpacity="0.85"
              />
              <path
                className="botanical-vein"
                data-part="vein"
                d="M 160 155 C 118 158, 85 170, 60 185"
                fill="none"
                stroke="#505B46"
                strokeWidth="1.0"
                strokeOpacity="0.55"
              />
            </g>
            {/* Leaf R12 (Far left reach leaf) */}
            <g>
              <path
                className="botanical-leaf"
                data-part="leaf"
                d="M 100 220 C 65 210, 30 222, 15 248 C 42 260, 75 250, 100 220 Z"
                fill="#68745C"
                fillOpacity="0.85"
              />
              <path
                className="botanical-vein"
                data-part="vein"
                d="M 100 220 C 62 222, 35 232, 15 248"
                fill="none"
                stroke="#3A4233"
                strokeWidth="0.9"
                strokeOpacity="0.55"
              />
            </g>
            {/* Leaf R13 (Right border upper olive) */}
            <g>
              <path
                className="botanical-leaf"
                data-part="leaf"
                d="M 475 100 C 452 85, 418 92, 405 115 C 425 128, 458 120, 475 100 Z"
                fill="#505B46"
                fillOpacity="0.9"
              />
              <path
                className="botanical-vein"
                data-part="vein"
                d="M 475 100 C 445 98, 422 105, 405 115"
                fill="none"
                stroke="#3A4233"
                strokeWidth="0.9"
                strokeOpacity="0.6"
              />
            </g>
            {/* Leaf R14 (Right border mid sage) */}
            <g>
              <path
                className="botanical-leaf"
                data-part="leaf"
                d="M 465 200 C 442 188, 410 195, 398 218 C 418 230, 448 222, 465 200 Z"
                fill="#A7B09A"
                fillOpacity="0.85"
              />
              <path
                className="botanical-vein"
                data-part="vein"
                d="M 465 200 C 438 198, 415 206, 398 218"
                fill="none"
                stroke="#505B46"
                strokeWidth="0.9"
                strokeOpacity="0.55"
              />
            </g>
            {/* Leaf R15 (Right border low olive) */}
            <g>
              <path
                className="botanical-leaf"
                data-part="leaf"
                d="M 450 280 C 428 268, 395 275, 382 298 C 402 310, 432 302, 450 280 Z"
                fill="#68745C"
                fillOpacity="0.9"
              />
              <path
                className="botanical-vein"
                data-part="vein"
                d="M 450 280 C 422 278, 400 286, 382 298"
                fill="none"
                stroke="#3A4233"
                strokeWidth="0.9"
                strokeOpacity="0.6"
              />
            </g>
          </g>

          {/* RIGHT OLIVE FRUIT/DRUPES */}
          <g id="right-canopy-fruit">
            {/* Olive R1 */}
            <g data-part="fruit" className="botanical-fruit">
              <path d="M 362 168 Q 355 185, 352 192" fill="none" stroke="#505B46" strokeWidth="1" />
              <ellipse cx="352" cy="198" rx="5" ry="7.5" fill="#3A4233" transform="rotate(15 352 198)" />
              <ellipse cx="354" cy="195" rx="1.5" ry="3" fill="#A7B09A" opacity="0.4" transform="rotate(15 354 195)" />
            </g>
            {/* Olive R2 */}
            <g data-part="fruit" className="botanical-fruit">
              <path d="M 235 148 Q 230 162, 228 170" fill="none" stroke="#505B46" strokeWidth="1" />
              <ellipse cx="228" cy="176" rx="5" ry="7.5" fill="#505B46" transform="rotate(-10 228 176)" />
              <ellipse cx="230" cy="173" rx="1.5" ry="3" fill="#A7B09A" opacity="0.4" transform="rotate(-10 230 173)" />
            </g>
            {/* Olive R3 */}
            <g data-part="fruit" className="botanical-fruit">
              <path d="M 432 275 Q 428 288, 427 295" fill="none" stroke="#505B46" strokeWidth="1" />
              <ellipse cx="427" cy="301" rx="4.8" ry="7.2" fill="#3A4233" transform="rotate(8 427 301)" />
              <ellipse cx="429" cy="298" rx="1.4" ry="2.8" fill="#A7B09A" opacity="0.4" transform="rotate(8 429 298)" />
            </g>
          </g>
        </svg>
      </div>
    </div>
  );
};
