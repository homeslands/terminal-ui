/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
  	container: {
  		center: true,
  		padding: {
  			DEFAULT: '1rem',
  			sm: '1rem',
  			lg: '2rem',
  			xl: '2rem',
  			'2xl': '2rem',
  		},
  		screens: {
  			sm: '640px',
  			md: '768px',
  			lg: '1024px',
  			xl: '1280px',
  			'2xl': '1536px',
  		},
  	},
  	extend: {
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		colors: {
			landing: {
				canvas:        'rgb(var(--landing-canvas) / <alpha-value>)',
				'canvas-deep': 'rgb(var(--landing-canvas-deep) / <alpha-value>)',
				iron:          'rgb(var(--landing-iron) / <alpha-value>)',
				'iron-2':      'rgb(var(--landing-iron-2) / <alpha-value>)',
				rust:          'rgb(var(--landing-rust) / <alpha-value>)',
				'rust-deep':   'rgb(var(--landing-rust-deep) / <alpha-value>)',
				brass:         'rgb(var(--landing-brass) / <alpha-value>)',
				'brass-light': 'rgb(var(--landing-brass-light) / <alpha-value>)',
				'brass-pale':  'rgb(var(--landing-brass-pale) / <alpha-value>)',
				brick:         'rgb(var(--landing-brick) / <alpha-value>)',
				leather:       'rgb(var(--landing-leather) / <alpha-value>)',
				patina:        'rgb(var(--landing-patina) / <alpha-value>)',
				quartz:        'rgb(var(--landing-quartz) / <alpha-value>)',
				copper:        'rgb(var(--landing-copper) / <alpha-value>)',
				cream:         'rgb(var(--landing-cream) / <alpha-value>)',
				// Theme-aware body text on parchment (dark in light mode, cream at night)
				ink:           'rgb(var(--landing-ink) / <alpha-value>)',
				// Menu page (client) — solid rust label for search field icons
				'rust-label':  'var(--landing-rust-label)',
			},
			pos: {
				bg:       'rgb(var(--pos-bg) / <alpha-value>)',
				surface:  'rgb(var(--pos-surface) / <alpha-value>)',
				card:     'rgb(var(--pos-card) / <alpha-value>)',
				input:    'rgb(var(--pos-input) / <alpha-value>)',
				elevated: 'rgb(var(--pos-elevated) / <alpha-value>)',
				border:   'rgb(var(--pos-border) / <alpha-value>)',
				hover:    'rgb(var(--pos-hover) / <alpha-value>)',
				faint:    'rgb(var(--pos-faint) / <alpha-value>)',
				dim:      'rgb(var(--pos-dim) / <alpha-value>)',
				muted:    'rgb(var(--pos-muted) / <alpha-value>)',
				text:     'rgb(var(--pos-text) / <alpha-value>)',
				gold:     'rgb(var(--pos-gold) / <alpha-value>)',
			},
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			'light-beige': '#f1f3f4',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
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
  			}
  		},
  		fontSize: {
  			'fluid-h2': 'clamp(1.75rem, 6vw, 3.25rem)',
  			'fluid-stat': 'clamp(1.5rem, 6vw, 2.5rem)',
  			'fluid-display': 'clamp(2.5rem, 8vw, 5rem)',
  			'fluid-section': 'clamp(2rem, 6vw, 3.5rem)',
  			'fluid-h3': 'clamp(1.75rem, 3vw, 2.75rem)',
  			// Client menu page — fluid type scale
  			'fluid-menu-title': 'clamp(2.75rem, 8vw, 6rem)',
  			'fluid-menu-subtitle': 'clamp(.95rem, 1.3vw, 1.1rem)',
  			'fluid-menu-section': 'clamp(2.5rem, 5vw, 4rem)',
  			'fluid-menu-item': 'clamp(0.75rem, 2.5vw, 0.95rem)',
  			'fluid-menu-item-desc': 'clamp(11px, 1.8vw, 13px)'
  		},
  		maxWidth: {
  			// Client menu page container widths
  			'menu-divider': '280px',
  			'menu-bar': '1100px'
  		},
  		fontFamily: {
  			beVietNam: [
  				'BeVietnam',
  				'sans-serif'
  			],
  			roboto: [
  				'Roboto',
  				'sans-serif'
  			],
  			sans: [
  				'sans-serif'
  			],
  			inter: [
  				'Inter',
  				'sans-serif'
  			],
  			display: [
  				'Oswald',
  				'sans-serif'
  			],
  			script: [
  				'Pinyon Script',
  				'cursive'
  			],
  			italic: [
  				'Cormorant Garamond',
  				'serif'
  			]
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
  			}
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out'
  		},
		backgroundImage: {
			'gradient': 'linear-gradient(0deg, #c88d2b 0%, #ffe9a3 50%, #c88d2b 100%)',
			'hero-brick': `linear-gradient(rgba(0,0,0,.55), rgba(0,0,0,.6)), url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='80'><rect width='160' height='80' fill='%23A0522D'/><g fill='none' stroke='%231a0e07' stroke-width='2'><path d='M0 40 H160 M0 0 H160 M0 80 H160 M40 0 V40 M120 0 V40 M0 40 V80 M80 40 V80 M160 40 V80'/></g><g fill='%23000' opacity='.18'><rect x='2' y='2' width='36' height='36'/><rect x='42' y='2' width='76' height='36'/><rect x='122' y='2' width='36' height='36'/></g></svg>")`,
			'hero-overlay': 'linear-gradient(180deg, rgba(20,12,4,.78) 0%, rgba(15,10,4,.82) 60%, rgba(8,5,2,.92) 100%)'
		},
		backgroundSize: {
			'brick-tile': 'auto, 160px 80px'
		},
		boxShadow: {
        'gold': '0 0 8px rgba(255, 220, 120, 0.25)',
      }
  	}
  },
  plugins: [require('tailwindcss-animate')],
}
