import { describe, it, expect } from 'vitest'

import { getApiErrorCode } from '@/lib/api-error'

describe('getApiErrorCode', () => {
  it('returns undefined when the error has no response data', () => {
    expect(getApiErrorCode(new Error('network'))).toBeUndefined()
    expect(getApiErrorCode(undefined)).toBeUndefined()
  })

  it('prefers statusCode over code and errorCodeValue', () => {
    const err = {
      response: { data: { statusCode: 161005, code: 1, errorCodeValue: 2 } },
    }
    expect(getApiErrorCode(err)).toBe(161005)
  })

  it('falls back to code when statusCode is absent', () => {
    const err = { response: { data: { code: 409, errorCodeValue: 2 } } }
    expect(getApiErrorCode(err)).toBe(409)
  })

  it('falls back to the legacy errorCodeValue field when neither statusCode nor code is present', () => {
    const err = { response: { data: { errorCodeValue: 101002 } } }
    expect(getApiErrorCode(err)).toBe(101002)
  })
})
