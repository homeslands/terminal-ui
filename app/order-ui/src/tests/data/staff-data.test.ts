import { describe, it, expect } from 'vitest'
import {
  STAFF_TABLES,
  STAFF_CATEGORIES,
  STAFF_MENU_ITEMS,
  STAFF_ADMIN_SETTINGS,
  generatePresets,
} from '@/data/staff-data'

describe('staff seed data', () => {
  it('exports exactly 12 tables labelled Bàn 01..Bàn 12', () => {
    expect(STAFF_TABLES).toHaveLength(12)
    expect(STAFF_TABLES[0].label).toBe('Bàn 01')
    expect(STAFF_TABLES[11].label).toBe('Bàn 12')
    STAFF_TABLES.forEach((t) => {
      expect(typeof t.id).toBe('string')
      expect(typeof t.seats).toBe('number')
    })
  })

  it('exports 10 categories with unique ids', () => {
    expect(STAFF_CATEGORIES).toHaveLength(10)
    const ids = new Set(STAFF_CATEGORIES.map((c) => c.id))
    expect(ids.size).toBe(10)
  })

  it('exports 45 menu items each referencing a known category', () => {
    expect(STAFF_MENU_ITEMS).toHaveLength(45)
    const catIds = new Set(STAFF_CATEGORIES.map((c) => c.id))
    STAFF_MENU_ITEMS.forEach((m) => {
      expect(catIds.has(m.categoryId)).toBe(true)
      expect(m.priceNum).toBeGreaterThan(0)
      expect(m.price).toMatch(/đ$/)
    })
  })

  it('admin settings expose pin, vatRate and restaurant info', () => {
    expect(STAFF_ADMIN_SETTINGS.pin).toMatch(/^\d{4,}$/)
    expect(STAFF_ADMIN_SETTINGS.vatRate).toBeGreaterThan(0)
    expect(STAFF_ADMIN_SETTINGS.vatRate).toBeLessThan(1)
    expect(STAFF_ADMIN_SETTINGS.restaurantName.length).toBeGreaterThan(0)
    expect(STAFF_ADMIN_SETTINGS.taxCode.length).toBeGreaterThan(0)
  })
})

describe('generatePresets', () => {
  it('returns 4 ascending presets starting with the total', () => {
    const presets = generatePresets(340_000)
    expect(presets).toHaveLength(4)
    expect(presets[0]).toBe(340_000)
    for (let i = 1; i < presets.length; i++) {
      expect(presets[i]).toBeGreaterThan(presets[i - 1])
    }
  })

  it('rounds 340000 to [340000, 350000, 400000, 500000]', () => {
    expect(generatePresets(340_000)).toEqual([340_000, 350_000, 400_000, 500_000])
  })

  it('handles exact 50k multiple (e.g. 250000)', () => {
    const p = generatePresets(250_000)
    expect(p[0]).toBe(250_000)
    expect(p).toHaveLength(4)
    expect(new Set(p).size).toBe(4)
  })

  it('handles totals already past 500k (e.g. 720000)', () => {
    const p = generatePresets(720_000)
    expect(p[0]).toBe(720_000)
    expect(p).toHaveLength(4)
    expect(p[p.length - 1]).toBeGreaterThanOrEqual(720_000)
    expect(new Set(p).size).toBe(4)
  })
})
