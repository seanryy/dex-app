import { execFile } from 'child_process'
import { promisify } from 'util'

const exec = promisify(execFile)

export interface NowPlaying {
  isPlaying: boolean
  track: string
  artist: string
  album: string
  duration: number
  position: number
  artworkUrl?: string
}

async function runAppleScript(script: string): Promise<string> {
  try {
    const { stdout } = await exec('osascript', ['-e', script], { timeout: 5000 })
    return stdout.trim()
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(`AppleScript error: ${msg}`)
  }
}

export async function isAppleMusicAvailable(): Promise<boolean> {
  if (process.platform !== 'darwin') return false
  try {
    await exec('mdfind', ['kMDItemCFBundleIdentifier == "com.apple.Music"'], { timeout: 3000 })
    return true
  } catch {
    return false
  }
}

export async function getNowPlaying(): Promise<NowPlaying> {
  const script = `
tell application "Music"
  if player state is not stopped then
    set t to current track
    set p to (player state is playing)
    set n to name of t
    set a to artist of t
    set al to album of t
    set d to duration of t
    set pos to player position
    return (p as text) & "||" & n & "||" & a & "||" & al & "||" & (d as text) & "||" & (pos as text)
  else
    return "stopped"
  end if
end tell`
  const result = await runAppleScript(script)
  if (result === 'stopped') {
    return { isPlaying: false, track: '', artist: '', album: '', duration: 0, position: 0 }
  }
  const [playing, track, artist, album, duration, position] = result.split('||')
  return {
    isPlaying: playing === 'true',
    track,
    artist,
    album,
    duration: parseFloat(duration) || 0,
    position: parseFloat(position) || 0
  }
}

export async function play(): Promise<string> {
  return runAppleScript('tell application "Music" to play')
}

export async function pause(): Promise<string> {
  return runAppleScript('tell application "Music" to pause')
}

export async function togglePlayPause(): Promise<string> {
  return runAppleScript('tell application "Music" to playpause')
}

export async function nextTrack(): Promise<string> {
  return runAppleScript('tell application "Music" to next track')
}

export async function previousTrack(): Promise<string> {
  return runAppleScript('tell application "Music" to previous track')
}

export async function setVolume(level: number): Promise<string> {
  const v = Math.max(0, Math.min(100, Math.round(level)))
  return runAppleScript(`tell application "Music" to set sound volume to ${v}`)
}

export async function getVolume(): Promise<number> {
  const result = await runAppleScript('tell application "Music" to get sound volume')
  return parseInt(result) || 0
}

export async function searchLibrary(query: string): Promise<{ name: string; artist: string }[]> {
  const safe = query.replace(/"/g, '\\"')
  const script = `
tell application "Music"
  set trackList to every track of playlist "Library" whose name contains "${safe}"
  set output to ""
  repeat with t in trackList
    set output to output & (name of t) & "||" & (artist of t) & linefeed
  end repeat
  return output
end tell`
  const result = await runAppleScript(script)
  if (!result) return []
  return result.split('\n').filter(Boolean).map(line => {
    const [name, artist] = line.split('||')
    return { name: name?.trim() || '', artist: artist?.trim() || '' }
  })
}

export async function playSong(song: string): Promise<string> {
  const safe = song.replace(/"/g, '\\"')
  const script = `
tell application "Music"
  set theTrack to first track of playlist "Library" whose name is "${safe}"
  play theTrack
  return "Now playing: " & (name of theTrack) & " by " & (artist of theTrack)
end tell`
  return runAppleScript(script)
}

export async function getLibraryStats(): Promise<{ totalTracks: number; totalPlaylists: number }> {
  const script = `
tell application "Music"
  set totalTracks to count of every track of playlist "Library"
  set totalPlaylists to count of user playlists
  return (totalTracks as text) & "||" & (totalPlaylists as text)
end tell`
  const result = await runAppleScript(script)
  const [tracks, playlists] = result.split('||')
  return { totalTracks: parseInt(tracks) || 0, totalPlaylists: parseInt(playlists) || 0 }
}

export async function getPlaylists(): Promise<string[]> {
  const script = `
tell application "Music"
  set pls to name of every user playlist
  set output to ""
  repeat with p in pls
    set output to output & p & linefeed
  end repeat
  return output
end tell`
  const result = await runAppleScript(script)
  return result.split('\n').filter(Boolean)
}

export async function playPlaylist(name: string): Promise<string> {
  const safe = name.replace(/"/g, '\\"')
  return runAppleScript(`tell application "Music" to play playlist "${safe}"`)
}
