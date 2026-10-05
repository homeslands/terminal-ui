import { vi } from 'vitest'

export const httpMock = {
  get: vi.fn(),
  put: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
}

// Client thứ hai (shared-user). Thiếu mock này thì mọi test chạm
// `api/auth.ts` / `api/profile.ts` sẽ đỏ với "httpAuth is undefined", vì
// `vi.doMock('@/utils')` thay CẢ module — không khai `httpAuth` ở đây nghĩa là
// nó không tồn tại trong module giả.
export const httpAuthMock = {
  get: vi.fn(),
  put: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
}

// Mock the http module
vi.doMock('@/utils', () => ({
  http: httpMock,
  httpAuth: httpAuthMock,
}))
