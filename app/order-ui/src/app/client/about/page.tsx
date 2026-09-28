import { useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { Helmet } from 'react-helmet'

import { Button } from '@/components/ui'
import { ROUTE } from '@/constants'
import { HighlightMenu6, HighlightMenu7, HighlightMenu8, HighlightMenu9 } from '@/assets/images'
import { StoreCarousel } from '../home/components'

// Animation Variants
const fadeInVariants = {
  hidden: { opacity: 0, y: 50 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.8, ease: 'easeOut' },
  },
}

export default function AboutPage() {
  const { t } = useTranslation('about')

  // scroll to the top of the page
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  const pillars = [
    {
      key: 'vision',
      title: t('about.vision'),
      description: t('about.visionDescription'),
    },
    {
      key: 'mission',
      title: t('about.mission'),
      description: t('about.missionDescription'),
    },
  ]

  const featuredServices = [
    {
      key: 'service-1',
      image: HighlightMenu6,
      title: t('about.featuredServicesTitle1'),
      descriptions: [
        t('about.featuredServicesDescription1'),
        t('about.featuredServicesDescription2'),
      ],
    },
    {
      key: 'service-2',
      image: HighlightMenu7,
      title: t('about.featuredServicesTitle2'),
      descriptions: [t('about.featuredServicesDescription3')],
    },
    {
      key: 'service-3',
      image: HighlightMenu8,
      title: t('about.featuredServicesTitle3'),
      descriptions: [t('about.featuredServicesDescription4')],
    },
    {
      key: 'service-4',
      image: HighlightMenu9,
      title: t('about.featuredServicesTitle4'),
      descriptions: [t('about.featuredServicesDescription5')],
    },
  ]

  return (
    <>
      <Helmet>
        <meta charSet="utf-8" />
        <title>{t('about.title')}</title>
        <meta name="description" content={t('about.description')} />
      </Helmet>

      <div className="flex flex-col bg-landing-canvas">
        {/* ════════════ 1. ABOUT — story + rusted-frame carousel ════════════ */}
        <section className="relative bg-landing-canvas px-4 py-16 md:px-12 md:py-24 min-h-screen">
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
                — {t('about.storyEyebrow')}
              </div>

              <h1 className="text-grad-on-paper mt-4 font-display text-fluid-h2 font-black uppercase leading-[.95] tracking-[.02em]">
                {t('about.title')}
              </h1>

              <div className="brand-divider-rust mt-6" style={{ maxWidth: '220px' }} />

              <div className="mt-7 space-y-5 text-sm leading-relaxed text-landing-ink/85 md:text-base">
                <p>{t('about.description')}</p>
                <p>{t('about.description2')}</p>
              </div>

              {/* Pull quote */}
              <figure className="mt-8 border-l-2 border-landing-rust pl-5">
                <blockquote className="font-italic text-base italic leading-snug text-landing-rust-deep sm:text-lg md:text-xl">
                  “ {t('about.quote')} ”
                </blockquote>
                <figcaption className="mt-3 text-[10px] font-medium uppercase tracking-[.28em] text-landing-rust sm:text-[11px] sm:tracking-[.32em]">
                  — {t('about.author')}
                </figcaption>
              </figure>

              {/* Stats */}
              <div className="mt-9 grid grid-cols-3 gap-3">
                {[
                  { value: t('about.yearsValue'), label: t('about.yearsLabel') },
                  { value: t('about.dishesValue'), label: t('about.dishesLabel') },
                  { value: t('about.seatsValue'), label: t('about.seatsLabel') },
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

              <NavLink to={ROUTE.CLIENT_MENU} className="mt-8 block sm:inline-block">
                <Button className="w-full tracking-[.18em] uppercase sm:w-auto">{t('about.learnMore')}</Button>
              </NavLink>
            </motion.div>
          </div>
        </section>

        {/* ════════════ 2. VISION & MISSION ════════════ */}
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
                  — {t('about.vision')} & {t('about.mission')} —
                </span>
                <span
                  className="h-px w-10 md:w-16"
                  style={{ background: 'linear-gradient(90deg, #ffe9a3, #c88d2b 30%, transparent)' }}
                />
              </div>
            </header>

            <div className="grid gap-6 lg:grid-cols-2">
              {pillars.map(({ key, title, description }) => (
                <div
                  key={key}
                  className="flex flex-col gap-4 rounded-2xl border border-landing-brass/20 bg-landing-canvas/[.04] p-6 md:p-8"
                >
                  <div className="flex items-center gap-3">
                    <span className="h-10 w-1 shrink-0 rounded-full bg-landing-rust" aria-hidden="true" />
                    <h2 className="text-grad-primary font-display text-2xl font-black uppercase tracking-tight md:text-3xl">
                      {title}
                    </h2>
                  </div>
                  <p className="text-sm leading-relaxed text-landing-quartz/80 md:text-base">
                    {description}
                  </p>
                </div>
              ))}
            </div>
          </motion.div>
        </section>

        {/* ════════════ 3. FEATURED SERVICES ════════════ */}
        <section className="bg-landing-canvas px-4 py-16 md:px-12 md:py-24">
          <motion.div
            className="container mx-auto"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.1 }}
            variants={fadeInVariants}
          >
            <header className="mb-12 flex flex-col items-center gap-3 text-center">
              <div className="text-[11px] font-medium uppercase tracking-[.4em] text-landing-rust">
                — {t('about.featuredServices')} —
              </div>
              <div className="brand-divider-rust mx-auto" style={{ maxWidth: '220px' }} />
            </header>

            <div className="flex flex-col gap-12 lg:gap-16">
              {featuredServices.map((service, index) => {
                const isReversed = index % 2 === 1

                return (
                  <div
                    key={service.key}
                    className={`flex flex-col items-center gap-6 text-center lg:items-start lg:gap-10 lg:text-left ${
                      isReversed ? 'lg:flex-row-reverse' : 'lg:flex-row'
                    }`}
                  >
                    <div className="flex w-full max-w-xs shrink-0 justify-center sm:max-w-sm lg:w-1/3 lg:max-w-md">
                      <div className="aspect-square w-full overflow-hidden rounded-2xl border border-landing-rust/20 bg-landing-canvas-deep">
                        <img
                          src={service.image}
                          alt={service.title}
                          className="h-full w-full object-cover"
                          style={{ filter: 'sepia(.35) saturate(.95) contrast(1.03)' }}
                        />
                      </div>
                    </div>
                    <div
                      className={`flex w-full flex-col items-center gap-3 text-center lg:flex-1 ${
                        isReversed ? 'lg:items-end lg:text-right' : 'lg:items-start lg:text-left'
                      }`}
                    >
                      <h3 className="text-xl font-bold text-landing-rust sm:text-2xl">{service.title}</h3>
                      {service.descriptions.map((description) => (
                        <p
                          key={description}
                          className="text-base leading-relaxed text-landing-ink/85 sm:text-lg"
                        >
                          {description}
                        </p>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </motion.div>
        </section>
      </div>
    </>
  )
}
