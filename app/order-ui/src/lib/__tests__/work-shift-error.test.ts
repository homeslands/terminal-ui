import { describe, it, expect } from 'vitest'
import { getApiErrorCode } from '../api-error'
import { WORK_SHIFT_ERROR_CODE } from '@/constants/work-shift'

describe('getApiErrorCode', () => {
  it('reads statusCode from axios-style error response', () => {
    const err = { response: { data: { statusCode: 161003 } } }
    expect(getApiErrorCode(err)).toBe(161003)
  })

  it('falls back to legacy code field when statusCode is absent', () => {
    const err = { response: { data: { code: 161006 } } }
    expect(getApiErrorCode(err)).toBe(161006)
  })

  it('prefers statusCode over legacy code', () => {
    const err = { response: { data: { statusCode: 161003, code: 999 } } }
    expect(getApiErrorCode(err)).toBe(161003)
  })

  it('returns undefined for non-api errors', () => {
    expect(getApiErrorCode(new Error('boom'))).toBeUndefined()
    expect(getApiErrorCode(null)).toBeUndefined()
    expect(getApiErrorCode(undefined)).toBeUndefined()
  })
})

describe('WORK_SHIFT_ERROR_CODE', () => {
  it('maps every documented work-shift error code', () => {
    expect(WORK_SHIFT_ERROR_CODE.NOT_FOUND).toBe(161000)
    expect(WORK_SHIFT_ERROR_CODE.BRANCH_HAS_ACTIVE).toBe(161001)
    expect(WORK_SHIFT_ERROR_CODE.NO_ACTIVE).toBe(161002)
    expect(WORK_SHIFT_ERROR_CODE.BRANCH_NO_ACTIVE).toBe(161003)
    expect(WORK_SHIFT_ERROR_CODE.FORBIDDEN).toBe(161004)
    expect(WORK_SHIFT_ERROR_CODE.NOT_ACTIVE).toBe(161005)
    expect(WORK_SHIFT_ERROR_CODE.PAYMENT_FORBIDDEN_FOR_STAFF).toBe(161006)
  })
})
