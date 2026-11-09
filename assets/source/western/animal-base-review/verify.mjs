// Integrity of the recorded access review; never certifies mesh or art quality.
import fs from 'node:fs/promises';import crypto from 'node:crypto';import assert from 'node:assert/strict';
const root=new URL('../../../../',import.meta.url),out=new URL('assets/source/western/animal-base-review/',root),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const read=async n=>JSON.parse(await fs.readFile(new URL(n,out),'utf8')),m=await read('manifest.json'),requests=await read('requests.json');
assert.equal(m.candidateCount,3);assert.equal(m.geometryDownloaded,false);assert.equal(m.sourceInspectionPerformed,false);assert.equal(m.preferredDownload,'https://blendswap.com/blend/27158/download');
for(const[n,h]of Object.entries(m.files))assert.equal(sha(await fs.readFile(new URL(n,out))),h,n);
for(const group of ['canonicalFreeze','completedStudyFreeze'])for(const[n,h]of Object.entries(m[group]))assert.equal(sha(await fs.readFile(new URL(n,root))),h,n);
assert.equal(Object.keys(m.canonicalFreeze).length,12);
for(const name of ['doizy','zee']){
 const d=await read('primary/'+name+'-metadata.json'),b=await read('primary/'+name+'-download-boundary.json');
 assert(d.isDownloadable&&d.faceCount>0&&d.vertexCount>0);assert.equal(d.license.url,'http://creativecommons.org/licenses/by/4.0/');assert.equal(d.animationCount,1);
 assert.equal(requests.find(x=>x.name===name+'-metadata').status,200);assert.equal(requests.find(x=>x.name===name+'-download-boundary').status,401);assert(b.detail.includes('Authentication'));
}
for(const name of ['lazygraph-page','lazygraph-download'])assert.equal(requests.find(x=>x.name===name).status,403);
console.log('ANIMAL_BASE_ACCESS_RECORD_OK — three publisher candidates, metadata/access distinction, evidence hashes and frozen assets; no geometry acceptance.');
