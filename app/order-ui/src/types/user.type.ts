import { Role } from '@/constants/role'
import { IPermission } from './permissions.type'
import { IBase } from './base.type'
import { UserRequirementKey, UserRequirementLevel, UserRequirementScope, UserRequirementStatus } from '@/constants/user.constants'


export enum UserStatisticsGroupBy {
  HOUR = 'hour',
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
  YEAR = 'year'
}


/**
 * Người nhận thẻ quà, trả về từ `GET {terminal}/user/lookup-recipient`.
 *
 * Cố ý **HẸP hơn `IUserInfo`**: backend chỉ trả đúng bốn field này. Đừng mở
 * rộng nó ra thành `IUserInfo` — màn KHÁCH không được thấy email / dob /
 * address / role / điểm / ví của người khác. Đó là cả lý do route này tồn tại.
 */
export interface IGiftCardRecipient {
  slug: string
  phonenumber: string
  firstName?: string
  lastName?: string
}

export interface IUserInfo {
  slug: string
  image?: string
  phonenumber: string
  firstName: string
  lastName: string
  dob: string
  email: string
  address: string
  language: string
  membershipCard?: {
    isActive: boolean
    expiredAt: string
    createdAt: string
    slug: string
  }
  userRequirements: {
    createdAt: string
    slug: string
    key: UserRequirementKey
    status: UserRequirementStatus
    level: UserRequirementLevel
    scope: UserRequirementScope
    expiredAt: string
    lastUpdatedAt: string
  }[]
  branch: {
    addressDetail: {
      lat: number
      lng: number
    }
    slug: string
    name: string
    address: string
  } | null
  role: {
    name: Role
    slug: string
    createdAt: string
    description: string
    // OPTIONAL từ giai đoạn 1. `terminal` VẪN trả field này (khác `trend`, xem
    // ghi chú tại `AuthService.getProfile`) — đánh optional là để ba nơi tiêu
    // thụ nó buộc phải null-safe NGAY BÂY GIỜ, để ngày nó thật sự bị bỏ thì
    // không chỗ nào nổ:
    //
    //   app/system/chef-area/page.tsx
    //   app/system/order-management/.../order-history-columns.tsx
    //   components/app/tabscontent/system-chef-area-management.tabscontent.tsx
    //
    // ⚠️ Ba chỗ đó cần mã của TỪNG AUTHORITY (`VIEW_KITCHEN_AREA`,
    // `DELETE_ORDER`...), còn `getAuthScope()` chỉ trả mã của AUTHORITY GROUP.
    // Hai độ hạt khác nhau — đừng thay thế bằng `usePermissions()`.
    //
    // Nguồn field trong `IUserInfo`, để không tra nhầm chỗ:
    //   identity (phonenumber, firstName, lastName, dob, email, address, image,
    //   isVerified*, language, isActive) ← shared-user, terminal ghép sẵn
    //   role.name/slug/description + branch  ← terminal
    //   quyền để ĐIỀU HƯỚNG (group codes)    ← getAuthScope() / usePermissions()
    permissions?: IPermission[]
  }
  isVerifiedEmail: boolean
  isVerifiedPhonenumber: boolean
  isActive: boolean
}

export interface ICreateUserRequest {
  phonenumber: string
  isVerifiedPhonenumber?: boolean
  password: string
  confirmPassword: string
  firstName?: string
  lastName?: string
  dob?: string | null
  branch?: string
  role: string
}

export interface IUpdateUserRequest {
  slug: string
  // phonenumber: string
  firstName: string
  lastName: string
  dob?: string | null
  // email: string
  address: string
  branch?: string
}

export interface IUserQuery {
  branch?: string
  phonenumber?: string
  membershipCard?: string
  identityCode?: string
  slug?: string // for get user by slug
  page: number | 1
  size: number | 10
  order: 'ASC' | 'DESC'
  hasPaging?: boolean
  role?: string
}

export interface IUpdateProfileRequest {
  firstName: string
  lastName: string
  dob?: string | null
  address: string
  branch?: string
}

export interface IUpdatePasswordRequest {
  oldPassword: string
  newPassword: string
}

export interface IUpdateUserRoleRequest {
  slug: string
  role: string
}

export interface ICreateUserGroupRequest {
  name: string
  description?: string
}

export interface ICreateMembershipCardRequest {
  user: string
  code: string
  expiredAt: string
}

export interface ICreateMultipleMembershipCardRequest {
  userGroup: string | null
  codes: string[]
  expiredAt: string
}

export interface IReplaceMembershipCardRequest {
  user: string
  code: string
  expiredAt: string
}

export interface IUserGroup extends IBase {
  name: string
  description?: string
  createdBy: {
    slug: string
    firstName: string
    lastName: string
    phonenumber: string
  }
}

export interface IGetAllUserGroupRequest {
  hasPaging?: boolean
  page?: number | 1
  size?: number | 10
  sort?: string[]
  name?: string
  voucher?: string
  isAppliedVoucher?: boolean
  phonenumber?: string
}

export interface IUpdateUserGroupRequest {
  slug: string
  name: string
  description?: string
}

export interface IAddUserGroupMemberRequest {
  user: string
  userGroup: string
}

export interface IAddMultipleUserGroupMemberRequest {
  users: string[]
  userGroup: string
}

export interface IUserGroupMember extends IBase {
  user: IUserInfo
  userGroup: {
    name: string
    description: string
    createdBy: {
      slug: string
      firstName: string
      lastName: string
      phonenumber: string
    }
    slug: string
    createdAt: string
  }
  createdBy: {
    slug: string
    firstName: string
    lastName: string
    phonenumber: string
  }
}

export interface IGetUserGroupMemberRequest {
  userGroup: string
  page: number | 1
  size: number | 10
  hasPaging?: boolean
  phonenumber?: string
}

export interface ICompleteRegistrationRequest {
  slug: string // user slug
  phonenumber: string
  password: string
}

export interface IDeleteAccountRequest {
  password: string
}
