// Inspect actual renderer storefront geometry without creating a WebGL context.
// The authored source is compiled locally; no alternate geometry is reimplemented.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import ts from 'typescript';
import * as THREE from 'three';
const file = 'src/championship/renderer.ts';
const source = readFileSync(file, 'utf8');
const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const functions = ast.statements.filter(n => ts.isFunctionDeclaration(n) && ['mat','mesh','box','timberBox'].includes(n.name?.text));
const klass = ast.statements.find(n => ts.isClassDeclaration(n) && n.members.some(m => m.name?.getText(ast) === 'buildBuilding'));
const method = klass?.members.find(m => m.name?.getText(ast) === 'buildBuilding');
if(functions.length !== 4 || !method) throw new Error('Renderer geometry extraction no longer matches source.');
const local = `const materials = new Map();
${functions.map(n=>n.getText(ast)).join('\n')}
function sign(text,width,height){return mesh(new THREE.PlaneGeometry(width,height),new THREE.MeshStandardMaterial());}
return new (class {
 timberMap = new THREE.Texture(); timberMaterials = new Set(); buildingTimbers = new Map();
 ${method.getText(ast)}
})();`;
const transpiled = ts.transpile(local, {target:ts.ScriptTarget.ES2022});
const builder = new Function('THREE',transpiled)(THREE);
const curve = z => Math.sin(z*.01)*9 + Math.sin(z*.022)*2;
const placements = [15,48,82,350,384,700,735,980].map(z=>z/2);
let minimum = Infinity, nearest;
const variants=[];
for(const [label,saloon] of [['DUST & GLORY',true],['CANYON SUPPLY',false],['COLD CREEK',false],['SILVER SPUR',false]]) {
 const group=builder.buildBuilding(label,saloon), bounds=new THREE.Box3().setFromObject(group);
 let triangles=0; group.traverse(o=>{if(o.isMesh)triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;});
 variants.push({label,triangles,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()}});
}
for(const z of placements) for(const side of [-1,1]) {
 const label=z%3===0?'CANYON SUPPLY':z%2===0?'COLD CREEK':'SILVER SPUR';
 const group=builder.buildBuilding(label,z===7.5);
 group.position.set(curve(z)+side*13,0,z);group.rotation.y=side>0?-Math.PI/2:Math.PI/2;group.updateMatrixWorld(true);
 group.traverse(o=>{if(!o.isMesh)return; const p=o.geometry.attributes.position;
  for(let i=0;i<p.count;i++) { const v=new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld);
   const clearance=Math.abs(v.x-curve(v.z))-5.5;
   if(clearance<minimum){minimum=clearance;nearest={buildingZ:z,side,vertex:v.toArray()};}
  }
 });
}
// Geometry is piecewise linear. Between vertices, the track curve's maximum
// second derivative is0.001868. A building spans at most9.25m longitudinally;
// subtract its interpolation error bound rather than trusting vertex tests alone.
const betweenVertexBound = .001868*9.25**2/8;
const conservativeClearance=minimum-betweenVertexBound;
if(conservativeClearance<=0) throw new Error(`Storefront enters5.5m road envelope: ${conservativeClearance}`);
const report={rendererSha256:createHash('sha256').update(source).digest('hex'),method:'Actual buildBuilding method and mesh helpers extracted with TypeScript AST; sign substitutes identical PlaneGeometry dimensions and omits only canvas text. Placements/curve checked against current500m buildRace constants. Full vertex transforms plus conservative continuous-curve deviation bound.',variants,placements:placements.length*2,roadHalfWidth:5.5,minimumVertexClearance:minimum,betweenVertexBound,conservativeClearance,nearest,limits:['Decorative scenery geometry only; not a simulation collision test','No GPU or physical-device performance measurement','Static placement formula must be reviewed if buildRace changes']};
const out=process.argv[2];if(out)writeFileSync(out,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify(report,null,2));
console.log('STOREFRONT_GEOMETRY_CLEAR');
