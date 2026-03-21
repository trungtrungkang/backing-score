import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PlayerControls } from '@/components/player/PlayerControls'
import type { AudioTrack } from '@/lib/daw/types'

describe('PlayerControls', () => {
  const defaultProps = {
    bpm: 120,
    positionMs: 60000,
    durationMs: 180000,
    isPlaying: false,
    onPlay: vi.fn(),
    onPause: vi.fn(),
    onStop: vi.fn(),
    onSeek: vi.fn(),
    playbackRate: 1,
    onPlaybackRateChange: vi.fn(),
    pitchShift: 0,
    onPitchShiftChange: vi.fn(),
    isMetronomeEnabled: false,
    onMetronomeToggle: vi.fn(),
    loopState: { enabled: false, startBar: 1, endBar: 4 },
    onLoopStateChange: vi.fn(),
    tracks: [] as AudioTrack[],
    volumes: {},
    muteByTrackId: {},
    soloByTrackId: {},
    onMuteToggle: vi.fn(),
    onSoloToggle: vi.fn(),
    onVolumeChange: vi.fn(),
    isWaitMode: false,
    onWaitModeToggle: vi.fn(),
    midiTracks: [
      { id: 0, name: 'P1' },
      { id: 1, name: 'P2' },
      { id: 2, name: 'P2' },
    ],
    practiceTrackIds: [-1],
    onPracticeTrackChange: vi.fn(),
  }

  it('renders playback times securely formatted', () => {
    render(<PlayerControls {...defaultProps} />)
    
    // 60000ms = 1:00
    expect(screen.getAllByText('1:00')[0]).toBeInTheDocument()
    // 180000ms = 3:00
    expect(screen.getAllByText('3:00')[0]).toBeInTheDocument()
  })

  it('toggles playback states explicitly', () => {
    const { rerender } = render(<PlayerControls {...defaultProps} />)
    const playButton = screen.getByTitle('Play')
    
    fireEvent.click(playButton)
    expect(defaultProps.onPlay).toHaveBeenCalled()

    rerender(<PlayerControls {...defaultProps} isPlaying={true} />)
    const pauseButton = screen.getByTitle('Pause')
    fireEvent.click(pauseButton)
    expect(defaultProps.onPause).toHaveBeenCalled()
  })

  it('renders track names cleanly and dispatches practiceTrackId updates', () => {
    render(<PlayerControls {...defaultProps} />)
    
    // Wait Mode Dropdown relies on it being open, but it's hidden under a Popover in Radix UI
    // Radix Popovers require user-event clicks. We will test the basic DOM tree instead.
    expect(screen.queryByText('P1')).not.toBeInTheDocument() // Popover is closed.
    
    // Test the physical button opening the Popover
    const waitModeBtn = screen.getByText(/Wait Mode/i)
    fireEvent.click(waitModeBtn)
    
    // Now it should be inside the DOM
    expect(screen.getByText('Practice Parts')).toBeInTheDocument()
    
    // The Wait Mode Popup maps ALL tracks plus the default "All Tracks"
    const allTracksCheckbox = screen.getByLabelText('All Tracks (Chords)')
    expect(allTracksCheckbox).toBeChecked() // Default "All Tracks"
    
    // Click explicitly on the first explicit Track P1
    const p1Checkbox = screen.getAllByLabelText('P1')[0]
    fireEvent.click(p1Checkbox)
    expect(defaultProps.onPracticeTrackChange).toHaveBeenCalledWith([0])
  })
})
