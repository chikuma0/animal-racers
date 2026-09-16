import {describe,it,expect} from 'vitest';
import {PresentationBuffer} from './presentation';
import {createMatch} from './simulation';
describe('authoritative presentation',()=>{
 it('interpolates positions without changing authoritative health or source state',()=>{const a=createMatch(['lion','wolf']);a.phase='fight';a.tick=60;a.players[0].x=0;const b=structuredClone(a);b.tick=66;b.players[0].x=2;b.players[0].hp=70;const p=new PresentationBuffer();p.push(a,1000);p.push(b,1100);const v=p.sample(1100,50)!;expect(v.players[0].x).toBeCloseTo(1);expect(v.players[0].hp).toBe(70);expect(a.players[0].hp).toBe(100);expect(b.players[0].x).toBe(2);});
 it('cannot produce a speculative phase or trophy even after missing updates',()=>{const a=createMatch(['lion','wolf']);a.phase='fight';a.tick=60;a.players[1].hp=1;const p=new PresentationBuffer();p.push(a,1000);const v=p.sample(100000)!;expect(v.phase).toBe('fight');expect(v.result).toBeNull();expect(v.players[1].hp).toBe(1);expect(v.players[0].x).toBe(a.players[0].x);});
 it('never blends race positions across an arena transition',()=>{const a=createMatch(['lion','wolf']);a.phase='race';a.tick=60;a.players[0].z=490;const b=structuredClone(a);b.phase='fight';b.tick=66;b.players[0].z=0;const p=new PresentationBuffer();p.push(a,1000);p.push(b,1100);expect(p.sample(1100,50)!.players[0].z).toBe(0);});
 it('clears epoch freshness and drops duplicate or stale snapshots',()=>{const p=new PresentationBuffer();const a=createMatch(['lion','wolf']);a.tick=100;p.push(a,100);a.tick=90;p.push(a,110);expect(p.sample(110)!.tick).toBe(100);p.clear();a.tick=0;p.push(a,120);expect(p.sample(120)!.tick).toBe(0);});
 it('does not apply an old idle clock to a newly authoritative attack',()=>{const p=new PresentationBuffer();const a=createMatch(['lion','wolf']);a.phase='fight';a.tick=60;a.players[0].action='fight_idle';a.players[0].actionTime=2;p.push(a,1000);const b=structuredClone(a);b.tick=66;b.players[0].actionTime=2.1;p.push(b,1100);const c=structuredClone(b);c.tick=72;c.players[0].action='attack';c.players[0].actionTime=.05;p.push(c,1200);const view=p.sample(1200,150)!;expect(view.players[0].action).toBe('attack');expect(view.players[0].actionTime).toBe(.05);});
 it('keeps separate repetitions of the same action on their own clock',()=>{const p=new PresentationBuffer();const a=createMatch(['lion','wolf']);a.phase='fight';a.tick=60;a.players[0].action='attack';a.players[0].actionTime=.4;p.push(a,1000);const b=structuredClone(a);b.tick=66;b.players[0].actionTime=.5;p.push(b,1100);const c=structuredClone(b);c.tick=72;c.players[0].actionTime=.05;p.push(c,1200);expect(p.sample(1200,150)!.players[0].actionTime).toBe(.05);});
 it('still smooths a continuously advancing instance of an action',()=>{const p=new PresentationBuffer();const a=createMatch(['lion','wolf']);a.phase='fight';a.tick=60;a.players[0].action='attack';a.players[0].actionTime=.1;p.push(a,1000);const b=structuredClone(a);b.tick=66;b.players[0].actionTime=.2;p.push(b,1100);expect(p.sample(1100,50)!.players[0].actionTime).toBeCloseTo(.15);});
 it('does not rewind a received attack as delayed interpolation enters its interval',()=>{
  const p=new PresentationBuffer(), a=createMatch(['lion','wolf']);
  a.phase='fight';a.tick=4582;a.players[0].action='fight_idle';a.players[0].actionTime=2;
  p.push(a,966.67);
  const onset=structuredClone(a);onset.tick=4584;onset.players[0].action='attack';onset.players[0].actionTime=0;p.push(onset,1000);
  const b=structuredClone(onset);b.tick=4586;b.players[0].actionTime=2/60;p.push(b,1033.33);
  const first=p.sample(1033.33,50)!;expect(first.players[0].actionTime).toBeCloseTo(2/60);
  expect(p.sample(1057.33,50)!.players[0].actionTime).toBeGreaterThanOrEqual(first.players[0].actionTime);
 });
 it('holds rather than stepping backward when a later race snapshot arrives slowly',()=>{
  const p=new PresentationBuffer(), a=createMatch(['lion','wolf']);a.phase='race';a.tick=60;a.players[0].z=10;p.push(a,1000);
  const b=structuredClone(a);b.tick=66;b.players[0].z=11;p.push(b,1100);
  const previous=p.sample(1200,120)!.players[0].z;
  const c=structuredClone(b);c.tick=72;c.players[0].z=12;p.push(c,1250);
  expect(p.sample(1250,120)!.players[0].z).toBeGreaterThanOrEqual(previous);
  expect(p.sample(1450,120)!.players[0].z).toBe(12);
  expect(c.players[0].z).toBe(12);
 });
 it('does not blend back from a phase cut and resets clocks for a real new action and epoch',()=>{
  const p=new PresentationBuffer(), a=createMatch(['lion','wolf']);a.phase='transition';a.tick=60;p.push(a,1000);
  const b=structuredClone(a);b.phase='fight';b.tick=66;b.players[0].x=1;b.players[0].action='attack';b.players[0].actionTime=.4;p.push(b,1100);
  expect(p.sample(1100,150)!.players[0].x).toBe(1);
  const c=structuredClone(b);c.tick=72;c.players[0].x=2;c.players[0].actionTime=.5;p.push(c,1200);
  expect(p.sample(1200,150)!.players[0].x).toBeGreaterThanOrEqual(1);
  p.sample(1500,50);
  const d=structuredClone(c);d.tick=78;d.players[0].actionTime=.05;p.push(d,1501);
  expect(p.sample(1501,50)!.players[0].actionTime).toBe(.05);
  p.clear();const next=createMatch(['lion','wolf']);next.phase='fight';next.tick=2;next.players[0].action='attack';next.players[0].actionTime=.01;p.push(next,1600);
  expect(p.sample(1600,50)!.players[0].actionTime).toBe(.01);
 });
});
