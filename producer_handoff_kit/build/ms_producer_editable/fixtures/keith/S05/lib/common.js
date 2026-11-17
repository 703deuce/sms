// "The Lexicon" shared runtime: word anchors (raise on missing), cues, GSAP paused timeline, helpers.
const S={};
S.init=async function(o){
  S.start=o.start; S.dur=o.dur;
  S.words=await (await fetch('lib/words.json')).json(); S.cues=await (await fetch('lib/cues.json')).json();
  S.tl=gsap.timeline({paused:true}); gsap.ticker.lagSmoothing(0); gsap.ticker.sleep(); S.hooks=[];
  await Promise.all(['900 80px BSD','700 30px BST','400 40px Spectral','600 40px Spectral','italic 400 40px Spectral'].map(f=>document.fonts.load(f)));
  return S;
};
// absolute timeline time of a word, relative to this page's start
S.W=(line,word,n=1)=>{ const ws=S.words[line]; if(!ws) throw new Error('missing line '+line); let c=0;
  for(const w of ws){ if(w.w.toLowerCase().replace(/[^a-z0-9'.\-]/g,'').startsWith(word.toLowerCase())){ c++; if(c===n) return +(w.t0-S.start).toFixed(3);} }
  throw new Error('missing word '+line+':'+word); };
S.L=(id,end=false)=>{ const l=S.cues.lines[id]; if(!l) throw new Error('missing line '+id); return +((end?l[1]:l[0])-S.start).toFixed(3); };
S.SH=(id,end=false)=>{ const s=S.cues.shots[id]; if(!s) throw new Error('missing shot '+id); return +((end?s[1]:s[0])-S.start).toFixed(3); };
S.el=(html,cls='',style={})=>{ const d=document.createElement('div'); d.className=cls; d.innerHTML=html; Object.assign(d.style,style); (S.root||document.body).appendChild(d); return d; };
S.show=(el,t0,t1,o={})=>{ // fade/rise in at t0, out at t1
  S.tl.fromTo(el,{opacity:0,y:o.y??18},{opacity:1,y:0,duration:o.d??.35,ease:'power3.out'},t0);
  if(t1!=null) S.tl.to(el,{opacity:0,y:o.yo??0,duration:o.do??.25,ease:'power2.in'},t1-(o.do??.25)); };
S.panel=(t0,t1)=>{ const p=S.el('','panel'); S.tl.fromTo(p,{xPercent:-101},{xPercent:0,duration:.42,ease:'expo.out'},t0); if(t1!=null) S.tl.to(p,{xPercent:-101,duration:.3,ease:'power3.in'},t1-.3); return p; };
S.hl=(el,t,d=.32)=>{ S.tl.fromTo(el,{'--k':0},{'--k':1,duration:d,ease:'power2.inOut',onStart:()=>{}},t); S.hooks.push(tt=>{ el.classList.toggle('on',tt>=t+d*0.5); }); };
S.chars=(el,t,o={})=>{ const sp=SplitText.create(el,{type:'chars'}); S.tl.fromTo(sp.chars,{opacity:0,yPercent:70},{opacity:1,yPercent:0,duration:o.d||.38,stagger:o.st||.025,ease:'expo.out'},t); return sp; };
S.stamp=(el,t)=>{ S.tl.fromTo(el,{opacity:0,scale:1.6,rotation:(+el.dataset.r||-6)-4},{opacity:1,scale:1,rotation:+el.dataset.r||-6,duration:.22,ease:'back.out(2.2)'},t); };
// word-by-word subtitle: list [[text,t]], words appear on their time; whole box hides at tEnd
S.sub=(list,tEnd,cls='sub')=>{ const d=S.el('<span class="box"></span>',cls); const b=d.firstChild; const spans=list.map(([w,t])=>{ const s=document.createElement('span'); s.textContent=w+' '; s.style.opacity=0; b.appendChild(s); return [s,t-S.start]; });
  const t0=spans[0][1]; S.tl.fromTo(d,{opacity:0},{opacity:1,duration:.12},t0-0.06); spans.forEach(([s,t])=>S.tl.to(s,{opacity:1,duration:.08},t)); S.tl.to(d,{opacity:0,duration:.2},tEnd-S.start-.2); return {d,b,spans}; };
S.ready=function(){ window.__scene={fps:30,duration:S.dur,seek:async t=>{ if(!S._p){S.tl.seek(S.dur,false);S.tl.seek(0,false);S._p=1;} S.tl.seek(t,false); for(const h of S.hooks) h(t); }}; window.__ready=true; };
window.S=S;
