/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Айдентика TaskFlow (собственная, учебная)
        ink:   '#14213D',
        sky:   '#2F6BFF',
        mint:  '#17B890',
        amber: '#F6A609',
        rose:  '#E5484D',
        paper: '#F6F8FC',
      },
      fontFamily: { sans: ['ui-sans-serif', 'system-ui', 'Segoe UI', 'Roboto', 'Arial', 'sans-serif'] },
    },
  },
  plugins: [],
};
