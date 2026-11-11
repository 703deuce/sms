import { UserTemplateFillStudio } from '@/components/clips/templates/user-template-fill-studio'
export const metadata={title:'Use community template · Clips'}
export default async function Page({params}:{params:Promise<{publicationId:string}>}){
  const {publicationId}=await params
  return <UserTemplateFillStudio id={publicationId} mode="community" />
}
