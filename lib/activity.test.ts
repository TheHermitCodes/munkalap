import { describe, expect, it } from 'vitest'
import { describeEvent } from './activity'

const names = new Map([
  ['anna', 'Anna Kovács'],
  ['bence', 'Bence Tóth'],
])

describe('describeEvent', () => {
  it('describes status changes with human labels', () => {
    expect(
      describeEvent({ type: 'status_changed', actor_id: 'bence', payload: { from: 'open', to: 'in_progress' } }, names),
    ).toBe('Bence Tóth changed the status from Open to In progress')
  })

  it('distinguishes taking, assigning and unassigning', () => {
    expect(describeEvent({ type: 'assigned', actor_id: 'bence', payload: { from: null, to: 'bence' } }, names)).toBe(
      'Bence Tóth took this work order',
    )
    expect(describeEvent({ type: 'assigned', actor_id: 'anna', payload: { from: null, to: 'bence' } }, names)).toBe(
      'Anna Kovács assigned it to Bence Tóth',
    )
    expect(describeEvent({ type: 'assigned', actor_id: 'anna', payload: { from: 'bence', to: null } }, names)).toBe(
      'Anna Kovács unassigned Bence Tóth',
    )
  })

  it('handles people who have left and system events', () => {
    expect(describeEvent({ type: 'created', actor_id: 'gone', payload: {} }, names)).toBe(
      'A former member created this work order',
    )
    expect(describeEvent({ type: 'created', actor_id: null, payload: {} }, names)).toBe('Someone created this work order')
  })

  it('survives unexpected payloads', () => {
    expect(describeEvent({ type: 'status_changed', actor_id: 'anna', payload: ['nope'] }, names)).toBe(
      'Anna Kovács changed the status from an unknown status to an unknown status',
    )
  })
})
