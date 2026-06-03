/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Premium Dark/Slate Theme Color Palette
        brand: {
          50: '#f5f7fa',
          100: '#eaeef4',
          200: '#d1dbec',
          300: '#a8bedc',
          400: '#799bc7',
          500: '#577cb0',
          600: '#436191',
          700: '#384f76',
          800: '#314462',
          900: '#2c3b53',
          950: '#1d2737', // Deep slate primary background
        },
        accent: {
          emerald: '#10b981', // Ledger balancing success green
          rose: '#f43f5e',    // Ledger debit/credit discrepancy error red
          amber: '#f59e0b',   // Warning / Pending adjustments
          indigo: '#6366f1',  // Highlights / Active tabs
        },
        slate: {
          950: '#0b0f19',     // Deeper canvas color for rich aesthetics
        }
      },
      fontFamily: {
        sans: ['Outfit', 'Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
        'premium': '0 10px 30px -10px rgba(0, 0, 0, 0.5)',
      },
      backdropBlur: {
        'xs': '2px',
      }
    },
  },
  plugins: [],
}
