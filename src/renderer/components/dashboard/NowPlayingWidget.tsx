import { useState, useEffect, useRef } from 'react'
import {
  Music, Play, Pause, SkipBack, SkipForward,
  Volume2, VolumeX, Search, ListMusic, ChevronDown
} from 'lucide-react'
import type { NowPlayingInfo } from '../../../preload/index'

type Tab = 'player' | 'search' | 'playlists'

export function NowPlayingWidget() {
  const [available, setAvailable] = useState<boolean | null>(null)
  const [np, setNp] = useState<NowPlayingInfo | null>(null)
  const [volume, setVolume] = useState(50)
  const [tab, setTab] = useState<Tab>('player')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<{ name: string; artist: string }[]>([])
  const [playlists, setPlaylists] = useState<string[]>([])
  const [expanded, setExpanded] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval>>()

  useEffect(() => {
    window.dex.music.available().then(setAvailable)
  }, [])

  useEffect(() => {
    if (!available) return
    const poll = () => window.dex.music.nowPlaying().then(setNp)
    poll()
    pollRef.current = setInterval(poll, 3000)
    window.dex.music.getVolume().then(setVolume)
    return () => clearInterval(pollRef.current)
  }, [available])

  if (available === null || available === false) return null

  const progress = np && np.duration > 0 ? (np.position / np.duration) * 100 : 0

  async function handlePlayPause() {
    await window.dex.music.togglePlayPause()
    const updated = await window.dex.music.nowPlaying()
    setNp(updated)
  }

  async function handleNext() {
    await window.dex.music.next()
    setTimeout(async () => setNp(await window.dex.music.nowPlaying()), 500)
  }

  async function handlePrevious() {
    await window.dex.music.previous()
    setTimeout(async () => setNp(await window.dex.music.nowPlaying()), 500)
  }

  async function handleVolumeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = parseInt(e.target.value)
    setVolume(v)
    await window.dex.music.setVolume(v)
  }

  async function handleSearch() {
    if (!searchQuery.trim()) return
    const results = await window.dex.music.search(searchQuery.trim())
    setSearchResults(results)
  }

  async function handlePlaySong(song: string) {
    await window.dex.music.playSong(song)
    setTab('player')
    setTimeout(async () => setNp(await window.dex.music.nowPlaying()), 500)
  }

  async function loadPlaylists() {
    const pls = await window.dex.music.playlists()
    setPlaylists(pls)
    setTab('playlists')
  }

  async function handlePlayPlaylist(name: string) {
    await window.dex.music.playPlaylist(name)
    setTab('player')
    setTimeout(async () => setNp(await window.dex.music.nowPlaying()), 500)
  }

  function formatTime(s: number) {
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  return (
    <div className="bg-surface-1 border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-2/50 transition-colors"
      >
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-pink-500/20 to-purple-500/20 flex items-center justify-center">
          <Music className="w-4 h-4 text-pink-400" />
        </div>
        <div className="flex-1 min-w-0 text-left">
          {np?.track ? (
            <>
              <p className="text-sm font-medium text-text-primary truncate">{np.track}</p>
              <p className="text-xs text-text-tertiary truncate">{np.artist}</p>
            </>
          ) : (
            <p className="text-sm text-text-secondary">Apple Music</p>
          )}
        </div>
        {np?.track && (
          <div className="flex items-center gap-1.5 mr-1">
            {np.isPlaying && (
              <div className="flex items-end gap-[2px] h-3">
                <span className="w-[3px] bg-pink-400 rounded-full animate-bounce" style={{ height: '60%', animationDelay: '0ms' }} />
                <span className="w-[3px] bg-pink-400 rounded-full animate-bounce" style={{ height: '100%', animationDelay: '150ms' }} />
                <span className="w-[3px] bg-pink-400 rounded-full animate-bounce" style={{ height: '40%', animationDelay: '300ms' }} />
              </div>
            )}
          </div>
        )}
        <ChevronDown className={`w-4 h-4 text-text-tertiary transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {expanded && (
        <div className="border-t border-border">
          {/* Mini tabs */}
          <div className="flex border-b border-border">
            {(['player', 'search', 'playlists'] as Tab[]).map(t => (
              <button
                key={t}
                onClick={() => t === 'playlists' ? loadPlaylists() : setTab(t)}
                className={`flex-1 py-2 text-xs font-medium transition-colors
                  ${tab === t ? 'text-accent border-b border-accent' : 'text-text-tertiary hover:text-text-secondary'}`}
              >
                {t === 'player' ? 'Now Playing' : t === 'search' ? 'Search' : 'Playlists'}
              </button>
            ))}
          </div>

          {tab === 'player' && (
            <div className="px-4 py-3 space-y-3">
              {np?.track ? (
                <>
                  <div className="text-center">
                    <p className="text-sm font-medium text-text-primary">{np.track}</p>
                    <p className="text-xs text-text-tertiary">{np.artist} — {np.album}</p>
                  </div>

                  {/* Progress bar */}
                  <div>
                    <div className="w-full h-1 bg-surface-3 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-pink-500 to-purple-500 rounded-full transition-all duration-1000"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-[10px] text-text-tertiary">{formatTime(np.position)}</span>
                      <span className="text-[10px] text-text-tertiary">{formatTime(np.duration)}</span>
                    </div>
                  </div>

                  {/* Controls */}
                  <div className="flex items-center justify-center gap-4">
                    <button onClick={handlePrevious} className="p-1.5 rounded-lg hover:bg-surface-2 transition-colors">
                      <SkipBack className="w-4 h-4 text-text-secondary" />
                    </button>
                    <button
                      onClick={handlePlayPause}
                      className="w-10 h-10 rounded-full bg-accent hover:bg-accent-hover transition-colors flex items-center justify-center"
                    >
                      {np.isPlaying
                        ? <Pause className="w-4.5 h-4.5 text-white" />
                        : <Play className="w-4.5 h-4.5 text-white ml-0.5" />
                      }
                    </button>
                    <button onClick={handleNext} className="p-1.5 rounded-lg hover:bg-surface-2 transition-colors">
                      <SkipForward className="w-4 h-4 text-text-secondary" />
                    </button>
                  </div>

                  {/* Volume */}
                  <div className="flex items-center gap-2">
                    {volume === 0
                      ? <VolumeX className="w-3.5 h-3.5 text-text-tertiary flex-shrink-0" />
                      : <Volume2 className="w-3.5 h-3.5 text-text-tertiary flex-shrink-0" />
                    }
                    <input
                      type="range" min={0} max={100} value={volume}
                      onChange={handleVolumeChange}
                      className="flex-1 h-1 accent-[var(--color-accent)]"
                    />
                    <span className="text-[10px] text-text-tertiary w-6 text-right">{volume}</span>
                  </div>
                </>
              ) : (
                <div className="text-center py-4">
                  <Music className="w-8 h-8 text-text-tertiary mx-auto mb-2 opacity-40" />
                  <p className="text-xs text-text-tertiary">Nothing playing</p>
                  <p className="text-[10px] text-text-tertiary mt-1">Play something in Apple Music or search below</p>
                </div>
              )}
            </div>
          )}

          {tab === 'search' && (
            <div className="px-4 py-3 space-y-2">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-text-tertiary absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSearch()}
                    placeholder="Search your library..."
                    className="w-full bg-surface-0 border border-border rounded-lg pl-8 pr-3 py-1.5 text-xs text-text-primary
                      placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                </div>
                <button
                  onClick={handleSearch}
                  className="px-3 py-1.5 bg-accent hover:bg-accent-hover text-white rounded-lg text-xs font-medium transition-colors"
                >
                  Go
                </button>
              </div>
              <div className="max-h-40 overflow-y-auto space-y-0.5">
                {searchResults.map((t, i) => (
                  <button
                    key={i}
                    onClick={() => handlePlaySong(t.name)}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-surface-2 transition-colors flex items-center gap-2"
                  >
                    <Play className="w-3 h-3 text-text-tertiary flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs text-text-primary truncate">{t.name}</p>
                      <p className="text-[10px] text-text-tertiary truncate">{t.artist}</p>
                    </div>
                  </button>
                ))}
                {searchResults.length === 0 && searchQuery && (
                  <p className="text-xs text-text-tertiary py-3 text-center">
                    Hit Go to search your Apple Music library
                  </p>
                )}
              </div>
            </div>
          )}

          {tab === 'playlists' && (
            <div className="px-4 py-3">
              <div className="max-h-48 overflow-y-auto space-y-0.5">
                {playlists.map((pl, i) => (
                  <button
                    key={i}
                    onClick={() => handlePlayPlaylist(pl)}
                    className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-surface-2 transition-colors flex items-center gap-2"
                  >
                    <ListMusic className="w-3.5 h-3.5 text-text-tertiary flex-shrink-0" />
                    <span className="text-xs text-text-primary truncate">{pl}</span>
                  </button>
                ))}
                {playlists.length === 0 && (
                  <p className="text-xs text-text-tertiary py-3 text-center">No playlists found</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
