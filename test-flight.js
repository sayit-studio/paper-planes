const F=require('./src/flight.js');
const base={power:2,angle:5,clips:0,tail:0,asym:0};
const cases=[
 ['dart',{}],['glider',{}],['lock',{}],['stunt',{}],
 ['dart',{power:5}],['glider',{power:1}],['glider',{power:5}],
 ['stunt',{power:5,tail:2}],['stunt',{power:5,tail:3}],
 ['dart',{clips:2}],['glider',{tail:3}],['glider',{tail:2,power:4}],['lock',{asym:2}],['lock',{angle:40,power:4}],['dart',{angle:-15}],
 ['glider',{clips:1}],['lock',{power:4,angle:10}],['lock',{power:5,angle:0}],
];
for(const [id,k] of cases){const r=F.simulate(id,Object.assign({},base,k));
 const maxY=Math.max(...r.pts.map(p=>p.y));
 console.log(id.padEnd(6),JSON.stringify(k).padEnd(28),'dist',r.dist.toFixed(1),'t',r.time.toFixed(2),'maxY',maxY.toFixed(2),'z',r.z.toFixed(1),'maxAl',(r.maxAlpha*57.3).toFixed(0),r.verdict);}
