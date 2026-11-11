import { UserTemplateFillStudio } from '@/components/clips/templates/user-template-fill-studio'
export const metadata={title:'Use private template · Clips'}
export default async function Page({params}:{params:Promise<{templateId:string}>}){
  const {templateId}=await params
  return <UserTemplateFillStudio id={templateId} mode="private" />
}
