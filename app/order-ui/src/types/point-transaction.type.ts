import { IUserInfo } from './user.type'
import { PointTransactionType } from '@/constants'

export interface IPointTransaction {
  slug: string
  type: string
  desc: string
  objectType: string
  objectSlug: string
  points: number
  user: IUserInfo
  userSlug: string
  createdAt?: string
}

export interface IAnalyzePointTransaction {
  totalEarned: number;
  totalSpent: number;
  netDifference: number;
}

export interface IPointTransactionQuery {
  page?: number
  size?: number
  userSlug?: string
  fromDate?: string // YYYY-MM-DD format
  toDate?: string // YYYY-MM-DD format
  type?: PointTransactionType | null
  ignoreSize?: boolean
  k?: string
}

export interface UsePointTransactionsFilters {
  fromDate?: string
  toDate?: string
  type?: PointTransactionType
}
