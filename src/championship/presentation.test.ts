import {describe,it,expect} from 'vitest';
import {PresentationBuffer} from './presentation';
import {createMatch} from './simulation';
describe('authoritative presentation',()=>{
 it('interpolates positions without changing authoritative health or source state',()=>{const a=createMatch(['lion','wolf']);a.phase='fight';a.tick=60;a.players[0].x=0;const b=structuredClone(a);b.tick=66;b.players[0].x=2;b.players[0].hp=70;const p=new PresentationBuffer();p.push(a,1000);p.push(b,1100);const v=p.sample(1100,50)!;expect(v.players[0].x).toBeCloseTo(1);expect(v.players[0].hp).toBe(70);expect(a.players[0].hp).toBe(100);expect(b.players[0].x).toBe(2);});
 it('cannot produce a speculative phase or trophy even after missing updates',()=>{const a=createMatch(['lion','wolf']);a.phase='fight';a.tick=60;a.players[1].hp=1;const p=new PresentationBuffer();p.push(a,1000);const v=p.sample(100000)!;expect(v.phase).toBe('fight');expect(v.result).toBeNull();expect(v.players[1].hp).toBe(1);expect(v.players[0].x).toBe(a.players[0].x);});
 it('never blends race positions across an arena transition',()=>{const a=createMatch(['lion','wolf']);a.phase='race';a.tick=60;a.players[0].z=490;const b=structuredClone(a);b.phase='fight';b.tick=66;b.players[0].z=0;const p=new PresentationBuffer();p.push(a,1000);p.push(b,1100);expect(p.sample(1100,50)!.players[0].z).toBe(0);});
 it('clears epoch freshness and drops duplicate or stale snapshots',()=>{const p=new PresentationBuffer();const a=createMatch(['lion','wolf']);a.tick=100;p.push(a,100);a.tick=90;p.push(a,110);expect(p.sample(110)!.tick).toBe(100);p.clear();a.tick=0;p.push(a,120);expect(p.sample(120)!.tick).toBe(0);});
});
