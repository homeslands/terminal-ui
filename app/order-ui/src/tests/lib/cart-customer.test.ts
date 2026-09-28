import { describe, it, expect } from 'vitest'
import { deriveSessionCustomer } from '@/lib/cart-customer'
import { Role } from '@/constants'

const customerOwner = {
  slug: 'u1',
  firstName: 'Jane',
  lastName: 'Doe',
  phonenumber: '0900000000',
  role: { name: Role.CUSTOMER },
}

describe('deriveSessionCustomer', () => {
  it('returns null when session has no customer and no owner', () => {
    expect(deriveSessionCustomer(null, null)).toBe(null)
    expect(deriveSessionCustomer(undefined, undefined)).toBe(null)
  })

  it('returns session.customer when present (FE wins)', () => {
    const session = { slug: 's1', firstName: 'A', lastName: 'B', phonenumber: '1' }
    expect(deriveSessionCustomer(session, customerOwner)).toBe(session)
  })

  it('returns owner mapped when role is CUSTOMER and phone not default', () => {
    expect(deriveSessionCustomer(null, customerOwner)).toEqual({
      slug: 'u1',
      firstName: 'Jane',
      lastName: 'Doe',
      phonenumber: '0900000000',
    })
  })

  it('returns null when owner role is not CUSTOMER', () => {
    const staff = { ...customerOwner, role: { name: Role.STAFF } }
    expect(deriveSessionCustomer(null, staff)).toBe(null)
  })

  it('returns null when phonenumber is default-customer placeholder', () => {
    const placeholder = { ...customerOwner, phonenumber: 'default-customer' }
    expect(deriveSessionCustomer(null, placeholder)).toBe(null)
  })

  it('handles missing firstName/lastName/phonenumber with empty strings', () => {
    const sparse = { slug: 'u2', role: { name: Role.CUSTOMER }, phonenumber: '1' }
    expect(deriveSessionCustomer(null, sparse)).toEqual({
      slug: 'u2',
      firstName: '',
      lastName: '',
      phonenumber: '1',
    })
  })
})
