import { describe, it, expect } from 'vitest';
import { createMatch, createDuelMatch, neutralInput, stepMatch, scoreMatch } from './simulation';
import { hudSnapshot, UiUpdates } from './ui-updates';
describe('UI work scheduling', () => {
 it('does no report work while hidden, refreshes on opening and at most once per second', () => {
  const updates=new UiUpdates();
  for(let t=0;t<10000;t+=16) expect(updates.reportDue(t,false)).toBe(false);
  expect(updates.reportDue(10000,true)).toBe(true);
  expect(updates.reportDue(10999,true)).toBe(false); expect(updates.reportDue(11000,true)).toBe(true);
  expect(updates.reportDue(11001,false)).toBe(false); expect(updates.reportDue(11002,true)).toBe(true);
 });
 it('retains 50ms active HUD cadence but immediately publishes phase/new-match changes and skips unchanged results', () => {
  const u=new UiUpdates(),m=createMatch(['lion','wolf']);
  expect(u.hudDue(0,m)).toBe(true);m.tick++;
  expect(u.hudDue(50,m)).toBe(false);expect(u.hudDue(51,m)).toBe(true);
  m.phase='results';expect(u.hudDue(52,m)).toBe(true);
  for(let t=53;t<10000;t+=17) expect(u.hudDue(t,m)).toBe(false);
  expect(u.hudDue(10001,structuredClone(m))).toBe(true);
 });
 it('keeps race/fight/result UI independent of authority mutations and preserves scoring/contact values', () => {
  for(const m of [createMatch(['lion','wolf']),createDuelMatch(['lion','wolf'])]) {
   for(let i=0;i<250;i++) stepMatch(m,[neutralInput(),neutralInput()],1/60);
   m.events.push({id:999,type:'hit',slot:1,x:0,z:0});
   m.result=scoreMatch(m);
   const v=hudSnapshot(m),saved=structuredClone(v);
   expect(v.players[0].hp).toBe(m.players[0].hp);
   if(m.phase==='fight') expect(v.latestContact).toEqual({type:'hit',slot:1});
   expect(v.result).toEqual(m.result);
   m.players[0].hp=0;m.result.total[0]=999;m.events[0].type='changed';
   expect(v).toEqual(saved);
   expect('ai' in v.players[0]).toBe(false);expect('events' in v).toBe(false);
  }
 });
});
