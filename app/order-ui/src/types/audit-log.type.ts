export type TAuditEvent = 'Create' | 'Update' | 'Delete'

export interface IAuditLog {
  slug: string
  createdAt: string
  userSlug: string
  user: string
  event: TAuditEvent
  entity: string
  from: Record<string, unknown> | null
  to: Record<string, unknown> | null
}

export interface IAuditLogQuery {
  page: number
  size: number
  order: 'ASC' | 'DESC'
  user?: string
  entity?: string
  event?: TAuditEvent
  /** Date filter (inclusive), format `YYYY-MM-DD` in local timezone. */
  startDate?: string
  /** Date filter (inclusive), format `YYYY-MM-DD` in local timezone. */
  endDate?: string
  hasPaging?: boolean
}

export interface IAuditLogConfig {
  slug: string
  entity: string
  enabled: boolean
  createdAt: string
  updatedAt?: string
}

export interface IUpdateAuditLogConfigRequest {
  slug: string
  enabled: boolean
}
