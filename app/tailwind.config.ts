import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        void: '#030305',
        primary: '#070709',
        secondary: '#0a0b0f',
        card: '#0f1014',
        elevated: '#151619',
        hover: '#1a1b21',
        accent: {
          primary: '#818cf8',
          secondary: '#a78bfa',
          cyan: '#22d3ee',
          emerald: '#10b981',
          amber: '#f59e0b',
          rose: '#f43f5e',
          gold: '#fbbf24',
          neon: '#00ff88',
        },
        text: {
          primary: '#fafafa',
          secondary: '#d4d4d8',
          muted: '#a1a1aa',
          dim: '#71717a',
        },
        border: {
          subtle: 'rgba(255,255,255,0.04)',
          medium: 'rgba(255,255,255,0.08)',
          active: 'rgba(129,140,248,0.5)',
          glow: 'rgba(34,211,238,0.4)',
        },
      },
      fontFamily: {
        display: ['Sora', 'sans-serif'],
        mono: ['IBM Plex Mono', 'monospace'],
      },
      borderRadius: {
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '24px',
      },
      boxShadow: {
        card: '0 4px 24px rgba(0,0,0,0.4), 0 0 1px rgba(255,255,255,0.05) inset',
        elevated: '0 8px 40px rgba(0,0,0,0.5), 0 0 1px rgba(255,255,255,0.08) inset',
        float: '0 20px 60px rgba(0,0,0,0.6)',
        'glow-primary': '0 0 30px rgba(129,140,248,0.3)',
        'glow-cyan': '0 0 25px rgba(34,211,238,0.35)',
        'glow-emerald': '0 0 20px rgba(16,185,129,0.4)',
        'glow-hot': '0 0 25px rgba(244,63,94,0.35)',
        'glow-gold': '0 0 20px rgba(251,191,36,0.4)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease',
        'slide-up': 'slideUp 0.4s ease',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        'card-in': 'cardIn 0.3s ease',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(20px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        pulseGlow: {
          '0%, 100%': { opacity: '0.4' },
          '50%': { opacity: '1' },
        },
        cardIn: {
          from: { opacity: '0', transform: 'translateY(10px) scale(0.98)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
