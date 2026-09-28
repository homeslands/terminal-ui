import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'

// Animation Variant
const fadeInVariants = {
  hidden: { opacity: 0, y: 50 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.8, ease: 'easeOut' },
  },
}

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const

export default function HoursTimetable() {
  const { t } = useTranslation('home')

  const hotline = t('home.location.hotline')
  const email = t('home.location.email')

  return (
    <motion.div
      className="signboard relative mx-auto mt-12 max-w-5xl p-8 md:mt-16 md:p-10"
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.1 }}
      variants={fadeInVariants}
    >
      <span className="rivet" style={{ top: '10px', left: '10px' }} />
      <span className="rivet" style={{ top: '10px', right: '10px' }} />
      <span className="rivet" style={{ bottom: '10px', left: '10px' }} />
      <span className="rivet" style={{ bottom: '10px', right: '10px' }} />

      <div className="signboard-inner grid items-start gap-8 md:grid-cols-[1fr_1.3fr]">
        {/* Title + contacts */}
        <div>
          <div className="mb-2 flex items-center gap-3">
            <span className="text-grad-accent text-[10px] font-medium uppercase tracking-[.4em]">
              {t('home.location.hoursEyebrow')}
            </span>
          </div>
          <h3 className="text-grad-primary font-display text-fluid-h3 py-2 font-black uppercase leading-none">
            {t('home.location.hoursTitle')}
          </h3>
          <div className="brand-divider mt-5" style={{ maxWidth: '220px' }} />

          <div className="mt-7 grid grid-cols-1 gap-4">
            <div>
              <div className="text-[10px] font-medium uppercase tracking-[.32em] text-landing-brass-light">
                {t('home.location.hotlineLabel')}
              </div>
              <a
                href={`tel:${hotline.replace(/\s/g, '')}`}
                className="text-grad-accent text-fluid-h3 font-bold tabular-nums"
              >
                {hotline}
              </a>
            </div>
            <div>
              <div className="text-[10px] font-medium uppercase tracking-[.32em] text-landing-brass-light">
                {t('home.location.emailLabel')}
              </div>
              <a
                href={`mailto:${email}`}
                className="text-[14px] text-landing-quartz hover:text-landing-brass-light"
              >
                {email}
              </a>
            </div>
          </div>
        </div>

        {/* Timetable */}
        <div>
          <div className="grid grid-cols-2 border-b border-landing-brass/30 pb-2 text-[11px] font-medium uppercase tracking-[.22em] text-landing-brass-light">
            <span>{t('home.location.day')}</span>
            <span className="text-right">{t('home.location.serviceWindow')}</span>
          </div>
          {DAYS.map((day) => (
            <div key={day} className="timetable-row">
              <span>{t(`home.location.days.${day}`)}</span>
              <span className="dep">{t(`home.location.hours.${day}`)}</span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  )
}
