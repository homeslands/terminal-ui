import React from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, Pagination } from "swiper/modules";
import { useTranslation } from "react-i18next";

import { HighlightMenu6, HighlightMenu7, HighlightMenu8, HighlightMenu9, HighlightMenu10 } from '@/assets/images';

export default function HighlightMenuCarousel(): React.ReactElement {
    const { t } = useTranslation('home');
    
    const breakpoints = {
        0: { slidesPerView: 2, spaceBetween: 20 },
        768: { slidesPerView: 4, spaceBetween: 20 },
    }

    // Dữ liệu hardcode với 4 hình ảnh và tên món
    const highlightMenus = [
        { id: 1, image: HighlightMenu6, nameKey: 'home.highlightMenu.starters' }, // Món khai vị
        { id: 2, image: HighlightMenu7, nameKey: 'home.highlightMenu.mainCourses' }, // Món chính
        { id: 3, image: HighlightMenu8, nameKey: 'home.highlightMenu.desserts' }, // Tráng miệng
        { id: 4, image: HighlightMenu9, nameKey: 'home.highlightMenu.cheers' }, // Các loại rượu
        { id: 5, image: HighlightMenu10, nameKey: 'home.highlightMenu.combo' } // Combo
    ];

    return (
        <Swiper
            breakpoints={breakpoints}
            initialSlide={0}
            spaceBetween={24}
            allowTouchMove={true}
            modules={[Autoplay, Pagination]}
            className="overflow-y-visible w-full h-full mySwiper"
            pagination={{ clickable: true }}
        >
            {highlightMenus.map((item) => (
                <SwiperSlide
                    key={item.id}
                    className="py-2 w-full h-[7rem] sm:h-[18rem]"
                >
                    <div className="flex h-full w-full flex-col justify-between">
                        <div className="relative w-full aspect-square">
                            <img
                                src={item.image}
                                alt={t(item.nameKey)}
                                className="w-full h-full object-cover rounded-xl"
                            />
                        </div>

                        {/* Tên món */}
                        <div className="mt-2 px-1 text-center">
                            <span className="line-clamp-1 text-2xl font-medium uppercase tracking-[.12em] text-landing-brass-light">
                                {t(item.nameKey)}
                            </span>
                        </div>
                    </div>
                </SwiperSlide>
            ))}
        </Swiper>
    )
}