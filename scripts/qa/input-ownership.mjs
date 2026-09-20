// Pure callback regression, not physical-device input automation.
import ts from 'typescript';
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
const path='src/components/Championship.tsx';
const current=await readFile(path,'utf8');
const baselineCommit=execFileSync('git',['rev-parse','62ae5e3'],{encoding:'utf8'}).trim();
const baseline=execFileSync('git',['show',`${baselineCommit}:${path}`],{encoding:'utf8'});
const sha=value=>createHash('sha256').update(value).digest('hex');
const bundled=await build({stdin:{contents:"export * from './src/championship/controls.ts'; export * from './src/championship/input-buffer.ts';",resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'cjs'});
const module={exports:{}};
new Function('module','exports','require',bundled.outputFiles[0].text)(module,module.exports,createRequire(import.meta.url));
const {InputControls,InputSender}=module.exports;
function harness(source){
 const tree=ts.createSourceFile(path,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),extracted={};
 function expression(name,optional=false){
  const found=[];const walk=n=>{if(ts.isVariableDeclaration(n)&&n.name.getText(tree)===name)found.push(n.initializer);ts.forEachChild(n,walk)};walk(tree);
  if(optional&&!found.length)return null;assert.equal(found.length,1,name);
  const node=name==='publishControls'?found[0].arguments[0]:found[0];
  extracted[name]=node.getText(tree);
  const code=ts.transpileModule('('+extracted[name]+')',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText.trim().replace(/;$/,'');
  return new Function('scope',`with(scope){return ${code};}`)(scope);
 }
 const scope={input:{current:{move:0,jump:false,attack:false,special:false,guard:false}},inputSender:{current:new InputSender()},match:{current:{tick:0}},controls:{current:new InputControls()},modeRef:{current:"solo"},keys:new Set()};
 scope.publishControls=expression('publishControls',true);
 scope.update=expression('update',true);
 const press=expression('press'),keydown=expression('keydown'),keyup=expression('keyup'),clear=expression('clear'),releasePointer=expression('releasePointer',true);
 return{scope,press,keydown,keyup,clear,releasePointer,extracted};
}
const pointer=id=>({pointerId:id,preventDefault(){},currentTarget:{setPointerCapture(){}}});
const key=(key,editable=false)=>({key,isComposing:false,preventDefault(){},target:{matches:()=>editable}});
function run(source){
 const rebound=harness(source);rebound.press('jump',true).onPointerDown(pointer(1));rebound.press('attack',true).onPointerUp(pointer(1));
 const opposite=harness(source);opposite.press('move',-1).onPointerDown(pointer(1));opposite.press('move',1).onPointerDown(pointer(2));const both=opposite.scope.input.current.move;opposite.press('move',-1).onPointerUp(pointer(1));
 const multiple=harness(source);multiple.press('guard',true).onPointerDown(pointer(1));multiple.press('guard',true).onPointerDown(pointer(2));multiple.press('guard',true).onPointerUp(pointer(1));
 const mixed=harness(source);mixed.press('guard',true).onPointerDown(pointer(9));mixed.keydown(key('j'));mixed.keyup(key('j'));
 const cancellation=harness(source);cancellation.press('jump',true).onPointerDown(pointer(2));cancellation.press('attack',true).onLostPointerCapture(pointer(2));
 const value={rebound:{...rebound.scope.input.current},bothDirections:both,remainingDirection:opposite.scope.input.current.move,remainingGuard:multiple.scope.input.current.guard,mixedGuard:mixed.scope.input.current.guard,cancelledJump:cancellation.scope.input.current.jump};
 if(source===current){
  assert.equal(value.rebound.jump,false);assert.equal(value.rebound.attack,false);assert.equal(value.bothDirections,0);assert.equal(value.remainingDirection,1);assert(value.remainingGuard&&value.mixedGuard);assert.equal(value.cancelledJump,false);
  mixed.clear();assert.deepEqual(mixed.scope.input.current,{move:0,jump:false,attack:false,special:false,guard:false});
  const detached=harness(source);detached.press('special',true).onPointerDown(pointer(5));detached.releasePointer(pointer(5));assert.equal(detached.scope.input.current.special,false);
  detached.keydown(key('W'));assert.equal(detached.scope.input.current.jump,true);detached.keyup(key('w'));assert.equal(detached.scope.input.current.jump,false);
  detached.keydown(key('J',true));assert.equal(detached.scope.input.current.attack,false);
 }
 return{sourceSha256:sha(source),observed:value,actualCallbacks:rebound.extracted};
}
const old=run(baseline);assert.equal(old.observed.rebound.jump,true);assert.equal(old.observed.remainingDirection,0);assert.equal(old.observed.remainingGuard,false);assert.equal(old.observed.mixedGuard,false);assert.equal(old.observed.cancelledJump,true);
const repaired=run(current);
const evidence={classification:'Actual AST-extracted app callbacks with fake DOM events and real InputControls/InputSender; not browser dispatch or physical multitouch acceptance.',baselineCommit,baseline:old,current:repaired,sources:{[path]:sha(current),'src/championship/controls.ts':sha(await readFile('src/championship/controls.ts'))},harnessSha256:sha(await readFile(new URL(import.meta.url)))};
await writeFile(process.argv[2] ?? 'docs/production/evidence/input-ownership-current.json',JSON.stringify(evidence,null,2)+'\n',{flag:'wx'});
console.log('INPUT_OWNERSHIP_VERIFIED');
