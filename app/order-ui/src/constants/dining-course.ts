import { HighlightMenu6, HighlightMenu7, HighlightMenu8, HighlightMenu9 } from '@/assets/images'

/**
 * "Phần ăn" (dining course) — nhóm gộp cấp cao bên trên danh mục (catalog).
 * 4 phần ăn tham chiếu theo các hình trong MenuSection của trang chủ
 * (HighlightMenuCarousel): Khai vị, Món chính, Tráng miệng, Đồ uống (Cheer).
 *
 * Mỗi phần ăn nhận diện catalog bằng `keywords` so khớp với TÊN danh mục
 * (không phân biệt hoa/thường, có/không dấu).
 */
export interface IDiningCourse {
  key: string
  /** i18n key dưới namespace `menu`, ví dụ `menu.diningCourse.starters` */
  labelKey: string
  image: string
  /** từ khoá so khớp với tên catalog — viết thường, không dấu */
  keywords: string[]
}

export const DINING_COURSES: IDiningCourse[] = [
  {
    key: 'starters',
    labelKey: 'menu.diningCourse.starters',
    image: HighlightMenu6,
    keywords: [
      'khai vi', 
      'salad', 
      'salads', 
      'goi', 
      'nom', 
      'sup', 
      'soup', 
      'soups', 
      'appetizer', 
      'appetizers', 
      'starter', 
      'starters'
    ],
  },
  {
    key: 'mainCourses',
    labelKey: 'menu.diningCourse.mainCourses',
    image: HighlightMenu7,
    keywords: [
      'mon chinh',
      'main',
      'mains',
      'com',
      'mi',
      'pho',
      'bun',
      'mien',
      'lau',
      'nuong',
      'grill',
      'bbq',
      'steak',
      'hai san',
      'seafood',
      'thit',
      'ga',
      'bo',
      'heo',
      'pizza',
      'pizzas',
      'pasta',
      'burger',
      'burrito',
      'tacos',
      'taco',
      'tacos & Fries',
      'taco & Khoai tay chien',
      'taco & Khoai chien',
      'fries',
      'frie',
      'au'
    ],
  },
  {
    key: 'desserts',
    labelKey: 'menu.diningCourse.desserts',
    image: HighlightMenu8,
    keywords: [
      'trang mieng',
      'dessert',
      'desserts',
      'banh',
      'che',
      'kem',
      'ice cream',
      'pudding',
      'trai cay',
      'hoa qua',
      'sweet',
      'tiramisu',
      'panacotta',
      'brownie',
      'cake',
    ],
  },
  {
    key: 'beverages',
    labelKey: 'menu.diningCourse.beverages',
    image: HighlightMenu9,
    keywords: [
      'do uong',
      'thuc uong',
      'nuoc',
      'beverage',
      'beverages',
      'drink',
      'soft drink',
      'soft drinks',
      'ca phe',
      'coffee',
      'tra',
      'tea',
      'sinh to',
      'smoothie',
      'juice',
      'soda',
      'bia',
      'beer',
      'beers',
      'ruou',
      'ruou vang',
      'wine',
      'wines',
      'cocktail',
      'mocktail',
      'cheer',
      'beer & wine',
      'nuoc giai khat'
    ],
  },
]

/** Bỏ dấu tiếng Việt + viết thường để so khớp không phân biệt dấu. */
const normalize = (value: string): string =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, ' ')
    .trim()

/**
 * Một catalog thuộc về phần ăn khi tên của nó khớp một trong các từ khoá.
 * - Từ khoá nhiều chữ (có khoảng trắng): so khớp dạng chuỗi con.
 * - Từ khoá một chữ: so khớp theo từng từ (tránh khớp nhầm chuỗi con, ví dụ
 *   "mi" trong "tiramisu").
 */
export const catalogMatchesDiningCourse = (catalogName: string, course: IDiningCourse): boolean => {
  const name = normalize(catalogName)
  if (!name) return false
  const tokens = name.split(' ')
  return course.keywords.some((keyword) => {
    const normalizedKeyword = normalize(keyword)
    return normalizedKeyword.includes(' ')
      ? name.includes(normalizedKeyword)
      : tokens.includes(normalizedKeyword)
  })
}

/**
 * Phần ăn (dining course) mà một catalog thuộc về — lấy phần ăn ĐẦU TIÊN khớp
 * theo thứ tự DINING_COURSES (Khai vị → Món chính → Tráng miệng → Đồ uống).
 * Đảm bảo mỗi catalog chỉ thuộc đúng một phần ăn dù tên khớp nhiều từ khoá.
 * Trả về null nếu không khớp phần ăn nào.
 */
export const getDiningCourse = (catalogName: string): IDiningCourse | null =>
  DINING_COURSES.find((course) => catalogMatchesDiningCourse(catalogName, course)) ?? null

/**
 * Chỉ số ưu tiên của catalog theo thứ tự thực đơn (0 = Khai vị … 3 = Đồ uống).
 * Catalog không khớp phần ăn nào trả về Number.MAX_SAFE_INTEGER để xếp xuống cuối.
 */
export const getDiningCourseIndex = (catalogName: string): number => {
  const index = DINING_COURSES.findIndex((course) => catalogMatchesDiningCourse(catalogName, course))
  return index === -1 ? Number.MAX_SAFE_INTEGER : index
}
