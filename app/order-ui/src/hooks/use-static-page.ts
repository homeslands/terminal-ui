import {
  createStaticPage,
  deleteStaticPage,
  getAllStaticPages,
  getStaticPage,
  updateStaticPage,
} from '@/api'
import { QUERYKEY } from '@/constants'
import { ICreateStaticPage, IUpdateStaticPage } from '@/types'
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query'

export const useGetAllStaticPages = () => {
  return useQuery({
    queryKey: QUERYKEY.staticPages,
    queryFn: () => getAllStaticPages(),
    placeholderData: keepPreviousData,
  })
}

export const useStaticPage = (q: string) => {
  return useQuery({
    queryKey: [...QUERYKEY.staticPage, q],
    queryFn: () => getStaticPage(q),
    placeholderData: keepPreviousData,
  })
}

export const useCreateStaticPage = () => {
  return useMutation({
    mutationFn: async (data: ICreateStaticPage) => {
      return createStaticPage(data)
    },
  })
}

export const useUpdateStaticPage = () => {
  return useMutation({
    mutationFn: async (data: IUpdateStaticPage) => {
      return updateStaticPage(data)
    },
  })
}

export const useDeleteStaticPage = () => {
  return useMutation({
    mutationFn: async (slug: string) => {
      return deleteStaticPage(slug)
    },
  })
}
