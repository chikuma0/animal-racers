import { describe, expect, it } from 'vitest';
import { ChildControls } from './child-controls';
import { createDuelMatch, neutralInput, stepMatch, FIXED_DT } from './simulation';
const fight = () => { const m=createDuelMatch(['lion','wolf']); while(m.phase !== 'fight') stepMatch(m,[neutralInput(),neutralInput()],FIXED_DT); return m; };
describe('single-button child controls', () => {
 it('a single tap walks into reach, lands a real hit, and stops; holding never repeats', () => {
  const m=fight(), helper=new ChildControls(); helper.update(neutralInput(),m,0,0);
  let pulses=0;
  for(let t=0;t<360;t++) { const raw={...neutralInput(),attack:true}; const output=helper.update(raw,m,0,t*1000/60); if(output.attack||output.special)pulses++; stepMatch(m,[output,neutralInput()],FIXED_DT); }
  expect(pulses).toBe(1); expect(m.players[1].hp).toBe(88); expect(helper.approaching).toBe(false);
 });
 it('manual steering, phase changes and expiry cancel approach', () => {
  for(const reason of ['move','phase','expired','clear']) { const m=fight(), helper=new ChildControls(); helper.update(neutralInput(),m,0,0); helper.update({...neutralInput(),attack:true},m,0,1);
   if(reason==='phase')m.phase='results'; if(reason==='clear')helper.clear();
   const output=helper.update({...neutralInput(),move:reason==='move'?-1:0},m,0,reason==='expired'?3000:100);
   expect(helper.approaching).toBe(false); expect(output.attack).toBe(false); expect(output.special).toBe(false);
  }
 });
 it('uses existing power against guard without modifying damage or scoring rules', () => {
  const m=fight(), helper=new ChildControls(); m.players[0].x=-.875;m.players[1].x=.875;m.players[1].action='guard';
  helper.update(neutralInput(),m,0,0); const output=helper.update({...neutralInput(),attack:true},m,0,1);
  expect(output.special).toBe(true); expect(output.attack).toBe(false);
 });
 it('preserves race controls and requires release before attacking after a phase change', () => {
  const m=fight(), helper=new ChildControls(); m.phase='race'; const raw={...neutralInput(),move:1,jump:true,attack:true}; expect(helper.update(raw,m,0,0)).toEqual(raw);
  m.phase='fight'; expect(helper.update({...neutralInput(),attack:true},m,0,1).attack).toBe(false); expect(helper.approaching).toBe(false);
 });
});

it('allows a deliberate punch while steering, without resuming automatic approach', () => {
 for(const close of [true,false]) {
  const m=fight(), helper=new ChildControls(); if(close){m.players[0].x=-.875;m.players[1].x=.875;}
  helper.update(neutralInput(),m,0,0);
  const output=helper.update({...neutralInput(),move:1,attack:true},m,0,1);
  expect(output.attack).toBe(true);expect(output.move).toBe(1);expect(helper.approaching).toBe(false);
  stepMatch(m,[output,neutralInput()],FIXED_DT);
  for(let t=0;t<100;t++)stepMatch(m,[neutralInput(),neutralInput()],FIXED_DT);
  expect(m.players[1].hp).toBe(close?88:100);
  expect(helper.update(neutralInput(),m,0,2000).move).toBe(0);
 }
});

it('preserves cancellation through input packets and drops a queued approach', () => {
 const m=fight(), helper=new ChildControls();helper.update(neutralInput(),m,0,0);helper.update({...neutralInput(),attack:true},m,0,1);
 const out=helper.update({...neutralInput(),cancelAttack:true},m,0,2);expect(out.cancelAttack).toBe(true);expect(helper.approaching).toBe(false);
});
