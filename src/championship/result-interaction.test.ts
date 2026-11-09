import { describe, expect, it } from 'vitest';
import { ResultInteraction } from './result-interaction';
describe('cup ceremony input protection', () => {
 it('ignores carried pointer release, continuous tapping and held keys beyond the ceremony minimum', () => {
  const gate = new ResultInteraction(); gate.down('p1', 0); gate.down('J', 0); gate.enter(100);
  gate.up('p1', 150); expect(gate.finish('p1', 'again', true)).toBe(false);
  for(let time=200;time<6000;time+=100) { gate.down('p1',time); gate.start('p1','again'); gate.up('p1',time+20); expect(gate.finish('p1','again',true)).toBe(false); }
  expect(gate.ready(7000)).toBe(false); gate.up('J',7100); expect(gate.ready(7699)).toBe(false); expect(gate.ready(7700)).toBe(true);
 });
 it('accepts a fresh down and up on the same button after the pause, rejects a bare release or drag off', () => {
  const gate = new ResultInteraction(); gate.enter(0); expect(gate.ready(3999)).toBe(false);
  expect(gate.finish('p1','again',true)).toBe(false);
  gate.down('p1',4001); gate.start('p1','again'); gate.up('p1',4020); expect(gate.finish('p1','again',false)).toBe(false);
  gate.down('p1',4700); gate.start('p1','again'); gate.up('p1',4720); expect(gate.finish('p1','leave',true)).toBe(false);
  gate.down('p1',5400); gate.start('p1','again'); gate.up('p1',5420); expect(gate.finish('p1','again',true)).toBe(true);
  expect(gate.finish('p1','again',true)).toBe(false);
 });
 it('cancels interrupted gestures and restarts protection on a rematch result', () => {
  const gate = new ResultInteraction(); gate.enter(0); gate.down('p1',4100); gate.start('p1','again'); gate.cancel('p1',4150); expect(gate.finish('p1','again',true)).toBe(false);
  gate.leave(); expect(gate.ready(99999)).toBe(false); gate.enter(10000); expect(gate.ready(13000)).toBe(false);
 });
});
it('does not reuse a background press eligibility for a rapid later button press', () => {
 const gate=new ResultInteraction(); gate.enter(0); gate.down('p1',4100); gate.up('p1',4120);
 gate.down('p1',4200); gate.start('p1','again'); gate.up('p1',4220); expect(gate.finish('p1','again',true)).toBe(false);
});

it('distinguishes ceremony time from a held input and keeps an accepted press visibly ready', () => {
 const gate = new ResultInteraction(); gate.enter(0);
 expect(gate.status(1000)).toBe('ceremony'); expect(gate.remainingSeconds(1000)).toBe(3);
 expect(gate.status(4000)).toBe('ready');
 gate.down('p1',4100); gate.start('p1','again');
 expect(gate.status(4300)).toBe('ready'); expect(gate.ready(4300)).toBe(false);
 gate.up('p1',4400); expect(gate.finish('p1','again',true)).toBe(true);
 gate.down('p1',4500); expect(gate.status(4500)).toBe('release');
 gate.up('p1',4600); expect(gate.status(4800)).toBe('pause');
 expect(gate.status(5200)).toBe('ready');
});
