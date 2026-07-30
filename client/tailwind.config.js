import colors from 'tailwindcss/colors';

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // neutral scale — Tailwind's zinc (close to Creator Hub's surface/on-surface tokens)
        gray: colors.zinc,
        // brand — professional blue, with primary-container as the darker/hover shade
        primary: '#2563eb',
        'primary-container': '#1d4ed8',
        'on-primary': '#ffffff',
        'on-primary-container': '#ffffff',
        background: '#f6f6f7',
        surface: '#ffffff',
        'surface-container-lowest': '#ffffff',
        'surface-container-low': '#f4f4f5',
        'surface-container': '#ededee',
        'surface-container-high': '#e6e6e8',
        'surface-container-highest': '#dededf',
        'on-surface': '#18181b',
        'on-background': '#18181b',
        'on-surface-variant': '#52525b',
        outline: '#a1a1aa',
        'outline-variant': '#d4d4d8',
        secondary: '#27272a',
        'on-secondary': '#ffffff',
        // sidebar — deep navy shell (blue-tinted dark, not neutral black) around a light content area
        sidebar: '#0f172a',
        'sidebar-border': '#1e293b',
        'sidebar-text': '#cbd5e1',
      },
      fontFamily: {
        sans: ['Prompt', 'Poppins', 'sans-serif'],
        poppins: ['Poppins', 'Prompt', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
