import { describe, it, expect } from 'vitest'
import { getPhysicalMeasure, getMeasureForTime, evaluateWaitModeMatch } from '@/lib/score/math'

describe('Timeline Matrix Utilities', () => {
  it('getPhysicalMeasure maps Repeat Signs perfectly', () => {
    // Say measure 50 is physically measure 5
    const measureMap = { 49: 4, 50: 5, 51: 6 }
    
    expect(getPhysicalMeasure(50, measureMap)).toBe(5)
    expect(getPhysicalMeasure(20, measureMap)).toBe(20) // Default fallback missing bounds natively!
    expect(getPhysicalMeasure(50, undefined)).toBe(50) // Safely fails open explicitly
  })

  it('getMeasureForTime extracts the active unrolled Virtual timeline cleanly from bounds', () => {
    const timemap = [
      { timeMs: 0, measure: 1 },
      { timeMs: 1000, measure: 2 },
      { timeMs: 2000, measure: 3 },
      { timeMs: 3000, measure: 4 }
    ]
    
    expect(getMeasureForTime(timemap, 500)).toBe(1)
    expect(getMeasureForTime(timemap, 1000)).toBe(2)
    expect(getMeasureForTime(timemap, 2500)).toBe(3)
    expect(getMeasureForTime(timemap, 3500)).toBe(4) // Evaluates tail limit bounds
    expect(getMeasureForTime([], 500)).toBe(0)
  })
})

describe('Wait Mode Mathematics', () => {
  it('evaluateWaitModeMatch strictly calculates discrete Voice configurations', () => {
    const pressed = new Set([60, 64, 67]) // C Major Chord
    const target = new Set([60, 64, 67])
    
    // Strict Mode: Exact matches
    let res = evaluateWaitModeMatch(pressed, target, false)
    expect(res.allMatched).toBe(true)
    expect(res.isAllowedEarly).toBe(true)
    
    // Strict Mode: Missing Root Note
    const missedPressed = new Set([64, 67])
    res = evaluateWaitModeMatch(missedPressed, target, false)
    expect(res.allMatched).toBe(false)
  })

  it('evaluateWaitModeMatch calculates Lenient configurations dynamically', () => {
    const pressed = new Set([60]) // Hit Root Note Only
    const target = new Set([60, 64, 67]) // Needs full C Major Chord
    
    let res = evaluateWaitModeMatch(pressed, target, true) // Lenient = true
    expect(res.allMatched).toBe(true) // Should pass completely because ONE note matched!
    
    const wrongPressed = new Set([61]) // Hit wrong note
    res = evaluateWaitModeMatch(wrongPressed, target, true)
    expect(res.allMatched).toBe(false)
  })

  it('evaluates Repeated Chord Latching preventing accidental sequential execution', () => {
    const pressed = new Set([60])
    const target = new Set([60])
    const previousTarget = new Set([60])
    const releasedPitches = new Set<number>()
    
    // User is STILL holding the note from the previous chord!
    let res = evaluateWaitModeMatch(pressed, target, false, previousTarget, releasedPitches)
    expect(res.allMatched).toBe(true)
    expect(res.isAllowedEarly).toBe(false) // Must unpress the note first!
    
    // User releases the note
    const releasedPressed = new Set<number>()
    res = evaluateWaitModeMatch(releasedPressed, target, false, previousTarget, releasedPitches)
    expect(res.allMatched).toBe(false) // Not matching yet
    expect(res.isAllowedEarly).toBe(true) // They are legally allowed to hit it again!
  })
})
