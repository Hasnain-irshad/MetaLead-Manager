# LeadBridge Design System (React + Tailwind CSS)

Tailwind config, colors, fonts, and animations for your educational lead dashboard. Matches the screenshot's modern blue/red scheme with smooth interactions. Extend with charts for lead stats (total, by status, daily trends). [file:21]

## Tailwind Config (tailwind.config.js)
```js
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: { 50: '#eff6ff', 500: '#3b82f6', 600: '#2563eb', 700: '#1d4ed8' },
        secondary: { 500: '#ef4444', 600: '#dc2626' },
        success: '#10b981', warning: '#f59e0b',
        gray: { 50: '#f9fafb', 100: '#f3f4f6', 800: '#1f2937', 900: '#111827' },
        surface: '#ffffff', border: '#e5e7eb',
      },
      fontFamily: { sans: ['Inter', 'ui-sans-serif', 'system-ui'], display: ['Inter'] },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        'pulse-soft': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'hover-lift': 'hoverLift 0.2s ease-out',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0', transform: 'translateY(10px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        slideUp: { '0%': { opacity: '0', transform: 'translateY(20px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        hoverLift: { '0%, 100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-4px)' } },
      },
      boxShadow: { 'card': '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)', 'modal': '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 10px 10px -5px rgb(0 0 0 / 0.04)' },
    },
  },
  plugins: [],
};