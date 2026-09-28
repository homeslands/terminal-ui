import { getCoinPoliciesApi, toggleCoinPolicyApi, updateCoinPolicyApi } from '@/api/coin-policy'
import { QUERYKEY } from '@/constants'
import { IToggleCoinPolicy, IUpdateCoinPolicy } from '@/types/coin-policy.type'
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query'

export const useCoinPolicies = () => {
  return useQuery({
    queryKey: QUERYKEY.coinPolicies,
    queryFn: () => getCoinPoliciesApi(),
    placeholderData: keepPreviousData,
  })
}

export const useUpdateCoinPolicy = () => {
  return useMutation({
    mutationFn: async (request: { slug: string, payload: IUpdateCoinPolicy }) => {
      return updateCoinPolicyApi(request)
    },
  })
}

export const useToggleCoinPolicyActivation = () => {
  return useMutation({
    mutationFn: async (request: { slug: string, payload: IToggleCoinPolicy }) => {
      return toggleCoinPolicyApi(request)
    },
  })
}