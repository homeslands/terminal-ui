import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { logger } from '@/api'
import { QUERYKEY } from '@/constants'
import { IQuery } from '@/types'

export const useLogger = (q: IQuery) => {
  return useQuery({
    queryKey: [...QUERYKEY.logs, q],
    queryFn: () => logger(q),
    placeholderData: keepPreviousData,
    staleTime: 1000 * 5,
    refetchInterval: 1000 * 5,
  })
}
