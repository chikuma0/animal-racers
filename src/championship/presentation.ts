import type {Match} from './simulation';
/** Read-only presentation: never advances combat, phase, health, scores or inputs. */
export class PresentationBuffer {
 private frames:{state:Match,arrival:number}[]=[];
 push(state:Match,arrival:number){const last=this.frames.at(-1);if(last&&state.tick<=last.state.tick)return;this.frames.push({state:structuredClone(state),arrival});if(this.frames.length>8)this.frames.shift();}
 clear(){this.frames=[];}
 sample(now:number,delayMs=65):Match|null{
  const latest=this.frames.at(-1);if(!latest)return null;
  const targetTick=latest.state.tick+Math.min(100,Math.max(0,now-latest.arrival-delayMs))*.06-Math.max(0,delayMs-(now-latest.arrival))*.06;
  let first=this.frames[0],second=latest;
  for(let i=1;i<this.frames.length;i++){if(this.frames[i].state.tick>=targetTick){first=this.frames[i-1];second=this.frames[i];break;}first=this.frames[i];}
  const result=structuredClone(latest.state);
  // Phase and result always come from received authority. Never interpolate a race into an arena.
  if(first.state.phase!==latest.state.phase||second.state.phase!==latest.state.phase||result.phase==='results')return result;
  const span=second.state.tick-first.state.tick;
  const t=span>0?Math.min(1,Math.max(0,(targetTick-first.state.tick)/span)):1;
  for(const slot of [0,1] as const){const a=first.state.players[slot],b=second.state.players[slot],p=result.players[slot];for(const key of ['x','y','z','speed'] as const)p[key]=a[key]+(b[key]-a[key])*t;
   if(a.action===b.action&&a.actionTime<=b.actionTime){p.actionTime=a.actionTime+(b.actionTime-a.actionTime)*t;}else p.actionTime=b.actionTime;
   // Smooth in-place action progression only; never extrapolate collision/HP/phase state.
   if(first===second&&p.action===latest.state.players[slot].action)p.actionTime+=Math.min(.10,Math.max(0,(now-latest.arrival-delayMs)/1000));
  }
  return result;
 }
}
