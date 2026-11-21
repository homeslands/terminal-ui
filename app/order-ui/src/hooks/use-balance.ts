import { useQuery } from '@tanstack/react-query'
import { analyzeBalance, getMyBalance, getUserBalance } from '@/api'
import { QUERYKEY } from '@/constants'
import { useUserStore } from '@/stores'

export function useGetUserBalance(slug?: string, enabled: boolean = true) {
  return useQuery({
    queryKey: [...QUERYKEY.userBalance, slug],
    queryFn: () => getUserBalance(slug),
    enabled,
  })
}

// Step 7.8: own cache key - a staff member who just looked at a customer's
// wallet must not see that number on their own screens. Still under the
// 'userBalance' prefix, so invalidating ['userBalance'] (gift card redeem)
// refreshes it. The key carries the signed-in user: customer B signing in on
// the tab customer A just left must not get A's cached number.
export function useGetMyBalance(enabled: boolean = true) {
  const mySlug = useUserStore((s) => s.userInfo?.slug)
  return useQuery({
    queryKey: [...QUERYKEY.userBalance, 'mine', mySlug],
    queryFn: () => getMyBalance(),
    enabled: enabled && !!mySlug,
  })
}

export function useAnalyzeBalance(enabled: boolean = true) {
  return useQuery({
    queryKey: QUERYKEY.analyzeBalance,
    queryFn: () => analyzeBalance(),
    enabled,
  })
}
