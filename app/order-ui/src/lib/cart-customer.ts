import { Role } from '@/constants'
import type { TableCustomer } from '@/types/session'

interface BEOrderOwner {
  slug: string
  firstName?: string
  lastName?: string
  phonenumber?: string
  role?: { name?: string }
}

/**
 * Resolve the customer to show in the cashier UI.
 *
 * Priority: session.customer (FE pick) wins over BE order.owner. BE owner is
 * accepted as fallback only when it represents a real customer account
 * (role === CUSTOMER and phonenumber is not the `default-customer` placeholder).
 * Staff/admin owners → null so the cashier sees "no customer picked".
 */
export function deriveSessionCustomer(
  sessionCustomer: TableCustomer | null | undefined,
  fullOrderOwner: BEOrderOwner | null | undefined,
): TableCustomer | null {
  if (sessionCustomer) return sessionCustomer
  const owner = fullOrderOwner
  if (!owner) return null
  const isCustomerOwner =
    owner.role?.name === Role.CUSTOMER &&
    owner.phonenumber !== 'default-customer'
  if (!isCustomerOwner) return null
  return {
    slug: owner.slug,
    firstName: owner.firstName ?? '',
    lastName: owner.lastName ?? '',
    phonenumber: owner.phonenumber ?? '',
  }
}
