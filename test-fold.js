const E=require('./src/fold-engine.js'), P=require('./src/planes.js');
const a=P.ALPHA*Math.PI/180;
for(const spec of P.list){
  const r=E.build(spec);
  const sign = spec.steps.find(s=>s.open).halfDir==='valley'?1:-1;
  const U=[Math.cos(a),0,sign*Math.sin(a)], f=[0,1,0];
  const s=[f[1]*U[2]-f[2]*U[1], f[2]*U[0]-f[0]*U[2], f[0]*U[1]-f[1]*U[0]];
  let mn=1e9,mx=-1e9,umn=1e9,umx=-1e9,ymn=1e9,ymx=-1e9;
  for(const q of r.final) for(const v of q.cur){const ps=v[0]*s[0]+v[1]*s[1]+v[2]*s[2], pu=v[0]*U[0]+v[2]*U[2]; mn=Math.min(mn,ps);mx=Math.max(mx,ps);umn=Math.min(umn,pu);umx=Math.max(umx,pu);ymn=Math.min(ymn,v[1]);ymx=Math.max(ymx,v[1]);}
  const cg=E.centerOfMass(r.final);
  console.log(spec.id,'polys',r.final.length,'span',mn.toFixed(1),mx.toFixed(1),'up',umn.toFixed(1),umx.toFixed(1),'len',ymn.toFixed(0),ymx.toFixed(0),'CG y',cg[1].toFixed(1),'frames',r.frames.length);
  // 每一步 z 範圍
  console.log('  z per step:', r.frames.map(fr=>{let lo=1e9,hi=-1e9;fr.start.forEach(p=>p.forEach(v=>{lo=Math.min(lo,v[2]);hi=Math.max(hi,v[2])}));return fr.step.key+':'+lo.toFixed(1)+'..'+hi.toFixed(1)+'/'+fr.polys.length}).join(' '));
}
