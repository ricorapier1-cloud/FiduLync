import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/serverSupabase';

export const dynamic='force-dynamic';

async function ownerAuthorized(request:Request) {
  const header=request.headers.get('authorization')||'';
  const token=header.startsWith('Bearer ')?header.slice(7).trim():'';
  if(!token) return false;
  const {data,error}=await getSupabaseAdmin().auth.getUser(token);
  return !error && data.user?.email?.toLowerCase()==='ricorapier1@gmail.com';
}

export async function POST(request:Request) {
  if(!await ownerAuthorized(request)) return NextResponse.json({error:'Owner authorization required.'},{status:403});
  try {
    const form=await request.formData();
    const slug=String(form.get('slug')||'').trim().toLowerCase();
    const version=String(form.get('version')||'').trim();
    const file=form.get('file');
    if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)||!/^\d+(?:\.\d+){0,3}(?:[-+][a-zA-Z0-9.-]+)?$/.test(version)||!(file instanceof File)) {
      return NextResponse.json({error:'Valid product slug, artifact version and .ex5 file are required.'},{status:400});
    }
    if(!file.name.toLowerCase().endsWith('.ex5')||file.size<=0||file.size>50*1024*1024) {
      return NextResponse.json({error:'Only non-empty .ex5 files up to 50 MB are accepted.'},{status:400});
    }
    const admin=getSupabaseAdmin();
    const product=await admin.from('ea_products').select('slug').eq('slug',slug).maybeSingle();
    if(!product.data) return NextResponse.json({error:'EA product not found.'},{status:404});
    const bytes=Buffer.from(await file.arrayBuffer());
    const sha256=createHash('sha256').update(bytes).digest('hex');
    const path=`${slug}/${version}-${sha256.slice(0,12)}.ex5`;
    const uploaded=await admin.storage.from('algolync-artifacts').upload(path,bytes,{contentType:'application/octet-stream',upsert:true});
    if(uploaded.error) return NextResponse.json({error:'Private artifact upload failed.'},{status:503});
    const saved=await admin.from('ea_product_artifacts').upsert({
      ea_slug:slug,storage_path:path,sha256,size_bytes:file.size,artifact_version:version,
      release_approved:false,approved_at:null,updated_at:new Date().toISOString(),
    },{onConflict:'ea_slug'}).select('storage_path,sha256,size_bytes,artifact_version,release_approved').single();
    if(saved.error) return NextResponse.json({error:'Artifact uploaded but registry update failed; contact owner support.'},{status:503});
    return NextResponse.json({success:true,artifact:saved.data},{headers:{'Cache-Control':'no-store'}});
  } catch(error) {
    console.error('Owner artifact upload failed:',error);
    return NextResponse.json({error:'Artifact upload unavailable.'},{status:503});
  }
}
