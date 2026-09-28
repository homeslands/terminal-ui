import { describe, it, expect } from 'vitest'
import { vatSubmitSchema } from '@/schemas/vat.schema'

describe('vatSubmitSchema', () => {
  const valid = {
    customerName: 'Công ty ABC',
    taxCode: '0123456789',
    address: '123 Nguyễn Huệ',
    email: 'abc@xyz.com',
  }

  it('accepts valid minimal payload (no companyName/note)', () => {
    expect(vatSubmitSchema.safeParse(valid).success).toBe(true)
  })

  it('accepts with optional fields', () => {
    expect(
      vatSubmitSchema.safeParse({
        ...valid,
        companyName: 'TNHH ABC',
        note: 'gấp',
      }).success,
    ).toBe(true)
  })

  it('rejects 9-digit taxCode', () => {
    expect(
      vatSubmitSchema.safeParse({ ...valid, taxCode: '012345678' }).success,
    ).toBe(false)
  })

  it('accepts 10-digit taxCode', () => {
    expect(
      vatSubmitSchema.safeParse({ ...valid, taxCode: '0123456789' }).success,
    ).toBe(true)
  })

  it('rejects 11-digit taxCode', () => {
    expect(
      vatSubmitSchema.safeParse({ ...valid, taxCode: '01234567890' }).success,
    ).toBe(false)
  })

  it('accepts 13-digit taxCode', () => {
    expect(
      vatSubmitSchema.safeParse({ ...valid, taxCode: '0123456789012' })
        .success,
    ).toBe(true)
  })

  it('rejects taxCode with non-digits', () => {
    expect(
      vatSubmitSchema.safeParse({ ...valid, taxCode: '012345678a' }).success,
    ).toBe(false)
  })

  it('rejects invalid email', () => {
    expect(
      vatSubmitSchema.safeParse({ ...valid, email: 'not-email' }).success,
    ).toBe(false)
  })

  it('rejects empty customerName', () => {
    expect(
      vatSubmitSchema.safeParse({ ...valid, customerName: '' }).success,
    ).toBe(false)
  })

  it('rejects empty address', () => {
    expect(
      vatSubmitSchema.safeParse({ ...valid, address: '' }).success,
    ).toBe(false)
  })
})
