// three.js dictionary page (title S01 / end S05). Camera glides over a 3D page; DOM type by GSAP.
import * as THREE from './lib/three.module.js';
const C=window.CFG;
await S.init({start:C.start,dur:C.dur}); const tl=S.tl;
const cv=document.getElementById('c3'); const r=new THREE.WebGLRenderer({canvas:cv,antialias:true,preserveDrawingBuffer:true}); r.setSize(1920,1080,false); r.setPixelRatio(1);
r.outputColorSpace=THREE.SRGBColorSpace; r.setClearColor(0x07170F,1);
const sc=new THREE.Scene(); sc.fog=new THREE.Fog(0x07170F,9,26);
const cam=new THREE.PerspectiveCamera(32,1920/1080,0.1,100);
// page texture
const pc=document.createElement('canvas'); pc.width=4096; pc.height=2560; const g=pc.getContext('2d');
const grd=g.createRadialGradient(2000,1200,200,2000,1200,2600); grd.addColorStop(0,'#143A2D'); grd.addColorStop(1,'#0B2219'); g.fillStyle=grd; g.fillRect(0,0,4096,2560);
const lex="aberration abstruse acumen alliteration amplitude antithesis apocalyptic articulate astronomical audacious bombastic cadence cerebellum cognizant colossal comical complex concept convoluted cosmic delivery dialect diction eloquent enigma erudite escapism esoteric euphony extraterrestrial galactic grandiloquent hostile hyperbole idiom incantation incubation instantaneous intellectual interplanetarian kinetic lexicon loquacious lyrical magical medulla metaphor mystical mythological notion paragraph phonetic poetry polysyllabic profound psychopath rhetoric sesquipedalian sychosymatic syllable symphonic telepathic transparent vernacular vocabulary vocabulous volatile".split(' ');
let seed=11; const rnd=()=>{seed=(seed*16807)%2147483647; return seed/2147483647;};
g.textBaseline='top';
for(let col=0;col<4;col++){ let y=120; const x0=140+col*980; g.fillStyle='rgba(239,231,214,.10)'; g.fillRect(x0-40,100,2,2360);
  while(y<2400){ const hw=lex[Math.floor(rnd()*lex.length)];
    g.font='600 46px Spectral'; g.fillStyle='rgba(239,231,214,.62)'; g.fillText(hw,x0,y); const w0=g.measureText(hw+' ').width;
    g.font='italic 400 40px Spectral'; g.fillStyle='rgba(239,231,214,.40)'; g.fillText(['n.','adj.','v.'][Math.floor(rnd()*3)],x0+w0,y+4);
    g.font='400 38px Spectral'; g.fillStyle='rgba(239,231,214,.34)'; let line='1. '; let yy=y+56;
    for(let k=0;k<10+rnd()*14;k++){ const w=lex[Math.floor(rnd()*lex.length)]+' '; if(g.measureText(line+w).width>860){ g.fillText(line,x0,yy); yy+=48; line=''; } line+=w; } g.fillText(line,x0,yy); y=yy+70; } }
// the real entry: Murray, Keith  (col 2, highlighted)
g.fillStyle='rgba(212,240,60,.92)'; g.fillRect(2090,1130,700,78); g.font='600 64px Spectral'; g.fillStyle='#07170F'; g.fillText('Mur·ray, Keith',2100,1136);
const tex=new THREE.CanvasTexture(pc); tex.colorSpace=THREE.SRGBColorSpace; tex.anisotropy=8;
const page=new THREE.Mesh(new THREE.PlaneGeometry(16,10),new THREE.MeshStandardMaterial({map:tex,roughness:.9})); page.rotation.x=-Math.PI/2; sc.add(page);
// photo print (real B&W portrait) lying on the page
const im=await new Promise(res=>{const i=new Image(); i.onload=()=>res(i); i.src='km_bw.jpg';});
const ptex=new THREE.Texture(im); ptex.needsUpdate=true; ptex.colorSpace=THREE.SRGBColorSpace;
const pr=new THREE.Group(); const border=new THREE.Mesh(new THREE.PlaneGeometry(4.3,3.3),new THREE.MeshStandardMaterial({color:0xEFE7D6,roughness:.8}));
const ph=new THREE.Mesh(new THREE.PlaneGeometry(4.0,3.0),new THREE.MeshStandardMaterial({map:ptex,roughness:.7})); ph.position.z=0.005; pr.add(border); pr.add(ph);
pr.rotation.x=-Math.PI/2; pr.rotation.z=0.06; pr.position.set(5.3,0.02,-0.9); sc.add(pr);
const sh=new THREE.Mesh(new THREE.PlaneGeometry(4.5,3.5),new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:.35})); sh.rotation.x=-Math.PI/2; sh.rotation.z=0.06; sh.position.set(5.45,0.01,-0.75); sc.add(sh);
sc.add(new THREE.HemisphereLight(0xEFE7D6,0x07170F,1.1)); const key=new THREE.DirectionalLight(0xfff1d8,2.0); key.position.set(-4,6,3); sc.add(key);
const lamp=new THREE.PointLight(0xD4F03C,6,9); lamp.position.set(1.2,1.2,0.2); sc.add(lamp);
// camera path (Catmull-Rom through keys, eased)
const keys=C.cam.map(k=>({p:new THREE.Vector3(...k.p),l:new THREE.Vector3(...k.l)}));
const cp=new THREE.CatmullRomCurve3(keys.map(k=>k.p)), cl=new THREE.CatmullRomCurve3(keys.map(k=>k.l));
const ease=x=>x<.5?4*x*x*x:1-Math.pow(-2*x+2,3)/2;
S.hooks.push(t=>{ const u=ease(Math.min(1,Math.max(0,t/C.dur))); cam.position.copy(cp.getPoint(u)); cam.lookAt(cl.getPoint(u)); lamp.intensity=4+2*Math.sin(t*1.3); r.render(sc,cam); });
C.type(S,tl);
S.ready();
