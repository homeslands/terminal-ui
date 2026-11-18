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

// Step 7.8: query of GET {shared-user}/point-transaction (self view). The user
// comes from the JWT, the query names nobody; the dates are startDate / endDate
// there (fromDate / toDate are the names of the terminal routes).
export interface IMyPointTransactionQuery {
  page?: number
  size?: number
  type?: PointTransactionType | null
  startDate?: string // YYYY-MM-DD format
  endDate?: string // YYYY-MM-DD format
}

export interface UsePointTransactionsFilters {
  fromDate?: string
  toDate?: string
  type?: PointTransactionType
}
