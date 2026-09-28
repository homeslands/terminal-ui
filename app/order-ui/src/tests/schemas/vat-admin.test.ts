import { describe, it, expect } from 'vitest'
import {
  vatUpdateCustomerSchema,
  vatStatusTransitionSchema,
} from '@/schemas/vat-admin.schema'
import { VatRequestStatus } from '@/types'

describe('vatUpdateCustomerSchema', () => {
  it('accepts empty object (all fields optional)', () => {
    expect(vatUpdateCustomerSchema.safeParse({}).success).toBe(true)
  })

  it('accepts taxCode with 10 digits', () => {
    const r = vatUpdateCustomerSchema.safeParse({ taxCode: '0123456789' })
    expect(r.success).toBe(true)
  })

  it('accepts taxCode with 13 digits', () => {
    const r = vatUpdateCustomerSchema.safeParse({ taxCode: '0123456789012' })
    expect(r.success).toBe(true)
  })

  it('rejects taxCode with 11 digits', () => {
    const r = vatUpdateCustomerSchema.safeParse({ taxCode: '01234567890' })
    expect(r.success).toBe(false)
  })

  it('rejects malformed email', () => {
    const r = vatUpdateCustomerSchema.safeParse({ email: 'not-an-email' })
    expect(r.success).toBe(false)
  })
})

describe('vatStatusTransitionSchema', () => {
  it('accepts COMPLETED with invoiceNumber', () => {
    const r = vatStatusTransitionSchema.safeParse({
      status: VatRequestStatus.COMPLETED,
      invoiceNumber: 'HD-001',
    })
    expect(r.success).toBe(true)
  })

  it('rejects COMPLETED without invoiceNumber', () => {
    const r = vatStatusTransitionSchema.safeParse({
      status: VatRequestStatus.COMPLETED,
    })
    expect(r.success).toBe(false)
  })

  it('accepts REJECTED with note ≥ 3 chars', () => {
    const r = vatStatusTransitionSchema.safeParse({
      status: VatRequestStatus.REJECTED,
      note: 'wrong MST',
    })
    expect(r.success).toBe(true)
  })

  it('rejects REJECTED without note', () => {
    const r = vatStatusTransitionSchema.safeParse({
      status: VatRequestStatus.REJECTED,
    })
    expect(r.success).toBe(false)
  })

  it('rejects REJECTED with note < 3 chars', () => {
    const r = vatStatusTransitionSchema.safeParse({
      status: VatRequestStatus.REJECTED,
      note: 'no',
    })
    expect(r.success).toBe(false)
  })

  it('accepts PROCESSING with no required fields', () => {
    const r = vatStatusTransitionSchema.safeParse({
      status: VatRequestStatus.PROCESSING,
    })
    expect(r.success).toBe(true)
  })

  it('accepts PENDING as transition target (free rollback allowed)', () => {
    const r = vatStatusTransitionSchema.safeParse({
      status: VatRequestStatus.PENDING,
    })
    expect(r.success).toBe(true)
  })

  it('accepts PENDING with optional invoiceNumber and note', () => {
    const r = vatStatusTransitionSchema.safeParse({
      status: VatRequestStatus.PENDING,
      invoiceNumber: 'HD-001',
      note: 'rollback reason',
    })
    expect(r.success).toBe(true)
  })
})
