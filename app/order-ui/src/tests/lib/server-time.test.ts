import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  serverNow,
  setServerTimeOffsetFromHeader,
  getServerTimeOffsetMs,
  _resetServerTimeOffsetForTests,
} from '@/lib/server-time'

describe('server-time offset', () => {
  beforeEach(() => {
    _resetServerTimeOffsetForTests()
  })

  it('serverNow equals Date.now() when no offset set', () => {
    const before = Date.now()
    const t = serverNow()
    const after = Date.now()
    expect(t).toBeGreaterThanOrEqual(before)
    expect(t).toBeLessThanOrEqual(after)
  })

  it('updates offset from valid HTTP Date header', () => {
    const fakeNow = 1_700_000_000_000
    vi.spyOn(Date, 'now').mockReturnValue(fakeNow)
    const serverDate = new Date(fakeNow + 5 * 60_000).toUTCString()
    setServerTimeOffsetFromHeader(serverDate)
    expect(getServerTimeOffsetMs()).toBe(5 * 60_000)
    expect(serverNow()).toBe(fakeNow + 5 * 60_000)
    vi.restoreAllMocks()
  })

  it('ignores invalid / missing Date header', () => {
    setServerTimeOffsetFromHeader(undefined)
    expect(getServerTimeOffsetMs()).toBe(0)
    setServerTimeOffsetFromHeader('not-a-date')
    expect(getServerTimeOffsetMs()).toBe(0)
  })

  it('smooths offset (only updates when |delta| > 1s) to avoid jitter', () => {
    const fakeNow = 1_700_000_000_000
    vi.spyOn(Date, 'now').mockReturnValue(fakeNow)
    setServerTimeOffsetFromHeader(new Date(fakeNow + 10_000).toUTCString())
    expect(getServerTimeOffsetMs()).toBe(10_000)
    setServerTimeOffsetFromHeader(new Date(fakeNow + 10_500).toUTCString())
    expect(getServerTimeOffsetMs()).toBe(10_000)
    setServerTimeOffsetFromHeader(new Date(fakeNow + 12_000).toUTCString())
    expect(getServerTimeOffsetMs()).toBe(12_000)
    vi.restoreAllMocks()
  })
})
