import React from 'react';
import linenTexture from '../assets/wedding-linen-seamless.png';

export interface PaperTextureProps {
  className?: string;
}

/**
 * PaperTexture component renders the repeatable tactile wedding linen background texture.
 * Uses wedding-linen-seamless.png as an organic seamless weave with aria-hidden="true"
 * and non-blocking interaction for accessibility and optimal performance.
 */
export const PaperTexture: React.FC<PaperTextureProps> = ({ className = '' }) => {
  return (
    <div
      className={`paper-texture pointer-events-none absolute inset-0 overflow-hidden select-none ${className}`}
      aria-hidden="true"
      style={{
        pointerEvents: 'none',
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 0,
        backgroundImage: `url(${linenTexture})`,
        backgroundRepeat: 'repeat',
        backgroundSize: '256px 256px',
      }}
    >
      <svg
        className="w-full h-full pointer-events-none"
        aria-hidden="true"
        width="100%"
        height="100%"
        xmlns="http://www.w3.org/2000/svg"
        style={{
          width: '100%',
          height: '100%',
          opacity: 0.35,
          mixBlendMode: 'multiply',
        }}
      >
        <defs>
          <filter
            id="wedding-paper-texture-filter"
            x="0%"
            y="0%"
            width="100%"
            height="100%"
            filterUnits="userSpaceOnUse"
          >
            {/* Static fine fractal noise simulating cotton/linen fibers */}
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.68"
              numOctaves={3}
              stitchTiles="stitch"
              result="noise"
            />
            {/* Color matrix toning noise into warm secondary olive/ivory grain */}
            <feColorMatrix
              type="matrix"
              values="0 0 0 0 0.44
                      0 0 0 0 0.42
                      0 0 0 0 0.33
                      0 0 0 0.05 0"
              result="coloredNoise"
            />
          </filter>
        </defs>
        <rect
          width="100%"
          height="100%"
          filter="url(#wedding-paper-texture-filter)"
          fill="#505B46"
        />
      </svg>
    </div>
  );
};
