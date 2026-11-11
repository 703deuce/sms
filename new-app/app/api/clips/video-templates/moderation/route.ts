import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/server/api-error'
import { listModerationQueue, requireTemplateModerator } from '@/lib/server/clips/user-template-community'
export async function GET(req:Request){
 try{await requireTemplateModerator(req);return NextResponse.json({data:{items:await listModerationQueue()}})
 }catch(e){return jsonError(e,403)}
}
