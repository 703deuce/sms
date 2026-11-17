// three.js dictionary page (title S01 / end S05). Camera glides over a 3D page; DOM type by GSAP.
// Parameterized copy (editable-contract POC). Camera, motion path, easing, lights setup, geometry and the
// GSAP type tweens (CFG.type in index.html) are byte-identical to the original. Only literal colours,
// strings, fonts and the portrait source now come from resolved props P (see ms-props.js).
import * as THREE from './lib/three.module.js';
import { MS } from './ms-props.js';
const C=window.CFG;
await S.init({start:C.start,dur:C.dur}); const tl=S.tl;
const P0=await MS.boot();                       // resolved props (defaults <- theme <- overrides), fonts loaded
const cv=document.getElementById('c3'); const r=new THREE.WebGLRenderer({canvas:cv,antialias:true,preserveDrawingBuffer:true}); r.setSize(1920,1080,false); r.setPixelRatio(1);
r.outputColorSpace=THREE.SRGBColorSpace; r.setClearColor(P0.c.background,1);
const sc=new THREE.Scene(); sc.fog=new THREE.Fog(P0.c.background,9,26);
const cam=new THREE.PerspectiveCamera(32,1920/1080,0.1,100);
// page texture (repainted on setProps; same deterministic seed every paint)
const pc=document.createElement('canvas'); pc.width=4096; pc.height=2560; const g=pc.getContext('2d');
const lex="aberration abstruse acumen alliteration amplitude antithesis apocalyptic articulate astronomical audacious bombastic cadence cerebellum cognizant colossal comical complex concept convoluted cosmic delivery dialect diction eloquent enigma erudite escapism esoteric euphony extraterrestrial galactic grandiloquent hostile hyperbole idiom incantation incubation instantaneous intellectual interplanetarian kinetic lexicon loquacious lyrical magical medulla metaphor mystical mythological notion paragraph phonetic poetry polysyllabic profound psychopath rhetoric sesquipedalian sychosymatic syllable symphonic telepathic transparent vernacular vocabulary vocabulous volatile".split(' ');
function paintPage(P){ const B=P.f.body.family, T=P.c.text;
const grd=g.createRadialGradient(2000,1200,200,2000,1200,2600); grd.addColorStop(0,P.c.pageInner); grd.addColorStop(1,P.c.pageOuter); g.fillStyle=grd; g.fillRect(0,0,4096,2560);
let seed=11; const rnd=()=>{seed=(seed*16807)%2147483647; return seed/2147483647;};
g.textBaseline='top';
for(let col=0;col<4;col++){ let y=120; const x0=140+col*980; g.fillStyle=MS.rgba(T,.10); g.fillRect(x0-40,100,2,2360);
  while(y<2400){ const hw=lex[Math.floor(rnd()*lex.length)];
    g.font=`600 46px ${B}`; g.fillStyle=MS.rgba(T,.62); g.fillText(hw,x0,y); const w0=g.measureText(hw+' ').width;
    g.font=`italic 400 40px ${B}`; g.fillStyle=MS.rgba(T,.40); g.fillText(['n.','adj.','v.'][Math.floor(rnd()*3)],x0+w0,y+4);
    g.font=`400 38px ${B}`; g.fillStyle=MS.rgba(T,.34); let line='1. '; let yy=y+56;
    for(let k=0;k<10+rnd()*14;k++){ const w=lex[Math.floor(rnd()*lex.length)]+' '; if(g.measureText(line+w).width>860){ g.fillText(line,x0,yy); yy+=48; line=''; } line+=w; } g.fillText(line,x0,yy); y=yy+70; } }
// the real entry (col 2, highlighted): headword = editable element "headword"
g.font=`600 64px ${B}`; const hwW=Math.max(700,Math.ceil(g.measureText(P.e.headword.text).width)+20); // original 700px bar; grows only if the text needs it
g.fillStyle=MS.rgba(P.e.headword.highlight,.92); g.fillRect(2090,1130,hwW,78); g.fillStyle=P.e.headword.color; g.fillText(P.e.headword.text,2100,1136); }
paintPage(P0);
const tex=new THREE.CanvasTexture(pc); tex.colorSpace=THREE.SRGBColorSpace; tex.anisotropy=8;
const page=new THREE.Mesh(new THREE.PlaneGeometry(16,10),new THREE.MeshStandardMaterial({map:tex,roughness:.9})); page.rotation.x=-Math.PI/2; sc.add(page);
// photo print lying on the page: editable element "portrait" (image asset, cover-cropped to 4:3 around focalPoint)
const loadImg=src=>new Promise((res,rej)=>{const i=new Image(); i.onload=()=>res(i); i.onerror=()=>rej(new Error('image load failed')); i.src=src;});
const im=await loadImg(P0.e.portrait.src);
const ptex=new THREE.Texture(im); ptex.needsUpdate=true; ptex.colorSpace=THREE.SRGBColorSpace; MS.coverCrop(ptex,im,4/3,P0.e.portrait.focalPoint);
const pr=new THREE.Group(); const borderMat=new THREE.MeshStandardMaterial({color:P0.e.portrait.borderColor,roughness:.8}); const border=new THREE.Mesh(new THREE.PlaneGeometry(4.3,3.3),borderMat);
const ph=new THREE.Mesh(new THREE.PlaneGeometry(4.0,3.0),new THREE.MeshStandardMaterial({map:ptex,roughness:.7})); ph.position.z=0.005; pr.add(border); pr.add(ph);
pr.rotation.x=-Math.PI/2; pr.rotation.z=0.06; pr.position.set(5.3,0.02,-0.9); sc.add(pr);
const sh=new THREE.Mesh(new THREE.PlaneGeometry(4.5,3.5),new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:.35})); sh.rotation.x=-Math.PI/2; sh.rotation.z=0.06; sh.position.set(5.45,0.01,-0.75); sc.add(sh);
const hemi=new THREE.HemisphereLight(P0.c.text,P0.c.background,1.1); sc.add(hemi); const key=new THREE.DirectionalLight(0xfff1d8,2.0); key.position.set(-4,6,3); sc.add(key);
const lamp=new THREE.PointLight(P0.c.accent,6,9); lamp.position.set(1.2,1.2,0.2); sc.add(lamp);
// camera path (Catmull-Rom through keys, eased)
const keys=C.cam.map(k=>({p:new THREE.Vector3(...k.p),l:new THREE.Vector3(...k.l)}));
const cp=new THREE.CatmullRomCurve3(keys.map(k=>k.p)), cl=new THREE.CatmullRomCurve3(keys.map(k=>k.l));
const ease=x=>x<.5?4*x*x*x:1-Math.pow(-2*x+2,3)/2;
const camHook=t=>{ const u=ease(Math.min(1,Math.max(0,t/C.dur))); cam.position.copy(cp.getPoint(u)); cam.lookAt(cl.getPoint(u)); lamp.intensity=4+2*Math.sin(t*1.3); r.render(sc,cam); };
S.hooks.push(camHook);
MS.applyDom(P0); C.type(S,tl); C.slots(S,tl,P0);
S.ready();
// live-edit path: same functions as the export path, no reload
let curImgSrc=P0.e.portrait.src;
MS.attach({
  hooks:[camHook],
  async apply(P){
    r.setClearColor(P.c.background,1); sc.fog.color.set(P.c.background);
    paintPage(P); tex.needsUpdate=true;
    if(P.e.portrait.src!==curImgSrc){ const ni=await loadImg(P.e.portrait.src); ptex.image=ni; curImgSrc=P.e.portrait.src; }
    MS.coverCrop(ptex,ptex.image,4/3,P.e.portrait.focalPoint); ptex.needsUpdate=true;
    borderMat.color.set(P.e.portrait.borderColor); hemi.color.set(P.c.text); hemi.groundColor.set(P.c.background); lamp.color.set(P.c.accent);
    MS.applyDom(P); C.type(S,S.tl); C.slots(S,S.tl,P);
  }
});
// QA hook (read-only): camera + lamp state for motion-parity checks
window.__msTrace=()=>({cam:cam.position.toArray().map(v=>+v.toFixed(6)),quat:cam.quaternion.toArray().map(v=>+v.toFixed(6)),lamp:+lamp.intensity.toFixed(6)});
