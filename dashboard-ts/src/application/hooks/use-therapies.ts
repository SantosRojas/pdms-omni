import { useState, useCallback, useEffect, useRef } from "react"
import type { Therapy, TherapiesResponse } from "@/domain/entities/therapy"
import { therapyApi } from "@/infrastructure/api/therapy-api"

interface UseTherapiesReturn {
  therapies: Therapy[]
  total: number
  page: number
  pageSize: number
  search: string
  dateFrom: string
  dateTo: string
  loading: boolean
  setPage: (page: number) => void
  setSearch: (search: string) => void
  setDateFrom: (date: string) => void
  setDateTo: (date: string) => void
  clearFilters: () => void
  loadMore: () => void
  reload: () => Promise<void>
  closeTherapy: (id: number) => Promise<void>
}

export function useTherapies(pageSize = 10): UseTherapiesReturn {
  const [therapies, setTherapies] = useState<Therapy[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearchState] = useState("")
  const [dateFrom, setDateFromState] = useState("")
  const [dateTo, setDateToState] = useState("")
  const [loading, setLoading] = useState(true)

  const fetchIdRef = useRef(0)

  const fetch = useCallback(async (p: number, s: string, df: string, dt: string) => {
    const id = ++fetchIdRef.current
    setLoading(true)
    try {
      const res: TherapiesResponse = await therapyApi.list(p, pageSize, s || undefined, undefined, df || undefined, dt || undefined)
      if (id !== fetchIdRef.current) return
      setTherapies(p === 1 ? res.therapies : (prev) => [...prev, ...res.therapies])
      setTotal(res.total)
    } catch {
      // ignore
    } finally {
      if (id === fetchIdRef.current) setLoading(false)
    }
  }, [pageSize])

  const reload = useCallback(async () => {
    setPage(1)
    await fetch(1, search, dateFrom, dateTo)
  }, [fetch, search, dateFrom, dateTo])

  useEffect(() => {
    let cancelled = false
    therapyApi.list(1, pageSize)
      .then((res) => {
        if (cancelled) return
        setTherapies(res.therapies)
        setTotal(res.total)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [pageSize])

  const closeTherapy = useCallback(async (id: number) => {
    await therapyApi.close(id)
    await reload()
  }, [reload])

  const loadMore = useCallback(() => {
    if (loading || therapies.length >= total) return
    const next = page + 1
    setPage(next)
    fetch(next, search, dateFrom, dateTo)
  }, [loading, therapies.length, total, page, fetch, search, dateFrom, dateTo])

  const setSearch = useCallback((s: string) => {
    setSearchState(s)
    setPage(1)
    fetch(1, s, dateFrom, dateTo)
  }, [fetch, dateFrom, dateTo])

  const setDateFrom = useCallback((d: string) => {
    setDateFromState(d)
    setPage(1)
    fetch(1, search, d, dateTo)
  }, [fetch, search, dateTo])

  const setDateTo = useCallback((d: string) => {
    setDateToState(d)
    setPage(1)
    fetch(1, search, dateFrom, d)
  }, [fetch, search, dateFrom])

  const clearFilters = useCallback(() => {
    setSearchState("")
    setDateFromState("")
    setDateToState("")
    setPage(1)
    fetch(1, "", "", "")
  }, [fetch])

  return {
    therapies,
    total,
    page,
    pageSize,
    search,
    dateFrom,
    dateTo,
    loading,
    setPage: (p: number) => {
      setPage(p)
      fetch(p, search, dateFrom, dateTo)
    },
    setSearch,
    setDateFrom,
    setDateTo,
    clearFilters,
    loadMore,
    reload,
    closeTherapy,
  }
}
