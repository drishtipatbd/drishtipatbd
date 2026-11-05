(()=>{
const cfg=window.DRISHIPAT_CONFIG||{},ready=!!(window.supabase&&cfg.SUPABASE_URL&&cfg.SUPABASE_ANON_KEY),db=ready?window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY):null;
const $=id=>document.getElementById(id);let role=null;
const labels={header:'হেডার / লোগোর পাশ',top:'হোমপেজের প্রধান ব্যানার',side:'সাইডবার',side_tall:'সাইডবারের লম্বা বিজ্ঞাপন',feed:'সংবাদ তালিকার মাঝখানে',bottom:'ফুটার ব্যানার',article:'সংবাদের ভেতরে'};
function status(text,bad=false){$('status').textContent=text;$('status').style.color=bad?'#b51f2b':'#138444'}
async function checkRole(){const {data:{session}}=await db.auth.getSession();if(!session)return null;const {data,error}=await db.from('admin_users').select('role').eq('user_id',session.user.id).maybeSingle();if(error)throw error;return data?.role||null}
async function scan(){
 $('inventoryStatus').innerHTML='<p>বিজ্ঞাপনের অবস্থান পরীক্ষা হচ্ছে…</p>';
 const {data:settings,error}=await db.from('site_settings').select('key,value').in('key',['ads','ad_networks']);
 if(error)throw error;
 const all=Object.fromEntries((settings||[]).map(x=>[x.key,x.value||{}])),ads=all.ads||{},network=all.ad_networks||{},networkSlots=network.slots||{};
 let campaigns=[],campaignError=null;
 const cr=await db.from('ad_campaigns').select('id,title,placement,ad_type,status,article_id,image_url,embed_code').eq('status','active').eq('ad_type','direct').limit(200);
 if(cr.error)campaignError=cr.error.message;else campaigns=cr.data||[];
 let articleAds=0,articleCheck='পরীক্ষাできনি';
 const ar=await db.from('articles').select('id,ad_slots').eq('status','published').limit(300);
 if(!ar.error){articleAds=(ar.data||[]).filter(a=>Array.isArray(a.ad_slots)&&a.ad_slots.length).length;articleCheck='পরীক্ষিত';}
 const items=Object.entries(labels).map(([key,label])=>{
  const siteCode=ads.enabled===true&&!!String(ads[key]||'').trim();
  const legacyCode=networkSlots[key]?.enabled===true&&!!networkSlots[key]?.code;
  const direct=campaigns.some(a=>String(a.placement||'').split(',').includes(key));
  const articleCount=key==='article'?articleAds>0:false;
  const found=siteCode||legacyCode||direct||articleCount;
  const sources=[siteCode?'বর্তমান সাইট বিজ্ঞাপন কোড':null,legacyCode?'আগের নেটওয়ার্ক সেটিংস':null,direct?'সক্রিয় সরাসরি বিজ্ঞাপন':null,articleCount?articleAds+'টি সংবাদে বিজ্ঞাপন':null].filter(Boolean);
  return '<div class="adscan-card"><b>'+label+'</b><p class="adscan-status">'+(found?'বিজ্ঞাপন সেটআপ পাওয়া গেছে':'কোনো সক্রিয় বিজ্ঞাপন সেটআপ পাওয়া যায়নি')+'</p><small>'+(sources.join(' · ')||'পরিচিত সেটিংসে বিজ্ঞাপন কোড পাওয়া যায়নি')+'</small></div>';
 });
 $('inventoryStatus').innerHTML=items.join('');
 $('scanNote').textContent='পরীক্ষা: সাইট বিজ্ঞাপন সেটিংস, পুরোনো নেটওয়ার্ক সেটিংস, সক্রিয় সরাসরি Campaign এবং প্রকাশিত সংবাদের বিজ্ঞাপন। '+(campaignError?'Campaign পরীক্ষা করা যায়নি: '+campaignError+'. ':'')+'সংবাদ বিজ্ঞাপন কলাম '+articleCheck+'। হার্ডকোড করা বা বাইরের স্ক্রিপ্ট দিয়ে ইনজেক্ট হওয়া বিজ্ঞাপন এই ডেটাবেস স্ক্যানে ধরা নাও পড়তে পারে।';
}
$('loginForm').onsubmit=async e=>{e.preventDefault();try{if(!db)throw new Error('Supabase সংযোগ পাওয়া যায়নি');const {error}=await db.auth.signInWithPassword({email:$('email').value.trim(),password:$('password').value});if(error)throw error;role=await checkRole();if(role!=='admin')throw new Error('শুধু Admin এই তালিকা দেখতে পারবেন');$('loginPanel').classList.add('hidden');$('scanPanel').classList.remove('hidden');await scan()}catch(e){$('loginMessage').textContent=e.message;try{await db?.auth.signOut()}catch{}}};
$('scanAgain').onclick=()=>scan().catch(e=>status(e.message,true));
$('logoutBtn').onclick=async()=>{await db.auth.signOut();location.reload()};
})();