import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Mail, Phone, Facebook, MapPin } from 'lucide-react'

import GoogleMap from './google-map'
import { TerminalLogo } from '@/assets/images'
import { FooterSection, ROUTE, MAP_LOCATION_URL, PAYMENT_LOGOS } from '@/constants'
import { phone, mail, fanpageUrl, registrationPhone } from '@/constants'
import { cn } from '@/lib'

// Newsletter / member-registration form hidden per request — kept; flip to restore.
const SHOW_NEWSLETTER = false

export function ClientFooter() {
  const { t } = useTranslation('sidebar')
  const navigator = useNavigate()
  const [newsletterEmail, setNewsletterEmail] = useState('')
  const [newsletterSent, setNewsletterSent] = useState(false)

  const handleNewsletterSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setNewsletterEmail('')
    setNewsletterSent(true)
  }

  const getCopyright = () => {
    const currentYear = new Date().getFullYear()
    const startYear = FooterSection.START_YEAR
    if (currentYear === startYear) {
      return `© ${currentYear} · ${FooterSection.BUSINESS_NAME}`
    }
    return `© ${startYear}-${currentYear} · ${FooterSection.BUSINESS_NAME} — All Journeys Reserved`
  }

  return (
    <footer className={cn(
      'relative brick-wall pt-16 pb-8 px-5 md:px-12 mb-[64px] md:mb-0',
      'text-landing-quartz'
    )}>
      <div className="container relative z-10 mx-auto max-w-8xl">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-4 mb-8">

          {/* Column 1: Brand */}
          <div className="flex flex-col">
            <div className="flex items-center gap-3">
              <img
                src={TerminalLogo}
                alt="THE TERMINAL"
                className="object-cover w-10 h-10 rounded-full"
              />
              <div className="leading-tight">
                <div className="text-grad-accent font-bold tracking-[.28em] text-[13px]">
                  THE TERMINAL
                </div>
                <div className="text-landing-quartz/55 text-[10px] tracking-[.32em] mt-0.5 uppercase">
                  CAFE · EUROPEAN KITCHEN
                </div>
              </div>
            </div>
            <p className="mt-5 text-landing-quartz/65 leading-relaxed italic font-italic text-[14px] md:text-[15px]">
              A rail-house café for the unhurried — serving the dishes of old Europe under brass lanterns and slow-turning cogs.
            </p>

            {/* Payment partners */}
            <div className="gap-3 py-4 sm:flex-row sm:items-center">
              <span className="text-[11px] mb-4 text-landing-brass-light uppercase tracking-[.22em] font-medium">
                {t('footer.paymentSupport')}
              </span>
              <div className="flex flex-wrap items-center gap-3 mt-5">
                {PAYMENT_LOGOS.map((logo) => (
                  <div
                    key={logo.alt}
                    className="flex items-center justify-center px-3 py-2 bg-white rounded-md"
                  >
                    <img src={logo.src} alt={logo.alt} className="object-contain h-6" />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Column 2: Connections / Quick Links */}
          <div>
            <div className="text-landing-brass-light uppercase tracking-[.28em] text-[11px] font-medium">
              {t('footer.introduction')}
            </div>
            <div className="brand-divider mt-3" style={{ maxWidth: '200px' }} />
            <ul className="mt-5 space-y-3 text-landing-quartz/80 text-[13px] md:text-[14px]">
              <li>
                <span
                  className="cursor-pointer hover:text-landing-brass-light transition-colors"
                  onClick={() => navigator(ROUTE.HOME)}
                >
                  {t('footer.home')}
                </span>
              </li>
              <li>
                <span
                  className="cursor-pointer hover:text-landing-brass-light transition-colors"
                  onClick={() => navigator(ROUTE.ABOUT)}
                >
                  {t('footer.aboutMe')}
                </span>
              </li>
              <li>
                <span
                  className="cursor-pointer hover:text-landing-brass-light transition-colors"
                  onClick={() => navigator(ROUTE.CLIENT_MENU)}
                >
                  {t('footer.menu')}
                </span>
              </li>
              <li>
                <span
                  className="cursor-pointer hover:text-landing-brass-light transition-colors"
                  onClick={() => navigator(ROUTE.CLIENT_BOOKING)}
                >
                  {t('footer.booking')}
                </span>
              </li>
            </ul>
          </div>

          {/* Column 3: Information & Policy - security */}
          <div>
            <div className="text-landing-brass-light uppercase tracking-[.28em] text-[11px] font-medium">
              {t('footer.information')}
            </div>
            <div className="brand-divider mt-3" style={{ maxWidth: '200px' }} />
            <ul className="mt-5 space-y-3 text-landing-quartz/80 text-[13px] md:text-[14px]">
              <li>
                <span
                  className="cursor-pointer hover:text-landing-brass-light transition-colors"
                  onClick={() => navigator(ROUTE.POLICY)}
                >
                  {t('footer.policy')}
                </span>
              </li>
              <li>
                <span
                  className="cursor-pointer hover:text-landing-brass-light transition-colors"
                  onClick={() => navigator(ROUTE.PAYMENT_CONDITION)}
                >
                  {t('footer.paymentCondition')}
                </span>
              </li>
              <li>
                <span
                  className="cursor-pointer hover:text-landing-brass-light transition-colors"
                  onClick={() => navigator(ROUTE.PAYMENT_METHOD)}
                >
                  {t('footer.paymentMethod')}
                </span>
              </li>
              <li>
                <span
                  className="cursor-pointer hover:text-landing-brass-light transition-colors"
                  onClick={() => navigator(ROUTE.DELIVERY)}
                >
                  {t('footer.delivery')}
                </span>
              </li>
            </ul>
          </div>

          {/* Column 4: Contact & Newsletter */}
          <div>
            <div className="text-landing-brass-light uppercase tracking-[.28em] text-[11px] font-medium">
              {t('footer.contact')}
            </div>
            <div className="brand-divider mt-3" style={{ maxWidth: '240px' }} />
            <div className="flex flex-col gap-3 mt-5">
              <div className="flex items-start gap-3">
                <Phone className="w-4 h-4 text-landing-brass-light mt-0.5 flex-shrink-0" />
                <div className="flex flex-col">
                  <span className="text-[11px] text-landing-quartz/55 uppercase tracking-[.16em] font-medium">
                    {t('footer.phoneNumber')}
                  </span>
                  <a
                    href={`tel:${phone}`}
                    className="text-landing-quartz/80 hover:text-landing-brass-light transition-colors text-[13px] md:text-[14px] font-medium"
                  >
                    {phone}
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Mail className="w-4 h-4 text-landing-brass-light mt-0.5 flex-shrink-0" />
                <div className="flex flex-col">
                  <span className="text-[11px] text-landing-quartz/55 uppercase tracking-[.16em] font-medium">
                    {t('footer.email')}
                  </span>
                  <a
                    href={`mailto:${mail}`}
                    className="text-landing-quartz/80 hover:text-landing-brass-light transition-colors text-[13px] md:text-[14px]"
                  >
                    {mail}
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Facebook className="w-4 h-4 text-landing-brass-light mt-0.5 flex-shrink-0" />
                <span
                  className="text-landing-quartz/80 hover:text-landing-brass-light transition-colors cursor-pointer text-[13px] md:text-[14px] font-medium"
                  onClick={() => window.open(fanpageUrl, '_blank')}
                >
                  {t('footer.fanpage')}
                </span>
              </div>

              {/* Location / Google Map */}
              <div className="mt-2">
                <div className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-landing-brass-light mt-0.5 flex-shrink-0" />
                  <span
                    className="text-landing-quartz/80 hover:text-landing-brass-light transition-colors cursor-pointer text-[13px] md:text-[14px] font-medium"
                    onClick={() => window.open(MAP_LOCATION_URL, '_blank')}
                  >
                    {t('footer.location')}
                  </span>
                </div>
                <div className="relative w-full h-32 mt-3 overflow-hidden rounded-md md:h-36 border border-landing-brass/20 bg-landing-iron">
                  <GoogleMap />
                </div>
              </div>
            </div>

            {/* Newsletter / member registration — hidden per request, kept */}
            {SHOW_NEWSLETTER && (
              <form className="flex flex-col gap-3 mt-6" onSubmit={handleNewsletterSubmit}>
                <div className="flex items-center gap-3 pb-2 border-b border-landing-brass/40">
                  <span className="text-landing-brass-light uppercase tracking-[.3em] text-[10px] font-medium shrink-0">
                    Wire
                  </span>
                  <input
                    type="email"
                    required
                    value={newsletterEmail}
                    onChange={(e) => setNewsletterEmail(e.target.value)}
                    placeholder="your wire address"
                    className="flex-1 bg-transparent outline-none text-landing-quartz placeholder:text-landing-quartz/35 py-2 text-[14px]"
                  />
                  <button
                    type="submit"
                    className="text-landing-brass-light hover:text-landing-brass-pale text-[12px] uppercase tracking-[.22em] font-medium"
                  >
                    Send →
                  </button>
                </div>
                {newsletterSent && (
                  <p className="text-landing-brass-light text-[11px] uppercase tracking-[.22em] font-medium">
                    ✓ Transmission received · stop ·
                  </p>
                )}
              </form>
            )}
          </div>
        </div>

        {/* Legal Info */}
        <div className="text-[9px] md:text-[11px] text-landing-quartz/55 space-y-1.5 tracking-[.16em] pt-6 border-t border-landing-brass/30">
          <p className="font-medium">
            {FooterSection.BUSINESS_NAME}
          </p>
          <p>
            {`${t('footer.taxCode')}: ${FooterSection.TAX_CODE} ${t('footer.issuingAuthority')} ${t('footer.issuedOn')} ${FooterSection.ISSUED_ON}, ${t('footer.representative')}: ${t('footer.representativeName')}`}
          </p>
          <p>
            {`${t('footer.address')}: ${t('footer.addressAt')}`}
            &nbsp;&nbsp;&nbsp;&nbsp;
            {`${t('footer.phone')}: ${registrationPhone}`}
          </p>
        </div>


        {/* Bottom bar */}
        <div className="flex flex-col items-start justify-between gap-3 pt-6 mt-6 border-t md:flex-row md:items-center border-landing-brass/30 text-landing-quartz/55 text-[11px] tracking-[.22em] uppercase">
          <span>{getCopyright()}</span>
        </div>
      </div>
    </footer>
  )
}
