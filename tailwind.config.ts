import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px'
      }
    },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))'
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))'
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))'
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))'
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))'
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))'
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))'
        },
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar-background))',
          foreground: 'hsl(var(--sidebar-foreground))',
          primary: 'hsl(var(--sidebar-primary))',
          'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
          accent: 'hsl(var(--sidebar-accent))',
          'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
          border: 'hsl(var(--sidebar-border))',
          ring: 'hsl(var(--sidebar-ring))'
        },
        success: {
          DEFAULT: 'hsl(var(--success))',
          foreground: 'hsl(var(--success-foreground))'
        },
        warning: {
          DEFAULT: 'hsl(var(--warning))',
          foreground: 'hsl(var(--warning-foreground))'
        },
        info: {
          DEFAULT: 'hsl(var(--info))',
          foreground: 'hsl(var(--info-foreground))'
        }
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 4px)',
        sm: 'calc(var(--radius) - 8px)'
      },
      keyframes: {
        'accordion-down': {
          from: {
            height: '0'
          },
          to: {
            height: 'var(--radix-accordion-content-height)'
          }
        },
        'accordion-up': {
          from: {
            height: 'var(--radix-accordion-content-height)'
          },
          to: {
            height: '0'
          }
        },
        'fade-in': {
          from: {
            opacity: '0',
            transform: 'translateY(8px)'
          },
          to: {
            opacity: '1',
            transform: 'translateY(0)'
          }
        },
        'hero-film-drift': {
          '0%': { transform: 'translate(0, 0)' },
          '50%': { transform: 'translate(0.15%, 0.08%)' },
          '100%': { transform: 'translate(0, 0)' }
        },
        'word-appear': {
          from: {
            opacity: '0',
            transform: 'translateY(20px)'
          },
          to: {
            opacity: '1',
            transform: 'translateY(0)'
          }
        },
        'backdrop-blur-in': {
          '0%': { backdropFilter: 'blur(0px)' },
          '100%': { backdropFilter: 'blur(24px)' }
        },
        'modal-appear': {
          '0%': {
            opacity: '0',
            transform: 'translateY(28%) scale(1.08)'
          },
          '100%': {
            opacity: '1',
            transform: 'translateY(0) scale(1)'
          }
        },
        'dialog-content-appear': {
          '0%': {
            opacity: '0',
            transform: 'translate(-50%, 28%) scale(1.08)'
          },
          '100%': {
            opacity: '1',
            transform: 'translate(-50%, -50%) scale(1)'
          }
        },
        'logo-appear': {
          '0%': {
            opacity: '0',
            transform: 'translateY(28%) scale(1.08)'
          },
          '100%': {
            opacity: '1',
            transform: 'translateY(0) scale(1)'
          }
        },
        'cta-bounce-in': {
          from: {
            opacity: '0',
            transform: 'scale(0.85)'
          },
          to: {
            opacity: '1',
            transform: 'scale(1)'
          }
        },
        'letter-appear': {
          from: {
            opacity: '0'
          },
          to: {
            opacity: '1'
          }
        },
        'subtitle-fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' }
        },
        'cta-reveal': {
          from: {
            opacity: '0',
            transform: 'scale(0.2)'
          },
          to: {
            opacity: '1',
            transform: 'scale(1)'
          }
        },
        'page-cover-down': {
          '0%': { height: '0' },
          '100%': { height: '100%' }
        },
        'page-title-reveal': {
          '0%': { opacity: '0', clipPath: 'inset(100% 0 0 0)' },
          '100%': { opacity: '1', clipPath: 'inset(0 0 0 0)' }
        },
        /* Header bar page title: bottom to top */
        'header-title-in': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        'page-object-appear': {
          '0%': { opacity: '0', transform: 'scale(0.85)' },
          '100%': { opacity: '1', transform: 'scale(1)' }
        },
        'page-card-content-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        }
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'fade-in': 'fade-in 0.3s ease-out',
        'hero-film-drift': 'hero-film-drift 18s ease-in-out infinite',
        'word-appear': 'word-appear 0.4s ease-out forwards',
        'backdrop-blur-in': 'backdrop-blur-in 0.4s ease-out forwards',
        'modal-appear': 'modal-appear 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'dialog-content-appear': 'dialog-content-appear 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'logo-appear': 'logo-appear 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'cta-bounce-in': 'cta-bounce-in 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        'letter-appear': 'letter-appear var(--letter-duration, 0.03s) ease-out forwards',
        'subtitle-fade-in': 'subtitle-fade-in 0.5s ease-out 1.5s forwards',
        'cta-reveal': 'cta-reveal 0.5s ease-out 1.5s forwards',
        'page-cover-down': 'page-cover-down 1.2s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'page-title-reveal': 'page-title-reveal 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'header-title-in': 'header-title-in 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'page-object-appear': 'page-object-appear 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'page-card-content-up': 'page-card-content-up 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards'
      },
      fontFamily: {
        sans: [
          'Outfit',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'Noto Sans',
          'sans-serif'
        ],
        serif: [
          'ui-serif',
          'Georgia',
          'Cambria',
          'Times New Roman',
          'Times',
          'serif'
        ],
        mono: [
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Monaco',
          'Consolas',
          'Liberation Mono',
          'Courier New',
          'monospace'
        ]
      },
      boxShadow: {
        '2xs': 'var(--shadow-2xs)',
        xs: 'var(--shadow-xs)',
        sm: 'var(--shadow-sm)',
        DEFAULT: 'var(--shadow)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        xl: 'var(--shadow-xl)',
        '2xl': 'var(--shadow-2xl)'
      }
    }
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;