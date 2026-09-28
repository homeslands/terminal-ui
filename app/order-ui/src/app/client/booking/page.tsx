import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Undo, Phone } from 'lucide-react'
import { Helmet } from 'react-helmet'

import { FeaturedServices3, FeaturedServices4 } from '@/assets/images'
import { phone, fanpageUrl } from '@/constants'
import { CreateTableBookingForm } from '@/components/app/form'

// Build a tel: href from a display hotline (e.g. "0123 456 789" -> "tel:+84123456789").
const toTelHref = (raw: string): string => {
  if (!raw) return 'tel:'
  const cleaned = raw.replace(/[^\d+]/g, '')
  if (cleaned.startsWith('+')) return `tel:${cleaned}`
  if (cleaned.startsWith('0')) return `tel:+84${cleaned.slice(1)}`
  return `tel:${cleaned}`
}

export default function BookingPage() {
  const { t } = useTranslation('booking')

  // use useEffect to scroll to the top of the page
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  const featuredServices = [
    {
      key: 'service-1',
      image: FeaturedServices3,
      title: t('booking.partyPersonal'),
      descriptions: [
        t('booking.partyPersonalDescription'),
        t('booking.partyPersonalThemeDescription'),
        t('booking.partyPersonalDecorationDescription'),
      ],
    },
    {
      key: 'service-2',
      image: FeaturedServices4,
      title: t('booking.partyGroup'),
      descriptions: [
        t('booking.partyGroupDescription'),
        t('booking.partyGroupDescription2'),
        t('booking.partyGroupDescription3'),
      ],
    }
  ]

  return (
    <div className="min-h-screen">
      <Helmet>
        <meta charSet="utf-8" />
        <title>{t('booking.title')}</title>
        <meta name="description" content={t('booking.subtitle')} />
      </Helmet>

      {/* Section 1 — Booking form */}
      <section className="relative px-2 py-20 bg-landing-iron md:px-8 md:py-18 gap-8">
        <header className="relative mx-auto mb-12 max-w-6xl text-center">
          <div className="flex gap-3 justify-center items-center mb-4">
            <span className="w-10 h-px menu-rule-left md:w-16" />
            <span className="text-grad-accent text-[11px] font-medium uppercase tracking-[.4em]">
              — {t('booking.eyebrow')} —
            </span>
            <span className="w-10 h-px menu-rule-right md:w-16" />
          </div>
          <h1 className="text-grad-primary font-display p-2 text-fluid-menu-title font-black uppercase leading-none tracking-tight">
            {t('booking.title')}
          </h1>
          <div className="mx-auto mt-5 w-full brand-divider max-w-menu-divider" />
          <p className="text-fluid-menu-subtitle mx-auto mt-5 max-w-xl font-italic italic text-landing-quartz/75">
            {t('booking.subtitle')}
          </p>
        </header>
        <div className="flex flex-col gap-16 items-center mx-auto max-w-6xl">
          {/* Click-to-call CTA */}
          <a
            href={toTelHref(phone)}
            className="inline-flex gap-3 items-center px-8 py-4 text-sm font-semibold uppercase rounded-md border transition-colors border-landing-brass/50 bg-landing-brass/10 tracking-[.18em] text-landing-brass-light hover:bg-landing-brass hover:text-landing-iron"
          >
            <Phone className="w-4 h-4" />
            <span>{t('booking.callToBook')}</span>
            <span className="font-bold tracking-normal">{phone}</span>
          </a>

          <CreateTableBookingForm />
        </div>
      </section>

      {/* Section 2 — Booking information / featured services */}
      <section className="relative px-2 py-20 bg-landing-iron-2 md:px-8 md:py-24">
        <header className="relative mx-auto mb-12 max-w-6xl text-center">
          <div className="flex gap-3 justify-center items-center mb-4">
            <span className="w-10 h-px menu-rule-left md:w-16" />
            <span className="text-grad-accent text-[11px] font-medium uppercase tracking-[.4em]">
              — {t('booking.servicesEyebrow')} —
            </span>
            <span className="w-10 h-px menu-rule-right md:w-16" />
          </div>
          <h2 className="text-grad-primary font-display p-2 text-fluid-menu-title font-black uppercase leading-none tracking-tight">
            {t('booking.servicesTitle')}
          </h2>
          <div className="mx-auto mt-5 w-full brand-divider max-w-menu-divider" />
        </header>

        <div className="flex flex-col gap-14 items-center mx-auto max-w-6xl">
          {featuredServices.map((service) => {
            const hasImage = Boolean(service.image)

            return service.key === 'service-3' ? (
              <div
                key={service.key}
                className="flex flex-col gap-6 items-center w-full text-center"
              >
                <div className="flex flex-col gap-3">
                  <h3 className="text-grad-accent font-display text-xl font-extrabold uppercase tracking-wide sm:text-2xl">
                    {service.title}
                  </h3>
                  <p className="text-base leading-relaxed text-landing-quartz/75 sm:text-lg">
                    {service.descriptions[0]}
                  </p>
                  <a
                    href={toTelHref(phone)}
                    className="text-grad-primary font-display text-2xl font-black tracking-wide transition-opacity sm:text-3xl hover:opacity-80"
                  >
                    {phone}
                  </a>
                  <p className="text-base leading-relaxed text-landing-quartz/75 sm:text-lg">
                    {service.descriptions[1]}
                  </p>
                </div>
                {hasImage && (
                  <div className="flex relative flex-col gap-4 items-center">
                    <div className="flex justify-center w-full max-w-xs sm:max-w-sm">
                      <div className="overflow-hidden w-full rounded-2xl border aspect-square border-landing-brass/20 bg-landing-iron">
                        <img
                          src={service.image}
                          alt={service.title}
                          className="object-cover w-48 cursor-pointer"
                          onClick={() => window.open(fanpageUrl, '_blank')}
                        />
                      </div>
                    </div>
                    <div className="flex relative flex-col gap-2 items-center pt-6 w-full">
                      <Undo className="absolute right-0 bottom-6 w-16 h-16 font-thin origin-bottom-right text-landing-quartz/40 rotate-[75deg]" />
                      <span className="text-lg font-semibold text-landing-brass-light">
                        {t('booking.clickHere')}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div
                key={service.key}
                className="flex flex-col gap-6 items-center mx-auto w-full max-w-4xl text-center lg:gap-10 lg:flex-row lg:items-start lg:text-left"
              >
                {hasImage && (
                  <div className="flex justify-center w-full max-w-xs sm:max-w-sm lg:w-1/3 lg:max-w-md">
                    <div className="overflow-hidden w-full rounded-2xl border aspect-square border-landing-brass/20 bg-landing-iron">
                      <img
                        src={service.image}
                        alt={service.title}
                        className="object-cover w-full h-full"
                      />
                    </div>
                  </div>
                )}
                <div className="flex flex-col gap-3 items-start w-full text-left lg:w-2/3">
                  <div className="flex gap-3 items-center">
                    <span
                      className="w-1 h-9 rounded-full bg-landing-brass"
                      aria-hidden="true"
                    />
                    <h3 className="text-grad-accent font-display text-xl font-extrabold uppercase tracking-wide">
                      {service.title}
                    </h3>
                  </div>
                  {service.descriptions.map((description) => (
                    <p
                      key={description.toString()}
                      className="text-lg leading-relaxed text-landing-quartz/75"
                    >
                      {description}
                    </p>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
