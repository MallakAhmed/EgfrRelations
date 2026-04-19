/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        inter: ['Inter', 'system-ui', 'sans-serif'],
        orbitron: ['Orbitron', 'sans-serif'],
      },
      colors: {
        navy: {
          950: '#020812',
          900: '#050d1a',
          800: '#080f1e',
          700: '#0d1526',
          600: '#111e35',
        },
      },
      boxShadow: {
        'cyan-glow': '0 0 20px rgba(0,212,255,0.3), 0 0 40px rgba(0,212,255,0.1)',
        'cyan-glow-lg': '0 0 30px rgba(0,212,255,0.5), 0 0 60px rgba(0,212,255,0.2)',
        'red-glow': '0 0 20px rgba(239,68,68,0.4)',
        'amber-glow': '0 0 20px rgba(245,158,11,0.4)',
        'green-glow': '0 0 20px rgba(16,185,129,0.4)',
      },
    },
  },
  plugins: [],
}
