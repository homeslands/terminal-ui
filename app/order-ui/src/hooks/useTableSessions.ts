import { useTableSessionsStore, type ITableSessionsStore } from '@/stores'

export type UseTableSessions = ITableSessionsStore

export function useTableSessions(): UseTableSessions {
  return useTableSessionsStore()
}
