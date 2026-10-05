import { getProfile, updateProfile, updatePassword, uploadProfilePicture, deleteAccount } from '@/api'
import { QUERYKEY } from '@/constants'
import { IUpdateProfileRequest, IUpdatePasswordRequest, IDeleteAccountRequest } from '@/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

export const useProfile = () => {
  return useQuery({
    // `[QUERYKEY.profile]`, KHONG phai `[...QUERYKEY.profile]`.
    //
    // `QUERYKEY.profile` la mot MANG (`['profile']`), nen spread ra thanh
    // khoa `['profile']` con boc lai thanh `[['profile']]` - hai khoa KHAC
    // NHAU voi react-query (khoa duoc bam chinh xac; `invalidateQueries`
    // khop theo tien to nen chuoi `'profile'` khong khop mang `['profile']`).
    //
    // Ban cu dung spread nen hai thu cung hong am tham:
    //   1. Buoc moi cache o `use-post-auth-actions.ts`
    //      (`setQueryData([QUERYKEY.profile], ...)`, chep tu `trend-ui`) ghi
    //      vao mot khoa KHONG AI DOC ⇒ dang nhap xong mo man ho so van ban
    //      them mot `GET /auth/profile`, keo theo mot luot lookup sang
    //      shared-user.
    //   2. Sau nhom `invalidateQueries({ queryKey: [QUERYKEY.profile] })` o
    //      cac dialog xac minh email/SDT va form doi mat khau deu khong khop
    //      ⇒ khong lam moi gi ca.
    //
    // Giu dung khuon cua `trend-ui` (`hooks/use-profile.tsx`) va cua
    // `use-permissions.ts` (`[QUERYKEY.authScope]`).
    queryKey: [QUERYKEY.profile],
    queryFn: async () => getProfile(),
  })
}

export const useUpdateProfile = () => {
  return useMutation({
    mutationFn: async (data: IUpdateProfileRequest) => {
      return updateProfile(data)
    },
  })
}

export const useUpdatePassword = () => {
  return useMutation({
    mutationFn: async (data: IUpdatePasswordRequest) => {
      return updatePassword(data)
    },
  })
}

export const useUploadProfilePicture = () => {
  return useMutation({
    mutationFn: async (file: File) => {
      return uploadProfilePicture(file)
    },
  })
}

export const useDeleteAccount = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: IDeleteAccountRequest) => {
      return deleteAccount(data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...QUERYKEY.account] })
    },
  })
}


