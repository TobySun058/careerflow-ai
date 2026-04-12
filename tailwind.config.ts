import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        border: "hsl(var(--border))",
        ring: "hsl(var(--ring))",
        input: "hsl(var(--input))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))"
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))"
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))"
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))"
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))"
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))"
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))"
        }
      },
      borderRadius: {
        xl: "1.15rem",
        lg: "1rem",
        md: "0.8rem",
        sm: "0.55rem"
      },
      fontFamily: {
        sans: ["var(--font-body)"],
        heading: ["var(--font-heading)"]
      },
      boxShadow: {
        panel: "0 20px 80px rgba(17, 32, 59, 0.12)",
        soft: "0 10px 35px rgba(17, 32, 59, 0.08)"
      },
      backgroundImage: {
        "hero-radial":
          "radial-gradient(circle at top left, rgba(94, 182, 255, 0.28), transparent 42%), radial-gradient(circle at bottom right, rgba(255, 208, 138, 0.28), transparent 30%)"
      },
      keyframes: {
        floatIn: {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        }
      },
      animation: {
        "float-in": "floatIn 0.45s ease-out forwards"
      }
    }
  },
  plugins: []
};

export default config;
