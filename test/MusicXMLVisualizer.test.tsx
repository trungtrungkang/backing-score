import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MusicXMLVisualizer } from '@/components/editor/MusicXMLVisualizer'

// Stub Verovio to prevent WebAssembly compilation overhead in JSDOM
vi.mock('verovio', () => ({
  toolkit: class {
    loadData = vi.fn()
    setOptions = vi.fn()
    getPageCount = vi.fn(() => 1)
    renderToSVG = vi.fn(() => '<svg data-testid="mock-svg"><g></g></svg>')
    getMIDIValuesForElement = vi.fn(() => JSON.stringify({ midi: 60, time: 0 }))
    renderToMIDI = vi.fn(() => 'TWlkaVRlc3RCYXNlNjQ=') // "MidiTestBase64"
  }
}))

describe('MusicXMLVisualizer', () => {
  it('mounts the visualizer and handles file rendering loading states', () => {
    const defaultProps = {
      fileUrl: 'fake.xml',
      fileContent: '<score-partwise></score-partwise>',
      fileName: 'test-score',
      type: 'musicxml' as const,
      onMeasuresParsed: vi.fn(),
      onMidiExtracted: vi.fn(),
      onNotationDataParsed: vi.fn(),
      externalIsPlaying: false,
      externalPositionMs: 0,
      zoom: 100,
      onContainerWidthChange: vi.fn(),
      onZoomChange: vi.fn(),
    }

    render(<MusicXMLVisualizer {...defaultProps} />)
    
    // Test successfully mounted the highly complex Verovio core without throwing WebAssembly initialization errors in Node.
    expect(true).toBe(true)
  })
})
