'use client'
import {useMemo,useRef} from 'react'
import type {MsPortableScene} from '@/lib/motion-studio/portable-contract'
import {sceneLayers} from './portable-layer-list'

type Patch=Record<string,Record<string,unknown>>
type Rect={x:number;y:number;w:number;h:number}
const obj=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{}
function coordinate(patch:Patch,saved:Record<string,unknown>,id:string,key:string){
  return Number(patch[id]?.[key]??obj(saved[id])[key]??0)||0
}

/** Pointer controls composited OVER the actual live scene. They never modify
 * executable scene source or require a server render. Position changes are
 * passed to the same inspector/save patch used by manual numeric editing.
 */
export function LiveCanvasLayerOverlay({scene,width,height,selected,onSelect,
  savedElements,patch,onChange}:{
    scene:MsPortableScene;width:number;height:number;
    selected:string;onSelect:(id:string)=>void;
    savedElements:Record<string,unknown>;patch:Patch;
    onChange:(elementId:string,key:string,value:number)=>void
  }){
  const host=useRef<HTMLDivElement>(null)
  const drag=useRef<{id:string;clientX:number;clientY:number;x:number;y:number}|null>(null)
  const boxes=useMemo(()=>{
    const map=new Map(scene.manifest.elements.map(e=>[e.id,e]))
    const bounds=(id:string,depth=0):Rect|null=>{
      if(depth>32)return null
      const el=map.get(id)
      if(!el)return null
      const layout=obj((el as unknown as {layout?:unknown}).layout)
      const b=obj(layout.fitBox)
      if(!['x','y','w','h'].every(k=>Number.isFinite(b[k])))return null
      const parentId=typeof layout.parentId==='string'?layout.parentId:null
      const parent=parentId?bounds(parentId,depth+1):null
      return {x:Number(b.x)+coordinate(patch,savedElements,id,'x')+(parent?.x||0),
        y:Number(b.y)+coordinate(patch,savedElements,id,'y')+(parent?.y||0),
        w:Number(b.w),h:Number(b.h)}
    }
    return sceneLayers(scene).map(layer=>({id:layer.id,rect:bounds(layer.id)}))
      .filter((v):v is {id:string;rect:Rect}=>Boolean(v.rect))
      .sort((a,b)=>b.rect.w*b.rect.h-a.rect.w*a.rect.h)
  },[scene,patch,savedElements])
  return <div ref={host} className="pointer-events-none absolute inset-0 z-[61]"
    aria-label="Editable layer selection">
    {boxes.map(({id,rect})=><button key={id} type="button"
      aria-label={'Select layer '+id} title={'Select '+id}
      className={'pointer-events-auto absolute touch-none rounded-sm border '+
        (id===selected?'border-primary bg-primary/10':'border-transparent hover:border-white/70')}
      style={{left:rect.x/width*100+'%',top:rect.y/height*100+'%',
        width:rect.w/width*100+'%',height:rect.h/height*100+'%',
        minWidth:6,minHeight:6}}
      onClick={()=>onSelect(id)}
      onPointerDown={event=>{
        if(!host.current?.clientWidth)return
        event.preventDefault()
        onSelect(id)
        drag.current={id,clientX:event.clientX,clientY:event.clientY,
          x:coordinate(patch,savedElements,id,'x'),
          y:coordinate(patch,savedElements,id,'y')}
        event.currentTarget.setPointerCapture(event.pointerId)
      }}
      onPointerMove={event=>{
        const current=drag.current
        const el=host.current
        if(!current||current.id!==id||!el?.clientWidth||!el.clientHeight)return
        onChange(id,'x',Math.round((current.x+
          (event.clientX-current.clientX)*width/el.clientWidth)*100)/100)
        onChange(id,'y',Math.round((current.y+
          (event.clientY-current.clientY)*height/el.clientHeight)*100)/100)
      }}
      onPointerUp={()=>{drag.current=null}}
      onPointerCancel={()=>{drag.current=null}}/>)}
  </div>
}
