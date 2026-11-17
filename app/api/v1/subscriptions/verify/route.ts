import { NextResponse } from 'next/server';
import { provisionOrExtendLicense } from '@/lib/provisionOrExtendLicense';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';

export const dynamic='force-dynamic';

export async function GET(request:Request) {
  const headers={'Cache-Control':'no-store, max-age=0'};
  if(!checkRateLimit(getClientIp(request),10,60_000)) return NextResponse.json({success:false,error:'Too many verification attempts.'},{status:429,headers});
  const reference=new URL(request.url).searchParams.get('reference')?.trim() ?? '';
  if(!/^ALY_SUB_[A-F0-9]{24}$/i.test(reference)) return NextResponse.json({success:false,error:'Invalid subscription reference.'},{status:400,headers});
  try {
    const result=await provisionOrExtendLicense(reference);
    return NextResponse.json({success:true,...result},{headers});
  } catch(error) {
    console.error('Subscription return verification failed:',error);
    return NextResponse.json({success:false,error:'Payment verification is pending. Retry using the same reference.'},{status:503,headers});
  }
}
