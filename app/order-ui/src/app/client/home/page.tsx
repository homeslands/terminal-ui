import { useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { Helmet } from 'react-helmet'
import { ChevronDown, Ticket, UtensilsCrossed } from 'lucide-react'

import { Button } from '@/components/ui'
import { useIsMobile } from '@/hooks'
import { ROUTE, youtubeVideoId } from '@/constants'
import { TerminalLogo } from '@/assets/images'
import { StoreCarousel, YouTubeVideoSection, NewsCarousel, HighlightMenuCarousel, HoursTimetable } from './components'

// Animation Variants
const fadeInVariants = {
  hidden: { opacity: 0, y: 50 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.8, ease: 'easeOut' },
  },
}

// Temporarily hidden per request — kept (not removed); flip to true to restore.
const SHOW_MEMBERSHIP_VIDEO = false
const SHOW_NEWS_SECTION = false

export default function HomePage() {
  const { t } = useTranslation('home')
  const { t: tHelmet } = useTranslation('helmet')
  const isMobile = useIsMobile()

  // scroll to the top of the page
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  return (
    <>
      <Helmet>
        <meta charSet="utf-8" />
        <title>{tHelmet('helmet.home.title')}</title>
        <meta name="description" content={tHelmet('helmet.home.title')} />
      </Helmet>

      <div className="flex flex-col">
        {/* ════════════ 1. HERO ════════════ */}
        {/* Pulled up under the transparent sticky header so the brick wall shows through */}
        <section className="brick-wall relative -mt-[calc(88px+env(safe-area-inset-top))] flex min-h-[100svh] items-center overflow-hidden px-4 pb-20 pt-[calc(96px+env(safe-area-inset-top))] md:pt-32">
          {/* Background overlay tint */}
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(180deg, rgba(20,12,4,.78) 0%, rgba(15,10,4,.82) 60%, rgba(8,5,2,.92) 100%)',
            }}
          />

          {/* Rising steam */}
          <div className="steam" style={{ left: '8%' }} />
          <div className="steam" style={{ left: '32%', animationDelay: '-2s' }} />
          <div className="steam" style={{ left: '68%', animationDelay: '-4s' }} />
          <div className="steam" style={{ left: '88%', animationDelay: '-1s' }} />

          <motion.div
            className="relative z-10 mx-auto flex w-full max-w-6xl flex-col items-center px-1 md:px-6"
            initial="hidden"
            animate="visible"
            variants={fadeInVariants}
          >
            {/* The swaying wood signboard */}
            <div className="signboard sway relative w-full max-w-3xl px-6 py-8 md:px-12 md:py-12">
              <span className="rivet" style={{ top: '10px', left: '10px' }} />
              <span className="rivet" style={{ top: '10px', right: '10px' }} />
              <span className="rivet" style={{ bottom: '10px', left: '10px' }} />
              <span className="rivet" style={{ bottom: '10px', right: '10px' }} />

              <div className="signboard-inner text-center">
                {/* Brand logo */}
                <img
                  src={TerminalLogo}
                  alt={t('home.hero.title', 'THE TERMINAL')}
                  className="mx-auto mb-5 h-24 w-24 rounded-full object-cover ring-1 ring-landing-brass/30 md:h-28 md:w-28"
                />
                {/* Established eyebrow */}
                <div className="mb-3 flex items-center justify-center gap-3">
                  <span
                    className="h-px w-10 md:w-16"
                    style={{ background: 'linear-gradient(90deg, transparent, #c88d2b 70%, #ffe9a3)' }}
                  />
                  <span className="text-grad-accent text-[10px] font-medium tracking-[.4em] md:text-[11px]">
                    {t('home.hero.established')}
                  </span>
                  <span
                    className="h-px w-10 md:w-16"
                    style={{ background: 'linear-gradient(90deg, #ffe9a3, #c88d2b 30%, transparent)' }}
                  />
                </div>

                <h1
                  className="text-grad-primary whitespace-nowrap font-black uppercase leading-[.9] tracking-[.04em]"
                  style={{ fontSize: 'clamp(1.75rem, 9vw, 4.5rem)' }}
                >
                  {t('home.hero.title', 'THE TERMINAL')}
                </h1>

                <div className="brand-divider mx-auto mt-5" style={{ maxWidth: '320px' }} />

                <div
                  className="text-grad-accent mt-5 font-medium uppercase tracking-[.32em]"
                  style={{ fontSize: 'clamp(.78rem, 1.2vw, 1rem)' }}
                >
                  {t('home.hero.subtitle')}
                </div>
              </div>
            </div>

            {/* Tagline */}
            <p
              className="mt-10 max-w-2xl text-center font-italic italic leading-relaxed text-landing-quartz/80"
              style={{ fontSize: 'clamp(1.05rem, 1.6vw, 1.35rem)' }}
            >
              {t('home.homeDescription')}
            </p>

            {/* CTAs */}
            <div className="mt-9 flex w-full max-w-sm flex-col gap-4 sm:max-w-none sm:flex-row sm:justify-center md:mt-11">
              <NavLink
                to={ROUTE.CLIENT_MENU}
                className="btn-brass-outline min-w-[220px] px-7 py-4 text-[11px] md:px-9 md:text-[12px]"
              >
                <UtensilsCrossed className="mr-3 h-4 w-4" />
                {t('home.hero.exploreMenu')}
              </NavLink>
              <NavLink
                to={ROUTE.CLIENT_BOOKING}
                className="btn-brass min-w-[220px] px-7 py-4 text-[11px] md:px-9 md:text-[12px]"
              >
                <Ticket className="mr-3 h-4 w-4" />
                {t('home.hero.reserve')}
              </NavLink>
            </div>

            {/* Scroll cue */}
            <div className="mt-12 flex flex-col items-center gap-2 text-landing-brass-light/85 md:mt-16">
              <span className="font-mono text-[10px] tracking-[.32em]">{t('home.hero.scroll')}</span>
              <ChevronDown className="h-4 w-4 animate-bounce" />
            </div>
          </motion.div>
        </section>

        {/* ════════════ 2. ABOUT ════════════ */}
        <section className="relative bg-landing-canvas px-4 py-20 md:px-12 md:py-28">
          <div className="container relative mx-auto grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
            {/* LEFT: tilted rusted-frame photo carousel */}
            <motion.div
              className="relative mx-auto w-full min-w-0 max-w-xl lg:max-w-none"
              style={{ transform: 'rotate(-1.6deg)' }}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.2 }}
              variants={fadeInVariants}
            >
              <div className="rusted-frame">
                <span className="rivet" style={{ top: '6px', left: '6px' }} />
                <span className="rivet" style={{ top: '6px', right: '6px' }} />
                <span className="rivet" style={{ bottom: '6px', left: '6px' }} />
                <span className="rivet" style={{ bottom: '6px', right: '6px' }} />
                <div className="relative overflow-hidden">
                  <StoreCarousel />
                  <div
                    className="pointer-events-none absolute inset-0"
                    style={{ boxShadow: 'inset 0 0 80px rgba(0,0,0,.55)' }}
                  />
                </div>
              </div>
            </motion.div>

            {/* RIGHT: story */}
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.2 }}
              variants={fadeInVariants}
            >
              <div className="text-[10px] font-medium uppercase tracking-[.25em] text-landing-rust sm:text-[11px] sm:tracking-[.4em]">
                — {t('home.about.eyebrow')}
              </div>

              <h2 className="text-grad-on-paper mt-4 font-display text-fluid-h2 font-black uppercase leading-[.95] tracking-[.02em]">
                {t('home.about.title')}
              </h2>

              <div className="brand-divider-rust mt-6" style={{ maxWidth: '220px' }} />

              <div className="mt-7 space-y-5 text-sm leading-relaxed text-landing-ink/85 md:text-base">
                <p>{t('home.homeDescription')}</p>
                <p>{t('home.homeDescription2')}</p>
              </div>

              {/* Pull quote */}
              <figure className="mt-8 border-l-2 border-landing-rust pl-5">
                <blockquote className="font-italic text-base italic leading-snug text-landing-rust-deep sm:text-lg md:text-xl">
                  “ {t('home.about.quote')} ”
                </blockquote>
                <figcaption className="mt-3 text-[10px] font-medium uppercase tracking-[.28em] text-landing-rust sm:text-[11px] sm:tracking-[.32em]">
                  — {t('home.about.author')}
                </figcaption>
              </figure>

              {/* Stats */}
              <div className="mt-9 grid grid-cols-3 gap-3">
                {[
                  { value: t('home.about.yearsValue'), label: t('home.about.yearsLabel') },
                  { value: t('home.about.dishesValue'), label: t('home.about.dishesLabel') },
                  { value: t('home.about.seatsValue'), label: t('home.about.seatsLabel') },
                ].map((stat) => (
                  <div key={stat.label} className="paper-card rounded-md px-3 py-4 text-center">
                    <div className="text-grad-on-paper font-display text-fluid-stat font-black leading-none">
                      {stat.value}
                    </div>
                    <div className="mt-1 text-[9px] font-medium uppercase leading-tight tracking-[.12em] text-landing-ink/65 sm:text-[10px] sm:tracking-[.24em]">
                      {stat.label}
                    </div>
                  </div>
                ))}
              </div>

              <NavLink to={ROUTE.ABOUT} className="mt-8 block sm:inline-block">
                <Button className="w-full tracking-[.18em] uppercase sm:w-auto">{t('home.learnMore')}</Button>
              </NavLink>
            </motion.div>
          </div>
        </section>

        {/* ════════════ 3. MENU HIGHLIGHT ════════════ */}
        <section className="bg-landing-iron px-4 py-16 md:px-12 md:py-24">
          <motion.div
            className="container mx-auto"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.1 }}
            variants={fadeInVariants}
          >
            <header className="mb-10 text-center">
              <div className="mb-4 flex items-center justify-center gap-3">
                <span
                  className="h-px w-10 md:w-16"
                  style={{ background: 'linear-gradient(90deg, transparent, #c88d2b 70%, #ffe9a3)' }}
                />
                <span className="text-grad-accent text-[11px] font-medium uppercase tracking-[.4em]">
                  — {t('home.billOfFare')} —
                </span>
                <span
                  className="h-px w-10 md:w-16"
                  style={{ background: 'linear-gradient(90deg, #ffe9a3, #c88d2b 30%, transparent)' }}
                />
              </div>
              <h2 className="text-grad-primary font-display text-fluid-display p-2 font-black uppercase leading-none tracking-tight">
                {t('home.menuTitle')}
              </h2>
              <div className="brand-divider mx-auto mt-5" style={{ maxWidth: '280px' }} />
              <p className="mx-auto mt-5 max-w-xl font-italic text-base italic text-landing-quartz/80">
                {t('home.menuSubtitle')}
              </p>
            </header>

            <div className={isMobile ? 'h-[18rem]' : 'h-[24rem]'}>
              <HighlightMenuCarousel />
            </div>

            <div className="mt-6 flex justify-center">
              <NavLink
                to={ROUTE.CLIENT_MENU}
                className="btn-brass-outline px-7 py-4 text-[11px] md:px-9 md:text-[12px]"
              >
                {t('home.viewMenu')}
              </NavLink>
            </div>
          </motion.div>
        </section>

        {/* ════════════ 4. LOCATION — Hours of Operation ════════════ */}
        <section className="bg-landing-canvas px-4 py-20 md:px-12 md:py-28">
          <div className="container mx-auto">
            <motion.header
              className="text-center"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.2 }}
              variants={fadeInVariants}
            >
              <div className="text-[11px] font-medium uppercase tracking-[.4em] text-landing-rust">
                — {t('home.location.eyebrow')} —
              </div>
              <h2 className="text-grad-on-paper mt-4 font-display text-fluid-section font-black uppercase leading-[.95] tracking-tight">
                {t('home.location.title')}
              </h2>
              <div className="brand-divider-rust mx-auto mt-5" style={{ maxWidth: '280px' }} />
              <p className="mx-auto mt-5 max-w-xl font-italic text-base italic text-landing-ink/75">
                {t('home.location.subtitle')}
              </p>
            </motion.header>

            {/* Hours timetable */}
            <HoursTimetable />
          </div>
        </section>

        {/* ════════════ 5. VIDEO — Member registration guide (hidden, kept) ════════════ */}
        {SHOW_MEMBERSHIP_VIDEO && (
          <YouTubeVideoSection
            videoId={youtubeVideoId}
            title={t('home.videoSection.title', 'Khám phá câu chuyện THE TERMINAL')}
          />
        )}

        {/* ════════════ 6. NEWS — News & events (hidden, kept) ════════════ */}
        {SHOW_NEWS_SECTION && (
          <section className="container mx-auto px-4 py-12 md:px-6">
            <h2 className="text-center font-display text-2xl font-extrabold uppercase tracking-[.12em] text-primary md:text-3xl">
              {t('home.newsSection.title')}
            </h2>
            <div className="mt-6">
              <NewsCarousel />
            </div>
          </section>
        )}
      </div>
    </>
  )
}
