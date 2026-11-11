#!/usr/bin/env node
import { existsSync,mkdirSync,readFileSync,writeFileSync } from 'node:fs'
import { dirname,resolve } from 'node:path'
import { generateB8Candidates,type B8Evidence } from '../lib/clips/real-video-templates/b8-factory'
import { b8ReferenceForFamily } from '../lib/clips/real-video-templates/b8-reference-catalog'

const args=process.argv.slice(2)
const value=(name:string,fallback:string)=>{
  const i=args.indexOf(name)
  return i>=0&&args[i+1]?args[i+1]!:fallback
}
const evidencePath=resolve(process.cwd(),value('--evidence','build/real-video-templates/b8/evidence.json'))
const out=resolve(process.cwd(),value('--out','build/real-video-templates/b8/review-workbook.html'))
if(!existsSync(evidencePath))throw new Error('Missing machine evidence: '+evidencePath)
const evidence=JSON.parse(readFileSync(evidencePath,'utf8')) as B8Evidence[]
const byId=new Map(evidence.map(row=>[row.id,row]))
const rows=generateB8Candidates().flatMap(candidate=>{
  const e=byId.get(candidate.id)
  if(!e?.outputs?.renderMp4||e.checks?.actualWorkerRender!==true)return []
  const ref=b8ReferenceForFamily(candidate.familyId)
  return [{
    id:candidate.id,familyId:candidate.familyId,treatmentId:candidate.treatmentId,
    title:candidate.family.title,reference:ref,
    render:e.outputs.renderMp4,poster:e.outputs.poster,
    renderSha256:e.outputs.renderSha256,
    reviewer:e.reviewer??'',reviewDate:e.reviewDate??'',scores:e.scores,
    independentReviewer:e.independentReviewer??'',flagged:Boolean(e.flagged),
    checks:e.checks,
  }]
})
const payload=JSON.stringify(rows).replace(/</g,'\\u003c')
const html=`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Template certification review</title>
<style>
body{font:14px system-ui,sans-serif;margin:0;background:#111;color:#eee}header{position:sticky;top:0;background:#181818;padding:12px;z-index:4;border-bottom:1px solid #333}
main{display:grid;grid-template-columns:repeat(auto-fill,minmax(560px,1fr));gap:16px;padding:16px}.card{border:1px solid #333;border-radius:12px;padding:14px;background:#181818}
.media{display:grid;grid-template-columns:220px 1fr;gap:14px}video{width:220px;max-height:390px;background:#000}a{color:#9cc7ff}.scores{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:10px}
label{display:grid;gap:4px}input{background:#222;color:#fff;border:1px solid #555;border-radius:6px;padding:7px}.checks{display:grid;grid-template-columns:repeat(2,1fr);gap:6px;margin-top:10px}.checks label{display:flex;align-items:center;gap:6px}
.bad{color:#ff9b9b}.ok{color:#9cffb6}button{padding:9px 14px;border:0;border-radius:8px;cursor:pointer}small{color:#aaa}
</style></head><body><header><strong>Template certification review</strong> — <span id="count"></span>
<button id="export">Export human-reviews.json</button> <span id="status"></span></header><main id="cards"></main>
<script id="data" type="application/json">${payload}</script><script>
const rows=JSON.parse(document.getElementById('data').textContent);const cards=document.getElementById('cards');document.getElementById('count').textContent=rows.length+' rendered designs';
const dims=['pacing','beatSemantic','transition','typography','motion','color'];
const esc=s=>String(s??'');
for(const row of rows){const card=document.createElement('section');card.className='card';card.dataset.id=row.id;
 const h=document.createElement('h2');h.textContent=row.id+' — '+row.title+' · '+row.treatmentId;card.append(h);
 const media=document.createElement('div');media.className='media';const v=document.createElement('video');v.src=row.render;v.controls=true;v.preload='metadata';v.poster=row.poster;
 const info=document.createElement('div');const link=document.createElement('a');link.href=row.reference.url;link.target='_blank';link.rel='noopener noreferrer';link.textContent=row.reference.provider+' reference: '+row.reference.title;
 const hash=document.createElement('p');hash.innerHTML='<small>Render SHA-256: '+esc(row.renderSha256)+'</small>';info.append(link,hash);media.append(v,info);card.append(media);
 const scores=document.createElement('div');scores.className='scores';for(const dim of dims){const l=document.createElement('label');l.textContent=dim;const inp=document.createElement('input');inp.type='number';inp.min='1';inp.max='5';inp.step='1';inp.dataset.score=dim;const old=Number(row.scores?.[dim]??0);if(old>=1)inp.value=String(old);l.append(inp);scores.append(l)}card.append(scores);
 const people=document.createElement('div');people.className='scores';for(const [key,title,val] of [['reviewer','Reviewer',row.reviewer],['reviewDate','Review date',row.reviewDate],['independentReviewer','Independent reviewer',row.independentReviewer]]){const l=document.createElement('label');l.textContent=title;const inp=document.createElement('input');inp.dataset.field=key;if(key==='reviewDate')inp.type='date';inp.value=val||'';l.append(inp);people.append(l)}card.append(people);
 const checks=document.createElement('div');checks.className='checks';for(const [key,title] of [['glyphsPresent','Glyphs present'],['contrastReadable','Contrast readable'],['safeZones','Safe zones'],['rightsCleared','Rights cleared'],['flagged','Flagged']]){const l=document.createElement('label');const inp=document.createElement('input');inp.type='checkbox';inp.dataset.check=key;inp.checked=key==='flagged'?row.flagged:Boolean(row.checks?.[key]);l.append(inp,document.createTextNode(title));checks.append(l)}card.append(checks);cards.append(card)}
document.getElementById('export').onclick=()=>{const reviews=[];let invalid=0;for(const card of document.querySelectorAll('.card')){const row=rows.find(x=>x.id===card.dataset.id);const get=f=>card.querySelector('[data-field="'+f+'"]').value.trim();const scores={};for(const dim of dims)scores[dim]=Number(card.querySelector('[data-score="'+dim+'"]').value);const chk=k=>card.querySelector('[data-check="'+k+'"]').checked;
 const review={id:row.id,reviewer:get('reviewer'),reviewDate:get('reviewDate'),referenceUrl:row.reference.url,referenceAccessDate:row.reference.accessDate,scores,checks:{glyphsPresent:chk('glyphsPresent'),contrastReadable:chk('contrastReadable'),safeZones:chk('safeZones'),rightsCleared:chk('rightsCleared')},independentReviewer:get('independentReviewer')||undefined,flagged:chk('flagged')};
 if(!review.reviewer||!review.reviewDate||dims.some(d=>scores[d]<1||scores[d]>5)||Object.values(review.checks).some(v=>!v))invalid++;reviews.push(review)}
 const blob=new Blob([JSON.stringify({v:1,reviews},null,2)+'\\n'],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='human-reviews.json';a.click();URL.revokeObjectURL(a.href);document.getElementById('status').textContent=invalid?invalid+' rows incomplete; importer will reject them':'review file exported';};
</script></body></html>`
mkdirSync(dirname(out),{recursive:true});writeFileSync(out,html,'utf8')
console.log('Wrote review workbook for '+rows.length+' actual worker renders: '+out)
