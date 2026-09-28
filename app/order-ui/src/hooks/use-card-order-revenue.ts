import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query'

import { QUERYKEY } from '@/constants'
import { exportAllCardOrderRevenueApi, exportPdfCardOrderRevenueApi, getAllCardOrderRevenueApi } from '@/api/card-order-revenue'
import { ICardOrderRevenueQuery } from '@/types/card-order-revenue.type'
import { useDownloadStore } from '@/stores'

export const useCardOrderRevenue = (q: ICardOrderRevenueQuery) => {
  return useQuery({
    queryKey: [...QUERYKEY.cardOrderRevenue, q],
    queryFn: () => getAllCardOrderRevenueApi(q),
    placeholderData: keepPreviousData,
  })
}


export const useExportCardOrderRevenue = () => {
  const { setFileName, setIsDownloading, reset } = useDownloadStore()
  return useMutation({
    mutationFn: async (params: ICardOrderRevenueQuery) => {
      const currentDate = new Date().toISOString().split('T')[0]
      setFileName(`card-order-renenue-${currentDate}.xlsx`)
      setIsDownloading(true)
      try {
        return await exportAllCardOrderRevenueApi(params)
      } finally {
        setIsDownloading(false)
        reset()
      }
    },
    onSuccess: (blob) => {
      const currentDate = new Date().toISOString().split('T')[0]
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `card-order-renenue-${currentDate}.xlsx`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    },
  })
}

export const useExportPdfCardOrderRevenue = () => {
  const { setFileName, setIsDownloading, reset } = useDownloadStore()
  return useMutation({
    mutationFn: async (params: ICardOrderRevenueQuery) => {
      const currentDate = new Date().toISOString().split('T')[0]
      setFileName(`card-order-renenue-${currentDate}.pdf`)
      setIsDownloading(true)
      try {
        return await exportPdfCardOrderRevenueApi(params)
      } finally {
        setIsDownloading(false)
        reset()
      }
    },
    onSuccess: (blob) => {
      const currentDate = new Date().toISOString().split('T')[0]
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `card-order-renenue-${currentDate}.pdf`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    },
  })
}
