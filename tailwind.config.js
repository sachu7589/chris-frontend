/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#fefce8',
          100: '#fef9c3',
          200: '#fef08a',
          300: '#fde047',
          400: '#facc15',
          500: '#eab308',
          600: '#ca8a04',
          700: '#a16207',
          800: '#854d0e',
          900: '#713f12',
        }
      },
      safelist: [
        // Blue variants
        'border-blue-500', 'bg-blue-50', 'ring-blue-200', 'bg-blue-100', 'text-blue-600', 'text-blue-900', 'text-blue-700',
        // Green variants  
        'border-green-500', 'bg-green-50', 'ring-green-200', 'bg-green-100', 'text-green-600', 'text-green-900', 'text-green-700',
        // Purple variants
        'border-purple-500', 'bg-purple-50', 'ring-purple-200', 'bg-purple-100', 'text-purple-600', 'text-purple-900', 'text-purple-700',
      ]
    },
  },
  plugins: [],
}

