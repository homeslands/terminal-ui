// ============================================================================
// TOÀN BỘ tệp này gọi `http` (terminal) — và việc cần làm ở giai đoạn 1 là
// ĐỪNG ĐỔI.
//
// Vì sao `resetPassword`/`lockUser` gọi `terminal` chứ không gọi thẳng
// `shared-user`: quyền quyết định là **chức vụ trong cửa hàng**, dữ kiện đó nằm
// ở `terminal`. Gọi thẳng `shared-user` là để nó gác bằng bản `role_tbl` của
// chính nó — thứ không ai cập nhật khi `terminal` gán role ⇒ admin vừa được cấp
// quyền bị 403 oan. Đó là rủi ro R1 mà `trend-ui` mất một đợt đi-rồi-về mới
// đóng được; `terminal-ui` bỏ qua vòng đó.
//
// Mọi hàm quản trị truyền `user.slug` CỤC BỘ, không truyền `phonenumber`.
// ============================================================================
import { http } from '@/utils'
import {
  IApiResponse,
  IGiftCardRecipient,
  IUserInfo,
  IPaginationResponse,
  IUserQuery,
  ICreateUserRequest,
  IUpdateUserRequest,
  ICreateUserGroupRequest,
  IUserGroup,
  IUpdateUserGroupRequest,
  IAddUserGroupMemberRequest,
  IAddMultipleUserGroupMemberRequest,
  IUserGroupMember,
  IGetAllUserGroupRequest,
  IGetUserGroupMemberRequest,
  ICreateMembershipCardRequest,
  ICreateMultipleMembershipCardRequest,
  IReplaceMembershipCardRequest,
  ICompleteRegistrationRequest,
} from '@/types'

export async function getUsers(
  params: IUserQuery | null,
): Promise<IApiResponse<IPaginationResponse<IUserInfo>>> {
  const response = await http.get<IApiResponse<IPaginationResponse<IUserInfo>>>(
    '/user',
    {
      params,
    },
  )
  return response.data
}

/**
 * Tra NGƯỜI NHẬN thẻ quà theo SĐT — cửa HẸP thay cho `GET /user` ở màn KHÁCH.
 *
 * `GET /user` từ giai đoạn 1 đã gác bằng role và **không nhận `Customer`** (nó
 * trả cả danh sách khách kèm SĐT / họ tên / email). Màn khách mua thẻ quà tặng
 * người khác thì vẫn cần tra một người nhận, nên backend tách route riêng: khớp
 * SĐT **tuyệt đối**, trả **tối đa 1 người**, chỉ `slug` + `phonenumber` + họ tên.
 *
 * Dùng `http` (terminal), không phải `httpAuth` — và **không** quay lại
 * `GET {shared-user}/user?phonenumber=` (khớp chuỗi con, chính là R6).
 */
export async function lookupGiftCardRecipient(
  phonenumber: string,
): Promise<IApiResponse<IGiftCardRecipient[]>> {
  const response = await http.get<IApiResponse<IGiftCardRecipient[]>>(
    '/user/lookup-recipient',
    { params: { phonenumber } },
  )
  return response.data
}

export async function getUserBySlug(
  slug: string,
): Promise<IApiResponse<IUserInfo>> {
  const response = await http.get<IApiResponse<IUserInfo>>(`/user/${slug}`)
  return response.data
}

export async function resetPassword(user: string): Promise<IApiResponse<null>> {
  const response = await http.post<IApiResponse<null>>(
    `/user/${user}/reset-password`,
  )
  return response.data
}

export async function updateUserRole(
  slug: string,
  role: string,
): Promise<IApiResponse<null>> {
  const response = await http.post<IApiResponse<null>>(`/user/${slug}/role`, {
    role,
  })
  return response.data
}

export async function createUser(
  data: ICreateUserRequest,
): Promise<IApiResponse<IUserInfo>> {
  const response = await http.post<IApiResponse<IUserInfo>>('/user', data)
  return response.data
}

export async function updateUser(
  data: IUpdateUserRequest,
): Promise<IApiResponse<IUserInfo>> {
  const response = await http.patch<IApiResponse<IUserInfo>>(
    `/user/${data.slug}`,
    data,
  )
  return response.data
}

export async function lockUser(slug: string): Promise<IApiResponse<null>> {
  const response = await http.patch<IApiResponse<null>>(
    `/user/${slug}/toggle-active`,
  )
  return response.data
}

export async function createUserGroup(
  data: ICreateUserGroupRequest,
): Promise<IApiResponse<IUserGroup>> {
  const response = await http.post<IApiResponse<IUserGroup>>(
    '/user-group',
    data,
  )
  return response.data
}

export async function getAllUserGroups(
  params: IGetAllUserGroupRequest,
): Promise<IApiResponse<IPaginationResponse<IUserGroup>>> {
  const response = await http.get<
    IApiResponse<IPaginationResponse<IUserGroup>>
  >('/user-group', {
    params,
  })
  return response.data
}

export async function getUserGroupBySlug(
  slug: string,
): Promise<IApiResponse<IUserGroup>> {
  const response = await http.get<IApiResponse<IUserGroup>>(
    `/user-group/${slug}`,
  )
  return response.data
}

export async function updateUserGroup(
  param: IUpdateUserGroupRequest,
): Promise<IApiResponse<IUserGroup>> {
  const response = await http.patch<IApiResponse<IUserGroup>>(
    `/user-group/${param.slug}`,
    param,
  )
  return response.data
}

export async function deleteUserGroup(
  slug: string,
): Promise<IApiResponse<null>> {
  const response = await http.delete<IApiResponse<null>>(`/user-group/${slug}`)
  return response.data
}

// user group member
export async function addUserGroupMember(
  data: IAddUserGroupMemberRequest,
): Promise<IApiResponse<null>> {
  const response = await http.post<IApiResponse<null>>(
    `/user-group-member`,
    data,
  )
  return response.data
}

export async function addMultipleUserGroupMember(
  data: IAddMultipleUserGroupMemberRequest,
): Promise<IApiResponse<null>> {
  const response = await http.post<IApiResponse<null>>(
    `/user-group-member/bulk`,
    data,
  )
  return response.data
}

export async function getUserGroupMembers(
  params: IGetUserGroupMemberRequest,
): Promise<IApiResponse<IPaginationResponse<IUserGroupMember>>> {
  const response = await http.get<
    IApiResponse<IPaginationResponse<IUserGroupMember>>
  >(`/user-group-member`, {
    params,
  })
  return response.data
}

export async function getUserGroupMemberBySlug(
  slug: string,
): Promise<IApiResponse<IUserGroupMember>> {
  const response = await http.get<IApiResponse<IUserGroupMember>>(
    `/user-group-member/${slug}`,
  )
  return response.data
}

export async function deleteUserGroupMember(
  slug: string,
): Promise<IApiResponse<null>> {
  const response = await http.delete<IApiResponse<null>>(
    `/user-group-member/${slug}`,
  )
  return response.data
}

// Membership card
export async function createMembershipCard(
  data: ICreateMembershipCardRequest,
): Promise<IApiResponse<IUserInfo>> {
  const response = await http.post<IApiResponse<IUserInfo>>(
    '/membership-card',
    data,
  )
  return response.data
}

export async function createMultipleMembershipCard(
  data: ICreateMultipleMembershipCardRequest,
): Promise<IApiResponse<IUserInfo>> {
  const response = await http.post<IApiResponse<IUserInfo>>(
    '/membership-card/bulk',
    data,
  )
  return response.data
}

export async function toggleMembershipCard(
  slug: string,
): Promise<IApiResponse<null>> {
  const response = await http.patch<IApiResponse<null>>(
    `/membership-card/user/${slug}/toggle-active`,
  )
  return response.data
}

export async function replaceMembershipCard(
  data: IReplaceMembershipCardRequest,
): Promise<IApiResponse<IUserInfo>> {
  const response = await http.patch<IApiResponse<IUserInfo>>(
    '/membership-card/replace',
    data,
  )
  return response.data
}

export async function deleteMembershipCard(
  slug: string,
): Promise<IApiResponse<null>> {
  const response = await http.delete<IApiResponse<null>>(
    `/membership-card/user/${slug}`,
  )
  return response.data
}

export async function completeRegistration(
  data: ICompleteRegistrationRequest,
): Promise<IApiResponse<IUserInfo>> {
  const response = await http.patch<IApiResponse<IUserInfo>>(
    `/user/${data.slug}/complete-registration`,
    data,
  )
  return response.data
}

export async function getUserIdentityCode(): Promise<IApiResponse<{identityCode: string}>> {
  const response = await http.get<IApiResponse<{identityCode: string}>>(
    `/user/identity-code`,
  )
  return response.data
}