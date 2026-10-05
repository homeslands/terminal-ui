import { describe, it, expect, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

/**
 * GIAI ĐOẠN 1 — không tệp nào trên đường `utils/http.ts` kéo vào được phép
 * import qua barrel `@/utils`.
 *
 * ## Vòng tròn, và vì sao nó chỉ nổ từ giai đoạn 1
 *
 *   `@/utils` (barrel) → `./http` → `@/stores` → `auth.store` → `@/utils` …
 *
 * Vòng này tồn tại từ trước nhưng **vô hại**: ES module cho phép vòng, miễn là
 * lúc quay lại barrel thì thứ đang cần đã được khởi tạo. Giai đoạn 1 thêm
 * `export { default as httpAuth } from './http-auth'` vào barrel **ngay sau**
 * `./http`, và `http-auth.ts` gọi `attachAuthInterceptors` — một hàm khai báo ở
 * **cuối** `http.ts`. Đi vào vòng qua barrel thì `./http` mới đánh giá được một
 * nửa, barrel chạy tiếp tới `./http-auth`, và hàm đó **chưa tồn tại**:
 *
 *   TypeError: attachAuthInterceptors is not a function
 *
 * Nổ ngay lúc import, tức app trắng màn trước cả khi React kịp chạy. Cách chữa
 * đã dùng: những tệp nằm trên vòng import từ **module cụ thể**
 * (`@/utils/toast`, `@/utils/current-url-manager`, `@/utils/http`) thay vì
 * barrel. `trend-ui` không dính vì `auth.store.ts` bên đó không import
 * `@/utils`.
 *
 * ## Vì sao đi theo ĐỒ THỊ chứ không liệt kê thư mục
 *
 * Danh sách thư mục ("stores, api, services, lib không được import barrel") vừa
 * quá rộng vừa quá hẹp: nó cấm oan những tệp `utils/http.ts` không hề chạm tới,
 * và bỏ sót một tệp mới nằm ngoài bốn thư mục đó nhưng lại bị kéo vào. Ở đây
 * dựng đúng tập tệp mà `utils/http.ts` kéo vào (đệ quy) rồi mới kiểm — tập đó
 * tự giãn ra theo mã nguồn, không phải sửa test mỗi lần thêm thư mục.
 */

const SRC = path.resolve(__dirname, '../..')
const BARREL = '@/utils'

/** Mọi specifier được import/re-export trong một tệp, bỏ `import type`. */
function cac_import(src: string): string[] {
  const out: string[] = []
  const re =
    /(?:^|\n)\s*(?:import|export)\s+(?!type\s)(?:[^'";]*?\sfrom\s+)?['"]([^'"]+)['"]/g
  let m: RegExpExecArray | null
  while ((m = re.exec(src)) !== null) out.push(m[1])
  // `await import('…')` — `auth.store.ts` dùng dạng này để gọi sang `http`.
  const reDyn = /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g
  while ((m = reDyn.exec(src)) !== null) out.push(m[1])
  return out
}

/** `@/x` hoặc `./x` → đường dẫn tệp thật trong `src/`, hoặc `null` nếu ngoài src. */
function giai_duong_dan(spec: string, tuTep: string): string | null {
  let base: string
  if (spec.startsWith('@/')) base = path.join(SRC, spec.slice(2))
  else if (spec.startsWith('.')) base = path.resolve(path.dirname(tuTep), spec)
  else return null // package ngoài

  const ungVien = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    path.join(base, 'index.ts'),
    path.join(base, 'index.tsx'),
  ]
  for (const p of ungVien) {
    if (fs.existsSync(p) && fs.statSync(p).isFile()) return p
  }
  return null
}

/**
 * Duyệt từ `utils/http.ts` theo các import nội bộ. Gặp tệp nào import barrel
 * `@/utils` thì ghi lại — đó chính là một cạnh đóng vòng — và không đi tiếp
 * vào barrel.
 */
function quet_vong(): { thamGia: string[]; offenders: string[] } {
  const batDau = path.join(SRC, 'utils/http.ts')
  const daTham = new Set<string>()
  const offenders: string[] = []
  const hangDoi = [batDau]

  while (hangDoi.length) {
    const tep = hangDoi.shift() as string
    if (daTham.has(tep)) continue
    daTham.add(tep)

    const src = fs.readFileSync(tep, 'utf8')
    for (const spec of cac_import(src)) {
      if (spec === BARREL) {
        if (tep !== batDau) offenders.push(tep)
        continue
      }
      const tiep = giai_duong_dan(spec, tep)
      if (tiep && !daTham.has(tiep)) hangDoi.push(tiep)
    }
  }

  return { thamGia: [...daTham], offenders }
}

describe('Vòng import qua barrel `@/utils` (GĐ1)', () => {
  it('không tệp nào trên đường `utils/http.ts` kéo vào import từ `@/utils`', () => {
    const { thamGia, offenders } = quet_vong()

    // Lưới phải thật sự quét được gì đó — nếu `giai_duong_dan` hỏng thì tập
    // rỗng và ca này xanh một cách vô nghĩa.
    expect(thamGia.length).toBeGreaterThan(5)

    expect(
      offenders.map((f) => path.relative(SRC, f).replace(/\\/g, '/')),
    ).toEqual([])
  })

  it('lưới có phủ đúng những tệp đã phải sửa ở giai đoạn 1', () => {
    // Đối chứng cho ca trên: nếu một ngày `utils/http.ts` không còn kéo
    // `auth.store` / `notification` vào nữa thì ca trên vẫn xanh nhưng đã
    // ngừng bảo vệ chúng — ca này sẽ đỏ và nói rõ điều đó.
    const { thamGia } = quet_vong()
    const duongDan = thamGia.map((f) =>
      path.relative(SRC, f).replace(/\\/g, '/'),
    )

    expect(duongDan).toContain('stores/auth.store.ts')
    expect(duongDan).toContain('api/notification.ts')
    expect(duongDan).toContain('services/token-registration-queue.ts')
  })

  it('barrel vẫn export cả `http` lẫn `httpAuth` — ngoại lệ là ở NƠI IMPORT, không phải ở đây', () => {
    // Chữa vòng bằng cách bỏ `httpAuth` khỏi barrel thì mọi nơi gọi API phải
    // đổi import — không phải cách đã chọn, và ca này giữ cho không ai lặng lẽ
    // chọn nó.
    const barrel = fs.readFileSync(path.join(SRC, 'utils/index.ts'), 'utf8')
    expect(barrel).toMatch(/export \{ default as http \} from '\.\/http'/)
    expect(barrel).toMatch(
      /export \{ default as httpAuth \} from '\.\/http-auth'/,
    )
  })
})

/**
 * Đối chứng ở mức chạy thật: nạp `http-auth` và xác nhận nó lấy được
 * `attachAuthInterceptors` từ `http`. Đây chính là lệnh gọi đã ném TypeError
 * khi đi vòng qua barrel.
 */
describe('Nạp `http-auth` không ném (GĐ1)', () => {
  it(
    '`httpAuth` được tạo và đã gắn interceptor',
    async () => {
      vi.doMock('@/stores', () => ({
        useAuthStore: Object.assign(vi.fn(), {
          getState: () => ({ token: null, isAuthenticated: () => false }),
        }),
        useUserStore: Object.assign(vi.fn(), { getState: () => ({}) }),
        useCurrentUrlStore: Object.assign(vi.fn(), { getState: () => ({}) }),
        useRequestStore: Object.assign(vi.fn(), {
          getState: () => ({ requestQueueSize: 0 }),
          setState: vi.fn(),
        }),
        useLoadingStore: Object.assign(vi.fn(), {
          getState: () => ({ setIsLoading: vi.fn() }),
        }),
      }))
      vi.doMock('@/services/fcm-token-sync', () => ({
        syncFcmTokenAfterRefresh: vi.fn(),
      }))
      vi.doMock('@/lib/server-time', () => ({
        setServerTimeOffsetFromHeader: vi.fn(),
      }))
      vi.resetModules()

      const { default: httpAuth } = await import('@/utils/http-auth')

      expect(httpAuth).toBeTruthy()
      const handlers = (
        httpAuth.interceptors.request as unknown as { handlers: unknown[] }
      ).handlers
      expect(handlers.length).toBeGreaterThan(0)

      vi.doUnmock('@/stores')
      vi.doUnmock('@/services/fcm-token-sync')
      vi.doUnmock('@/lib/server-time')
    },
    // Nạp thật cả cây `http` → `constants` → … mất vài giây trên máy này; 5s
    // mặc định của Vitest hụt khi chạy cùng lúc nhiều tệp.
    30_000,
  )
})
