import {
  IApiResponse,
  IAuditLog,
  IAuditLogConfig,
  IAuditLogQuery,
  IPaginationResponse,
  IUpdateAuditLogConfigRequest,
} from '@/types'
import { http } from '@/utils'

export async function getAuditLogs(
  params: IAuditLogQuery,
): Promise<IApiResponse<IPaginationResponse<IAuditLog>>> {
  const response = await http.get<IApiResponse<IPaginationResponse<IAuditLog>>>(
    '/audit-logs',
    { doNotShowLoading: true, params },
  )
  return response.data
}

export async function getAuditLogConfigs(): Promise<
  IApiResponse<IAuditLogConfig[]>
> {
  const response = await http.get<IApiResponse<IAuditLogConfig[]>>(
    '/audit-logs-config',
    { doNotShowLoading: true },
  )
  return response.data
}

export async function updateAuditLogConfig(
  body: IUpdateAuditLogConfigRequest,
): Promise<IApiResponse<IAuditLogConfig>> {
  const response = await http.patch<IApiResponse<IAuditLogConfig>>(
    '/audit-logs-config',
    body,
  )
  return response.data
}
