import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    screens: {
      'xs': '475px',
      'sm': '640px',
      'md': '768px',
      'lg': '1024px',
      'xl': '1280px',
      '2xl': '1536px',
    },
    extend: {
      fontFamily: {
        sans: ['IBM Plex Mono', 'JetBrains Mono', 'Fira Code', 'Menlo', 'Monaco', 'Courier New', 'monospace'],
        mono: ['IBM Plex Mono', 'JetBrains Mono', 'Fira Code', 'Menlo', 'Monaco', 'Courier New', 'monospace'],
      },
      colors: {
        border: "hsl(var(--border))",
        "border-light": "hsl(var(--border-light))",
        input: "hsl(var(--input))",
        // OpenClaw Red
        gate: {
          DEFAULT: "hsl(0 84% 60%)",
          light: "hsl(0 84% 95%)",
          dark: "hsl(0 84% 50%)",
        },
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        "background-secondary": "hsl(var(--background-secondary))",
        "background-tertiary": "hsl(var(--background-tertiary))",
        foreground: "hsl(var(--foreground))",
        "foreground-secondary": "hsl(var(--foreground-secondary))",
        surface: {
          DEFAULT: "hsl(var(--surface))",
          hover: "hsl(var(--surface-hover))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
          purple: "hsl(var(--accent-purple))",
          cyan: "hsl(var(--accent-cyan))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        // Binance brand colors
        binance: {
          yellow: "hsl(var(--binance-yellow))",
          "yellow-hover": "hsl(var(--binance-yellow-hover))",
          "yellow-light": "hsl(var(--binance-yellow-light))",
          "yellow-dark": "hsl(var(--binance-yellow-dark))",
        },
        badge: {
          blue: "hsl(var(--badge-blue))",
          gold: "hsl(var(--badge-gold))",
          "gold-light": "hsl(var(--badge-gold-light))",
        },
        interaction: {
          like: "hsl(var(--like-red))",
          repost: "hsl(var(--repost-green))",
          bookmark: "hsl(var(--bookmark-yellow))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xl: "calc(var(--radius) + 4px)",
        "2xl": "calc(var(--radius) + 8px)",
        "3xl": "1.5rem",
        pill: "9999px",
      },
      boxShadow: {
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
        xl: "var(--shadow-xl)",
        glow: "var(--shadow-glow)",
        soft: "var(--shadow-soft)",
        "glow-green": "var(--shadow-glow-green)",
      },
      transitionTimingFunction: {
        spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in-right": {
          from: { opacity: "0", transform: "translateX(20px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.95)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        "spin-slow": {
          from: { transform: "rotate(0deg)" },
          to: { transform: "rotate(360deg)" },
        },
        "pulse-glow": {
          "0%, 100%": { boxShadow: "0 0 20px hsl(43 96% 56% / 0.3)" },
          "50%": { boxShadow: "0 0 30px hsl(43 96% 56% / 0.5)" },
        },
        "shimmer": {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(200%)" },
        },
        "king-pulse": {
          "0%, 100%": { boxShadow: "0 0 20px rgba(249,115,22,0.15), 0 8px 32px rgba(0,0,0,0.4)", borderColor: "rgba(249,115,22,0.3)" },
          "50%": { boxShadow: "0 0 40px rgba(249,115,22,0.35), 0 12px 48px rgba(0,0,0,0.5)", borderColor: "rgba(249,115,22,0.5)" },
        },
        "bounce-subtle": {
          "0%, 100%": { transform: "translateY(0) rotate(0deg)" },
          "25%": { transform: "translateY(-3px) rotate(-5deg)" },
          "75%": { transform: "translateY(-1px) rotate(5deg)" },
        },
        "claw-shake": {
          "0%, 100%": { transform: "translateX(0) rotate(0deg)" },
          "25%": { transform: "translateX(-1px) rotate(-0.5deg)" },
          "75%": { transform: "translateX(1px) rotate(0.5deg)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.3s ease-out forwards",
        "slide-in-right": "slide-in-right 0.3s ease-out forwards",
        "scale-in": "scale-in 0.2s ease-out forwards",
        "spin-slow": "spin-slow 3s linear infinite",
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",
        "shimmer": "shimmer 2.5s ease-in-out infinite",
        "king-pulse": "king-pulse 2s ease-in-out infinite",
        "bounce-subtle": "bounce-subtle 1.5s ease-in-out infinite",
        "claw-shake": "claw-shake 0.3s ease-in-out",
      },
      spacing: {
        "18": "4.5rem",
        "88": "22rem",
        "128": "32rem",
      },
      maxWidth: {
        "8xl": "88rem",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
