import scrollbar from 'tailwind-scrollbar'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx,js,jsx}'],
  theme: {
    extend: {},
  },
  plugins: [
    scrollbar({ nocompatible: true }), // modern browsers
  ],

}