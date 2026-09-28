import { useQuery } from '@tanstack/react-query'
import { analyzeBalance, getUserBalance } from '@/api'
import { QUERYKEY } from '@/constants'

export function useGetUserBalance(slug?: string, enabled: boolean = true) {
  return useQuery({
    queryKey: [...QUERYKEY.userBalance, slug],
    queryFn: () => getUserBalance(slug),
    enabled,
  })
}

export function useAnalyzeBalance(enabled: boolean = true) {
  return useQuery({
    queryKey: QUERYKEY.analyzeBalance,
    queryFn: () => analyzeBalance(),
    enabled,
  })
}
