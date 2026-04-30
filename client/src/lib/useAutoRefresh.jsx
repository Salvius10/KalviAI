
import { useEffect, useRef, useState, useCallback } from 'react'

export function useAutoRefresh(fetchFn, intervalMs = 30000) {
  const [lastUpdated, setLastUpdated] = useState(null)
  const [secondsAgo, setSecondsAgo] = useState(0)
  const savedFetch = useRef(fetchFn)

  useEffect(() => { savedFetch.current = fetchFn }, [fetchFn])

  const refresh = useCallback(async () => {
    await savedFetch.current()
    setLastUpdated(new Date())
    setSecondsAgo(0)
  }, [])

  // Initial load
  useEffect(() => { refresh() }, [])

  // Auto-poll
  useEffect(() => {
    const id = setInterval(refresh, intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])

  // "X seconds ago" ticker
  useEffect(() => {
    if (!lastUpdated) return
    const id = setInterval(() => {
      setSecondsAgo(Math.round((Date.now() - lastUpdated.getTime()) / 1000))
    }, 1000)
    return () => clearInterval(id)
  }, [lastUpdated])

  return { lastUpdated, secondsAgo, refresh }
}

export function LiveBadge({ secondsAgo, onRefresh }) {
  return (
    <div className="flex items-center gap-2">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
      </span>
      <span className="text-xs text-green-400 font-semibold">Live</span>
      {secondsAgo > 0 && (
        <span className="text-xs text-slate-400">· {secondsAgo}s ago</span>
      )}
      <button
        onClick={onRefresh}
        className="text-xs text-slate-400 hover:text-white underline ml-1"
      >
        Refresh
      </button>
    </div>
  )
}
