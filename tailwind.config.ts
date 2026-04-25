import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#0B3D2E',
        secondary: '#1F7A63',
        background: '#F5F7F6',
        text: '#1A1A1A',
        muted: '#6B7280',
        card: '#FFFFFF',
        border: '#E5E7EB',
      },
    },
  },
  plugins: [],
};

export default config;