export interface IApiResponse<T> {
  /** Legacy BE field — may be empty on newer error responses. Prefer statusCode. */
  code: number
  /** BE error code (new shape). Mirrors `code` for backward compat. */
  statusCode?: number
  error: boolean
  message: string
  method: string
  path: string
  timestamp: number
  result: T
}

export interface IPaginationResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
  hasNext: boolean
  hasPrevious: boolean
}

export interface IQuery {
  page: number
  pageSize: number
  order: 'ASC' | 'DESC'
}

export interface IBase {
  createdAt: string
  slug: string
}

export interface IApiErrorResponse {
  statusCode: number
  timestamp: number
  message: string
  method: string
  path: string
}
