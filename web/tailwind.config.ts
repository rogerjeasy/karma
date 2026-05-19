import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: { DEFAULT: "1rem", sm: "1.5rem", lg: "2rem" },
      screens: { "2xl": "1400px" },
    },
    extend: {
      screens: {
        xs: "480px",
      },
      colors: {
        border:      "hsl(var(--border))",
        input:       "hsl(var(--input))",
        ring:        "hsl(var(--ring))",
        background:  "hsl(var(--background))",
        foreground:  "hsl(var(--foreground))",
        primary: {
          DEFAULT:    "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT:    "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT:    "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT:    "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT:    "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT:    "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT:    "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        success: {
          DEFAULT:    "hsl(var(--success))",
          foreground: "hsl(0 0% 100%)",
        },
        warning: {
          DEFAULT:    "hsl(var(--warning))",
          foreground: "hsl(0 0% 10%)",
        },
        info: {
          DEFAULT:    "hsl(var(--info))",
          foreground: "hsl(0 0% 100%)",
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      borderRadius: {
        sm:   "calc(var(--radius) - 4px)",
        md:   "calc(var(--radius) - 2px)",
        lg:   "var(--radius)",
        xl:   "calc(var(--radius) + 4px)",
        "2xl":"calc(var(--radius) + 8px)",
      },
      boxShadow: {
        "glow-sm":    "0 0 14px -3px hsl(var(--primary) / 0.30)",
        "glow-md":    "0 0 28px -5px hsl(var(--primary) / 0.40)",
        "card":       "0 1px 3px rgba(0,0,0,.35), 0 1px 2px rgba(0,0,0,.25)",
        "card-hover": "0 6px 18px rgba(0,0,0,.45), 0 2px 6px rgba(0,0,0,.30)",
        "sidebar":    "4px 0 24px rgba(0,0,0,.4)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to:   { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to:   { height: "0" },
        },
        "ghost-pulse": {
          "0%, 100%": { opacity: "0.7", transform: "scale(1)" },
          "50%":       { opacity: "1", transform: "scale(1.01)", boxShadow: "0 0 40px -4px hsl(0 72% 51% / 0.40)" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to:   { opacity: "1" },
        },
        "fade-in-up": {
          from: { opacity: "0", transform: "translateY(14px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in-left": {
          from: { transform: "translateX(-100%)" },
          to:   { transform: "translateX(0)" },
        },
        "pulse-ring": {
          "0%":   { transform: "scale(1)", opacity: "1" },
          "100%": { transform: "scale(1.65)", opacity: "0" },
        },
        "shimmer": {
          "0%":   { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "spin-slow": {
          to: { transform: "rotate(360deg)" },
        },
        "float": {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%":       { transform: "translateY(-22px)" },
        },
        "float-slow": {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%":       { transform: "translateY(-14px)" },
        },
        "glow-breathe": {
          "0%, 100%": { opacity: "0.4" },
          "50%":       { opacity: "0.85" },
        },
        "beam": {
          "0%":   { transform: "translateX(-100%) skewX(-12deg)", opacity: "0" },
          "30%":  { opacity: "1" },
          "100%": { transform: "translateX(250%) skewX(-12deg)", opacity: "0" },
        },
        "marquee": {
          "0%":   { transform: "translateX(0%)" },
          "100%": { transform: "translateX(-50%)" },
        },
        "ghost-wobble": {
          "0%, 100%": { transform: "rotate(-4deg) translateY(0px)" },
          "25%":       { transform: "rotate(3deg)  translateY(-6px)" },
          "50%":       { transform: "rotate(-2deg) translateY(-10px)" },
          "75%":       { transform: "rotate(4deg)  translateY(-5px)" },
        },
        "ghost-alarm": {
          "0%, 100%": { transform: "scale(1)",    opacity: "1"   },
          "50%":       { transform: "scale(1.06)", opacity: "0.8" },
        },
        "particle-rise": {
          "0%":   { transform: "translateY(0)    scale(1)",   opacity: "0.7" },
          "100%": { transform: "translateY(-90px) scale(0.3)", opacity: "0"   },
        },
        "contract-appear": {
          "0%":   { opacity: "0", transform: "scale(0.7) translateY(6px)"  },
          "100%": { opacity: "1", transform: "scale(1)   translateY(0)"    },
        },
        "orb-drift": {
          "0%, 100%": { transform: "translate(0, 0)" },
          "33%":       { transform: "translate(18px, -12px)" },
          "66%":       { transform: "translate(-12px, 8px)"  },
        },
      },
      animation: {
        "accordion-down":  "accordion-down 0.2s ease-out",
        "accordion-up":    "accordion-up 0.2s ease-out",
        "ghost-pulse":     "ghost-pulse 2.4s ease-in-out",
        "fade-in":         "fade-in 0.25s ease-out",
        "fade-in-up":      "fade-in-up 0.35s ease-out",
        "slide-in-left":   "slide-in-left 0.28s cubic-bezier(0.16,1,0.3,1)",
        "pulse-ring":      "pulse-ring 1.4s ease-out infinite",
        "shimmer":         "shimmer 2s linear infinite",
        "spin-slow":       "spin-slow 2s linear infinite",
        "float":            "float 7s ease-in-out infinite",
        "float-slow":       "float-slow 10s ease-in-out infinite",
        "glow-breathe":     "glow-breathe 3.5s ease-in-out infinite",
        "beam":             "beam 3s ease-in-out infinite",
        "marquee":          "marquee 28s linear infinite",
        "ghost-wobble":     "ghost-wobble 5s ease-in-out infinite",
        "ghost-alarm":      "ghost-alarm 0.9s ease-in-out infinite",
        "particle-rise":    "particle-rise 3.5s ease-out infinite",
        "contract-appear":  "contract-appear 0.4s ease-out forwards",
        "orb-drift":        "orb-drift 12s ease-in-out infinite",
      },
    },
  },
  plugins: [animate],
};

export default config;
