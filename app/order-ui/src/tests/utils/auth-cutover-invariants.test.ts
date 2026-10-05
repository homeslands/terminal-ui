import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

import { isLegacyToken } from '@/utils/auth-helpers'

/**
 * GIAI ĐOẠN 1 — hai bất biến của đợt cutover, chuyển từ thao tác tay sang test.
 *
 * (1) `isLegacyToken` — phép đo "dán một token cũ vào localStorage rồi tải
 *     trang ⇒ ra màn đăng nhập lại, không phải màn hỏng". Phần quyết định nằm
 *     ở hàm này; phần còn lại (`App.tsx` gọi `setLogout()` + `clearUserData()`)
 *     là ba dòng thẳng.
 *
 * (2) **Chỉ có MỘT URL refresh, và nó trỏ `authURL`.** Kế hoạch ghi phép đo này
 *     dưới dạng `grep -rn "auth/refresh" src/`. Quét tĩnh ở đây làm đúng việc
 *     đó nhưng chạy lại mãi mãi — và nó bắt được thứ mà test hành vi KHÔNG bắt
 *     được: một đường refresh THỨ HAI mọc lại sau này. `terminal-ui` có hai
 *     nhánh refresh (phản ứng khi 401, và hẹn giờ chủ động trước hạn 2 phút);
 *     sót một nhánh thì lỗi chỉ hiện ra sau ~13 phút chạy, gần như không tái
 *     hiện được lúc test tay.
 */

const SRC = path.resolve(__dirname, '../..')
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), 'utf8')

function makeToken(payload: Record<string, unknown>): string {
  const b64url = (o: unknown) =>
    Buffer.from(JSON.stringify(o)).toString('base64url')
  return `${b64url({ alg: 'RS256', typ: 'JWT' })}.${b64url(payload)}.chu-ky-gia`
}

describe('isLegacyToken — dọn token của phiên bản cũ (GĐ1)', () => {
  it('token CŨ (payload có `scope`) ⇒ true', () => {
    const legacy = makeToken({
      sub: 'abc',
      scope: { role: 'MANAGER', permissions: ['REPORT'] },
      exp: 1790000000,
    })
    expect(isLegacyToken(legacy)).toBe(true)
  })

  it('token MỚI do shared-user ký `{ sub, jti, exp }` ⇒ false', () => {
    const fresh = makeToken({
      sub: '00f52fb8-9550-4d36-91fc-1df98c2f73b4',
      jti: '7cd58910-655a-408f-aaa7-1a0af191d5f7',
      exp: 1790608664,
      iat: 1790605064,
    })
    expect(isLegacyToken(fresh)).toBe(false)
  })

  it('token rác / rỗng ⇒ false, không ném lỗi', () => {
    // Trả `false` là có chủ đích: token rác đã có `isAuthenticated()` và
    // interceptor xử lý theo đường bình thường. Ném lỗi ở đây sẽ làm hỏng bước
    // khởi động của App thay vì đưa người dùng về màn đăng nhập.
    expect(() => isLegacyToken('')).not.toThrow()
    expect(isLegacyToken('')).toBe(false)
    expect(isLegacyToken('khong-phai-jwt')).toBe(false)
    expect(isLegacyToken('a.b.c')).toBe(false)
  })

  it('payload base64url (có ký tự - và _) vẫn decode được', () => {
    // JWT dùng base64url; quên đổi '-'/'_' về '+'/'/' trước `atob` thì một phần
    // token cũ sẽ lọt qua và người dùng mắc kẹt ở màn hỏng.
    // '~~~' cho ra sextet '+' -> base64url doi thanh '-'. Chon gia tri co dinh
    // thay vi do tim ngau nhien: test phai luon dung cung mot duong.
    const token = makeToken({ sub: 'x', scope: { role: '~~~' } })
    expect(token.split('.')[1]).toMatch(/[-_]/)
    expect(isLegacyToken(token)).toBe(true)
  })
})

describe('Bất biến cutover — quét tĩnh mã nguồn (GĐ1)', () => {
  it('chỉ còn MỘT lệnh gọi refresh, và nó dùng `authURL` (cổng 8086)', () => {
    const http = read('utils/http.ts')

    const calls = http.match(/axios\.post\(\s*`\$\{(\w+)\}\/auth\/refresh`/g) ?? []
    expect(calls, 'phai co dung MOT lenh goi /auth/refresh').toHaveLength(1)
    expect(calls[0]).toContain('${authURL}')
    expect(calls[0]).not.toContain('${baseURL}')

    // Và không nơi nào khác trong src/ tự dựng lại một đường refresh riêng.
    expect(http).not.toContain('${baseURL}/auth/refresh')
  })

  it('không còn chỗ nào đọc `scope` ra khỏi JWT', () => {
    // Token do `shared-user` ký decode THÀNH CÔNG nhưng không có `scope`, nên
    // bản cũ trả mảng rỗng mà không ném lỗi, không log — menu trống, mọi route
    // có permission bị chặn. Một chỗ sót là đủ để dựng lại nguyên lỗi đó.
    const files: string[] = []
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name)
        if (e.isDirectory()) {
          if (e.name === 'tests' || e.name === 'node_modules') continue
          walk(p)
        } else if (/\.tsx?$/.test(e.name)) files.push(p)
      }
    }
    walk(SRC)

    const offenders = files.filter((f) => {
      const src = fs
        .readFileSync(f, 'utf8')
        .split('\n')
        .filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*'))
        .join('\n')
      return /jwtDecode\s*(<[^>]*>)?\s*\([^)]*\)\s*(as\s+\w+\s*)?\??\.\s*scope/.test(
        src,
      )
    })

    expect(offenders.map((f) => path.relative(SRC, f))).toEqual([])
  })
})

/**
 * `isLegacyToken` chỉ là phép đo; thứ thật sự dọn localStorage là cổng khởi
 * động trong `App.tsx`. Hàm đúng mà cổng gọi sai thứ tự thì người dùng vẫn
 * nhìn màn hỏng — nên khoá luôn cả cổng.
 *
 * Quét tĩnh chứ không render `App`: component đó kéo theo router, i18n,
 * Capacitor deep-link và `QueryClient`, dựng lại từng cái chỉ để đọc ba dòng
 * điều kiện thì test giòn hơn chính thứ nó bảo vệ.
 */
describe('Cổng khởi động trong `App.tsx` — thứ tự hai nhánh (GĐ1)', () => {
  const app = () => read('app/App.tsx')

  it('`App.tsx` có dùng `isLegacyToken`', () => {
    expect(app()).toMatch(/import\s*\{[^}]*isLegacyToken[^}]*\}\s*from/)
    expect(app()).toMatch(/isLegacyToken\(\s*authStore\.token\s*\)/)
  })

  it('nhánh token cũ đứng TRƯỚC nhánh `!isAuthenticated()`', () => {
    // Đây là toàn bộ lý do nhánh mới tồn tại: `isAuthenticated()` chỉ xem đủ
    // trường chưa và `expireTime` qua chưa — nó KHÔNG biết gì về chữ ký. Một
    // token cũ còn hạn lọt qua nhánh đó và app khởi động bình thường rồi mới
    // hỏng ở request đầu tiên. Đảo thứ tự hai nhánh là mất sạch tác dụng.
    const src = app()
    const viTriLegacy = src.indexOf('isLegacyToken(authStore.token)')
    const viTriIsAuth = src.indexOf('!authStore.isAuthenticated()')

    expect(viTriLegacy).toBeGreaterThan(-1)
    expect(viTriIsAuth).toBeGreaterThan(-1)
    expect(viTriLegacy).toBeLessThan(viTriIsAuth)
  })

  it('nhánh token cũ dọn CẢ auth state lẫn dữ liệu người dùng', () => {
    const src = app()
    const khoi = src.slice(
      src.indexOf('isLegacyToken(authStore.token)'),
      src.indexOf('!authStore.isAuthenticated()'),
    )

    expect(khoi).toContain('authStore.setLogout()')
    // `clearUserData()`, không phải `removeUserInfo()`: phiên cũ phải đi sạch,
    // kể cả device token đã đăng ký push cho danh tính không còn dùng được.
    expect(khoi).toContain('userStore.clearUserData()')
  })

  it('cả khối vẫn nằm trong try/catch của cổng khởi động', () => {
    // localStorage hỏng/không parse được thì phải rơi vào nhánh dọn sạch, chứ
    // không được làm chết bước khởi động — app trắng màn thì không ai đăng
    // nhập lại được.
    const src = app()
    const truoc = src.slice(0, src.indexOf('isLegacyToken(authStore.token)'))

    expect(truoc).toMatch(/try\s*\{/)
    expect(src).toContain("localStorage.removeItem('auth-storage')")
  })
})
