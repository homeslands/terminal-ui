import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query'

import {
  getAllRevenue,
  getLatestRevenue,
  getLatestBranchRevenueForARange,
  getLatestRevenueForARange,
  getRevenue,
  getBranchRevenue,
  exportExcelRevenue,
  exportPDFRevenue,
} from '@/api'
import { IAllRevenueQuery, IBranchRevenueQuery, IRevenueQuery } from '@/types'
import { QUERYKEY } from '@/constants'
import { useDownloadStore } from '@/stores'

export const useRevenue = (q: IRevenueQuery) => {
  return useQuery({
    queryKey: [...QUERYKEY.revenue, q],
    queryFn: () => getRevenue(q),
    placeholderData: keepPreviousData,
  })
}

export const useAllRevenue = (q: IAllRevenueQuery) => {
  return useQuery({
    queryKey: [...QUERYKEY.allRevenue, q],
    queryFn: () => getAllRevenue(q),
    placeholderData: keepPreviousData,
  })
}

export const useBranchRevenue = (q: IBranchRevenueQuery) => {
  return useQuery({
    queryKey: [...QUERYKEY.branchRevenue, q],
    queryFn: () => getBranchRevenue(q),
    placeholderData: keepPreviousData,
  })
}

export const useLatestRevenueForARange = (q: IRevenueQuery) => {
  return useMutation({
    mutationFn: async () => {
      return getLatestRevenueForARange(q)
    },
  })
}

export const useLatestRevenue = () => {
  return useMutation({
    mutationFn: async () => {
      return getLatestRevenue()
    },
  })
}

export const useLatestBranchRevenueForARange = (q: IBranchRevenueQuery) => {
  return useMutation({
    mutationFn: async () => {
      return getLatestBranchRevenueForARange(q)
    },
  })
}

export const useExportExcelRevenue = () => {
  const { setFileName, setIsDownloading, reset } = useDownloadStore()
  return useMutation({
    mutationFn: async (q: IRevenueQuery) => {
      const currentDate = new Date().toISOString()
      setFileName(`TRENDCoffee-doanh-thu-${currentDate}.xlsx`)
      setIsDownloading(true)
      try {
        return await exportExcelRevenue(q)
      } finally {
        setIsDownloading(false)
        reset()
      }
    },
    onSuccess: (blob) => {
      const currentDate = new Date().toISOString()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `TRENDCoffee-doanh-thu-${currentDate}.xlsx`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    },
  })
}

export const useExportPDFRevenue = () => {
  const { setFileName, setIsDownloading, reset } = useDownloadStore()
  return useMutation({
    mutationFn: async (q: IRevenueQuery) => {
      const currentDate = new Date().toISOString()
      setFileName(`TRENDCoffee-doanh-thu-${currentDate}.pdf`)
      setIsDownloading(true)
      try {
        return await exportPDFRevenue(q)
      } finally {
        setIsDownloading(false)
        reset()
      }
    },
    onSuccess: (blob) => {
      const currentDate = new Date().toISOString()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `TRENDCoffee-doanh-thu-${currentDate}.pdf`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    },
  })
}
