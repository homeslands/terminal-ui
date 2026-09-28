import { NewsArticle11, NewsArticle12, NewsArticle13, NewsArticle22, NewsArticle23, NewsArticle32, NewsArticle33, NewsArticle34 } from '@/assets/images'
import { Swiper, SwiperSlide } from 'swiper/react'
import { Autoplay, Navigation, Pagination, EffectFade } from 'swiper/modules'

const images = [NewsArticle11, NewsArticle12, NewsArticle13, NewsArticle22, NewsArticle23, NewsArticle32, NewsArticle33, NewsArticle34]

export default function StoreCarousel() {
  return (
    <div className="w-full overflow-hidden">
      <Swiper
        autoplay={{
          delay: 3000,
          pauseOnMouseEnter: true,
          disableOnInteraction: false,
        }}
        loop={true}
        speed={800}
        effect="slide"
        slidesPerView={1}
        spaceBetween={0}
        pagination={{
          clickable: true,
        }}
        modules={[Autoplay, Navigation, Pagination, EffectFade]}
        className="w-full"
      >
        {images.map((image, index) => (
          <SwiperSlide key={index} className="w-full">
            <div className="flex h-[18rem] w-full overflow-hidden sm:h-[28rem] md:h-[32rem]">
              <img
                src={image}
                alt={`Slide ${index + 1}`}
                className="h-full w-full object-cover"
                style={{ filter: 'sepia(.55) saturate(.9) contrast(1.05) brightness(.92)' }}
              />
            </div>
          </SwiperSlide>
        ))}
      </Swiper>
    </div>
  )
}
