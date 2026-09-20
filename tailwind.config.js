/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#090a0f',
        canvas: '#090a0f',
        sidebar: '#0c0e14',
        surface: {
          DEFAULT: '#12151e',
          elevated: '#171b26',
          hover: '#1e2332',
          active: '#23293a',
          border: '#232838',
          'border-subtle': '#1a1e2b',
          'border-hover': '#2f364a',
        },
        'surface-elevated': '#171b26',
        'surface-border': '#232838',
        accent: {
          DEFAULT: '#3b82f6',
          hover: '#2563eb',
          subtle: 'rgba(59, 130, 246, 0.12)',
        },
        primary: {
          DEFAULT: '#3b82f6',
          hover: '#2563eb',
        },
        status: {
          success: '#10b981',
          warning: '#f59e0b',
          error: '#ef4444',
          info: '#3b82f6',
        },
      },
      borderRadius: {
        sm: '4px',
        md: '6px',
        lg: '8px',
        xl: '12px',
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'monospace'],
      },
    },
  },
  plugins: [],
}
