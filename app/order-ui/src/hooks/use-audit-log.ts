import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'

import {
  getAuditLogConfigs,
  getAuditLogs,
  updateAuditLogConfig,
} from '@/api/audit-log'
import { QUERYKEY } from '@/constants'
import {
  IApiResponse,
  IAuditLogConfig,
  IAuditLogQuery,
} from '@/types'

export const useAuditLogs = (q: IAuditLogQuery) =>
  useQuery({
    queryKey: [...QUERYKEY.auditLogs, q],
    queryFn: () => getAuditLogs(q),
    placeholderData: keepPreviousData,
    staleTime: 1000 * 10,
  })

export const useAuditLogConfigs = () =>
  useQuery({
    queryKey: QUERYKEY.auditLogConfigs,
    queryFn: getAuditLogConfigs,
  })

export const useUpdateAuditLogConfig = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: updateAuditLogConfig,
    onMutate: async ({ slug, enabled }) => {
      await qc.cancelQueries({ queryKey: QUERYKEY.auditLogConfigs })
      const prev = qc.getQueryData<IApiResponse<IAuditLogConfig[]>>(
        QUERYKEY.auditLogConfigs,
      )
      if (prev?.result) {
        qc.setQueryData<IApiResponse<IAuditLogConfig[]>>(
          QUERYKEY.auditLogConfigs,
          {
            ...prev,
            result: prev.result.map((c) =>
              c.slug === slug ? { ...c, enabled } : c,
            ),
          },
        )
      }
      return { prev }
    },
    onError: (_e, _vars, ctx) => {
      if (ctx?.prev)
        qc.setQueryData(QUERYKEY.auditLogConfigs, ctx.prev)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: QUERYKEY.auditLogConfigs })
    },
  })
}
