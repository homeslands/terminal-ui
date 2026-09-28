import {
  createProduct,
  createProductVariant,
  deleteProduct,
  deleteProductImage,
  deleteProductVariant,
  exportAllProductsFile,
  getAllProducts,
  getAllProductVariant,
  getProductBySlug,
  getProductImportTemplate,
  getTopBranchProducts,
  getTopProducts,
  importProducts,
  refreshProductAnalysis,
  updateProduct,
  updateProductVariant,
  uploadMultipleProductImages,
  uploadProductImage,
} from '@/api'
import { QUERYKEY } from '@/constants'
import {
  ICreateProductRequest,
  ICreateProductVariantRequest,
  IProductRequest,
  IRefreshProductAnalysisRequest,
  ITopBranchProductQuery,
  ITopProductQuery,
  IUpdateProductRequest,
  IUpdateProductVariantRequest,
} from '@/types'
import { useQuery, keepPreviousData, useMutation } from '@tanstack/react-query'
import { saveAs } from 'file-saver'
import { useDownloadStore } from '@/stores'

export const useProducts = (params?: IProductRequest, enabled?: boolean) => {
  return useQuery({
    queryKey: [...QUERYKEY.products, params],
    queryFn: () => getAllProducts(params),
    placeholderData: keepPreviousData,
    enabled: !!params && !!enabled,
  })
}

export const useProductBySlug = (slug: string) => {
  return useQuery({
    queryKey: [...QUERYKEY.specificProduct, slug],
    queryFn: () => getProductBySlug(slug),
    placeholderData: keepPreviousData,
  })
}

export const useCreateProduct = () => {
  return useMutation({
    mutationFn: async (data: ICreateProductRequest) => {
      return createProduct(data)
    },
  })
}

export const useUploadProductImage = () => {
  return useMutation({
    mutationFn: async ({ slug, file }: { slug: string; file: File }) => {
      return uploadProductImage(slug, file)
    },
  })
}

export const useUploadMultipleProductImages = () => {
  return useMutation({
    mutationFn: async ({ slug, files }: { slug: string; files: File[] }) => {
      const formData = new FormData()
      files.forEach((file) => {
        formData.append('files', file)
      })
      return uploadMultipleProductImages(slug, files)
    },
  })
}

export const useDeleteProductImage = () => {
  return useMutation({
    mutationFn: async ({ slug, image }: { slug: string; image: string }) => {
      return deleteProductImage(slug, image)
    },
  })
}

export const useUpdateProduct = () => {
  return useMutation({
    mutationFn: async (data: IUpdateProductRequest) => {
      return updateProduct(data)
    },
  })
}

export const useDeleteProduct = () => {
  return useMutation({
    mutationFn: async (slug: string) => {
      return deleteProduct(slug)
    },
  })
}

export const useAllProductVariant = () => {
  return useQuery({
    queryKey: QUERYKEY.productVariants,
    queryFn: () => getAllProductVariant(),
    placeholderData: keepPreviousData,
  })
}

export const useCreateProductVariant = () => {
  return useMutation({
    mutationFn: async (data: ICreateProductVariantRequest) => {
      return createProductVariant(data)
    },
  })
}

export const useUpdateProductVariant = () => {
  return useMutation({
    mutationFn: async (data: IUpdateProductVariantRequest) => {
      return updateProductVariant(data)
    },
  })
}

export const useDeleteProductVariant = () => {
  return useMutation({
    mutationFn: async (slug: string) => {
      return deleteProductVariant(slug)
    },
  })
}

export const useTopProducts = (q: ITopProductQuery) => {
  return useQuery({
    queryKey: [...QUERYKEY.topProducts, q],
    queryFn: () => getTopProducts(q),
    placeholderData: keepPreviousData,
  })
}

export const useTopBranchProducts = (q: ITopBranchProductQuery) => {
  return useQuery({
    queryKey: [...QUERYKEY.topBranchProducts, q],
    queryFn: () => getTopBranchProducts(q),
    placeholderData: keepPreviousData,
  })
}

export const useRefreshProductAnalysis = () => {
  return useMutation({
    mutationFn: async (data: IRefreshProductAnalysisRequest) => {
      return refreshProductAnalysis(data)
    },
  })
}

export const useExportAllProductsFile = () => {
  const { setFileName, setIsDownloading, reset } = useDownloadStore()
  return useMutation({
    mutationFn: async () => {
      setIsDownloading(true)
      try {
        return await exportAllProductsFile()
      } finally {
        setIsDownloading(false)
        reset()
      }
    },
    onSuccess: ({ blob, fileName }) => {
      setFileName(fileName)
      saveAs(blob, fileName)
    },
  })
}

export const useExportProductImportTemplate = () => {
  const { setFileName, setIsDownloading, reset } = useDownloadStore()
  return useMutation({
    mutationFn: async () => {
      setIsDownloading(true)
      try {
        return await getProductImportTemplate()
      } finally {
        setIsDownloading(false)
        reset()
      }
    },
    onSuccess: ({ blob, fileName }) => {
      setFileName(fileName)
      saveAs(blob, fileName)
    },
  })
}

export const useImportMultipleProducts = () => {
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append('file', file)
      return importProducts(file)
    },
  })
}
