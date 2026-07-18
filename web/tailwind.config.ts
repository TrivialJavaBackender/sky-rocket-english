import type { Config } from 'tailwindcss';
import typography from '@tailwindcss/typography';

// Design tokens ported from docs/design/skyrocket/Skyrocket.dc.html (ARCHITECTURE.md
// §9 stage 4). Values live as CSS vars in app/globals.css (light/dark aware);
// this file only wires Tailwind utility names to them. Block/course colors
// are NOT here — they come from the DB per §8 D4 and are applied inline.
const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    // The mockup switches SideRail/BottomNav at window.innerWidth >= 980
    // (ARCHITECTURE §7.1). Named "desktop" so `desktop:` reads like the spec.
    screens: {
      sm: '480px',
      md: '740px',
      desktop: '980px',
      lg: '1120px',
    },
    extend: {
      fontFamily: {
        sans: ['"Source Sans 3"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        bg: {
          DEFAULT: 'var(--bg)',
          card: 'var(--bg-card)',
          soft: 'var(--bg-soft)',
          faint: 'var(--bg-faint)',
        },
        ink: 'var(--ink)',
        fg: {
          DEFAULT: 'var(--fg)',
          muted: 'var(--fg-muted)',
          subtle: 'var(--fg-subtle)',
          faint: 'var(--fg-faint)',
          faintest: 'var(--fg-faintest)',
        },
        border: {
          DEFAULT: 'var(--border)',
          faint: 'var(--border-faint)',
        },
        green: {
          DEFAULT: 'var(--green)',
          text: 'var(--green-text)',
          soft: 'var(--green-soft)',
          border: 'var(--green-border)',
        },
        red: {
          DEFAULT: 'var(--red)',
          text: 'var(--red-text)',
          soft: 'var(--red-soft)',
          border: 'var(--red-border)',
        },
        link: {
          DEFAULT: 'var(--link)',
          hover: 'var(--link-hover)',
        },
        // Back-compat aliases used by a couple of stage-2 scaffold spots.
        accent: {
          DEFAULT: 'var(--green)',
          soft: 'var(--green-soft)',
        },
      },
      borderRadius: {
        sm: '6px',
        md: '9px',
        DEFAULT: '10px',
        lg: '12px',
        xl: '14px',
        '2xl': '16px',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        pop: 'var(--shadow-pop)',
      },
      letterSpacing: {
        kicker: '.14em',
      },
    },
  },
  plugins: [typography],
};

export default config;
