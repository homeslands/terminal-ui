import { describe, it, expect } from 'vitest'
import { VAT_PERMISSIONS } from '@/constants/vat-permissions'

describe('VAT_PERMISSIONS', () => {
  it('exposes 4 permission code constants with exact BE-contract strings', () => {
    expect(VAT_PERMISSIONS.VIEW).toBe('VIEW_VAT_REQUEST')
    expect(VAT_PERMISSIONS.EDIT).toBe('EDIT_VAT_REQUEST')
    expect(VAT_PERMISSIONS.EDIT_ACCOUNTANT).toBe('EDIT_ACCOUNTANT_INFO')
    expect(VAT_PERMISSIONS.UPDATE_STATUS).toBe('UPDATE_VAT_STATUS')
  })

  it('has 4 keys and no extras', () => {
    expect(Object.keys(VAT_PERMISSIONS).sort()).toEqual([
      'EDIT',
      'EDIT_ACCOUNTANT',
      'UPDATE_STATUS',
      'VIEW',
    ])
  })
})
