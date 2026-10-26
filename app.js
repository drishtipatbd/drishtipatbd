(() => {
const cfg=window.DRISHIPAT_CONFIG||{};
const ready=!!(window.supabase&&cfg.SUPABASE_URL&&cfg.SUPABASE_ANON_KEY&&!cfg.SUPABASE_URL.includes('YOUR-PROJECT')&&!cfg.SUPABASE_ANON_KEY.includes('YOUR_'));
const db=ready?window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY):null;
const $=id=>document.getElementById(id);
let allArticles=[],activeCategory='',searchTerm='',shown=10,settings={};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date=s=>{try{return new Intl.DateTimeFormat('bn-BD',{year:'numeric',month:'short',day:'numeric'}).format(new Date(s))}catch{return ''}};
const toast=m=>{const t=$('toast');t.textContent=m;t.classList.remove('hidden');setTimeout(()=>t.classList.add('hidden'),2800)};
function img(url,title,cls='news-image'){return url?`<img class="${cls}" src="${esc(url)}" alt="${esc(title)}" loading="lazy" onerror="this.outerHTML='<div class=\\'news-image image-placeholder\\'>ছবি পাওয়া যায়নি</div>'">`:`<div class="${cls} image-placeholder">দৃষ্টিপাতBD</div>`}
function articleCard(a,kind='row'){return `<article class="${kind==='mini'?'mini-news':kind==='hero'?'hero-card':'news-row'}">${img(a.image_url,a.title)}<div><div class="meta"><span class="category-tag">${esc(a.categories?.name||'সংবাদ')}</span><span>${date(a.published_at||a.created_at)}</span></div><h3><a href="#article-${esc(a.id)}" data-article="${esc(a.id)}">${esc(a.title)}</a></h3>${kind==='hero'||kind==='row'?`<p class="excerpt">${esc(a.excerpt||'')}</p>`:''}</div></article>`}
function filtered(){return allArticles.filter(a=>(!activeCategory||a.categories?.name===activeCategory)&&(!searchTerm||(a.title+' '+a.excerpt+' '+a.body).toLowerCase().includes(searchTerm.toLowerCase())))}
function render(){
 const items=filtered(),featured=items.find(a=>a.featured)||items[0];
 $('sectionTitle').textContent=activeCategory|| (searchTerm?'অনুসন্ধানের ফলাফল':'আজকের প্রধান সংবাদ');
 if(!items.length){$('heroNews').innerHTML='<p class="muted">এই মুহূর্তে কোনো সংবাদ পাওয়া যায়নি।</p>';$('latestNews').innerHTML='<p class="muted">সংবাদ প্রকাশিত হলে এখানে দেখা যাবে।</p>';return}
 const rest=items.filter(a=>a.id!==featured?.id);
 const heroSide=rest.slice(0,3);
 $('heroNews').innerHTML=(featured?articleCard(featured,'hero'):'')+`<div class="hero-side">${heroSide.map(a=>articleCard(a,'mini')).join('')}</div>`;
 const latest=items.filter(a=>a.id!==featured?.id).slice(0,shown);
 $('latestNews').innerHTML=latest.length?latest.map(a=>articleCard(a,'row')).join(''):'<p class="muted">আর কোনো সংবাদ নেই।</p>';
 $('loadMore').classList.toggle('hidden',items.length<=shown+1);
 $('popularNews').innerHTML=items.slice(0,5).map(a=>`<a href="#article-${esc(a.id)}" data-article="${esc(a.id)}">${esc(a.title)}</a>`).join('');
 document.querySelectorAll('[data-article]').forEach(el=>el.onclick=e=>{e.preventDefault();openArticle(el.dataset.article)});
}
function setTicker(text){const el=$('tickerText');el.textContent=text;el.style.setProperty('--ticker-start',(el.parentElement?.clientWidth||window.innerWidth)+'px');el.style.animation='none';void el.offsetWidth;el.style.animation='';}
function applySettings(){
 const g=settings.general||{},ads=settings.ads||{};
 if(g.tagline)document.querySelector('.tagline').textContent=g.tagline;
 const brand=document.querySelector('.brand-name');
 if(brand){if(g.logo&&/^https?:\/\//i.test(g.logo)){brand.innerHTML=`<img class="site-logo" src="${esc(g.logo)}" alt="দৃষ্টিপাতBD লোগো" onerror="this.outerHTML='দৃষ্টিপাত<span>BD</span>'">`}else{brand.innerHTML='দৃষ্টিপাত<span>BD</span>'}}
 setTicker(g.breaking||'দৃষ্টিপাতBD-তে আপনাকে স্বাগতম।');
 $('facebookLink').href=g.facebook||'#';$('youtubeLink').href=g.youtube||'#';
 $('contactEmail').textContent=g.email?'ইমেইল: '+g.email:'ইমেইল: যোগাযোগের তথ্য যোগ করা হয়নি';
 const map={headerAd:ads.header,topBannerAd:ads.top,sideAd:ads.side,bottomAd:ads.bottom};
 for(const [id,code] of Object.entries(map)){const el=$(id);if(code){el.innerHTML=code;el.querySelectorAll('script').forEach(old=>{const s=document.createElement('script');for(const a of old.attributes)s.setAttribute(a.name,a.value);s.text=old.textContent;old.replaceWith(s)});el.classList.remove('hidden')}else el.innerHTML='<span>বিজ্ঞাপনের স্থান</span>'}
 if(ads.notes && !document.getElementById('globalAdCode')){const box=document.createElement('div');box.id='globalAdCode';box.hidden=true;box.innerHTML=ads.notes;box.querySelectorAll('script').forEach(old=>{const s=document.createElement('script');for(const a of old.attributes)s.setAttribute(a.name,a.value);s.text=old.textContent;old.replaceWith(s)});document.body.appendChild(box)}
}
async function load(){
 $('today').textContent=new Intl.DateTimeFormat('bn-BD',{weekday:'long',year:'numeric',month:'long',day:'numeric'}).format(new Date());$('year').textContent=new Date().getFullYear();
 if(!db){$('heroNews').innerHTML='<div class="notice">ওয়েবসাইটের Supabase সংযোগ সেটআপ করা হয়নি। README.txt অনুযায়ী config.js তৈরি করে Supabase URL ও Publishable/anon key বসান।</div>';$('latestNews').innerHTML='';return}
 const [ar,sr]=await Promise.all([db.from('articles').select('id,title,slug,excerpt,body,image_url,author,featured,breaking,published_at,created_at,categories(name)').eq('status','published').order('published_at',{ascending:false}).limit(100),db.from('site_settings').select('key,value')]);
 if(ar.error){$('heroNews').innerHTML='<p class="muted">সংবাদ লোড করা যায়নি। Supabase schema ও RLS পরীক্ষা করুন।</p>';console.error(ar.error);return}
 allArticles=ar.data||[];(sr.data||[]).forEach(x=>settings[x.key]=x.value);applySettings();
 const g=settings.general||{};const manual=(g.breaking_enabled===false?[]:(g.breaking_items||[]));const articleBreaking=allArticles.filter(a=>a.breaking||a.is_breaking).map(a=>a.title);const headlines=[...manual,...articleBreaking];if(headlines.length)setTicker(headlines.join('  •  '));
 render();
 const sharedMatch=location.hash.match(/^#article-(.+)$/);if(sharedMatch){const sharedId=decodeURIComponent(sharedMatch[1]);setTimeout(()=>openArticle(sharedId),100)}
 const cats=await db.from('categories').select('name').order('name');if(!cats.error){const links=$('navLinks');const existing=new Set([...links.querySelectorAll('[data-cat]')].map(a=>a.dataset.cat));cats.data.forEach(c=>{if(!existing.has(c.name)){const a=document.createElement('a');a.href='#';a.dataset.cat=c.name;a.textContent=c.name;links.appendChild(a)}});links.querySelectorAll('[data-cat]').forEach(a=>a.onclick=e=>{e.preventDefault();activeCategory=a.dataset.cat;searchTerm='';shown=10;render();$('latestTitle').textContent=activeCategory})}
}
async function openArticle(id){const a=allArticles.find(x=>String(x.id)===String(id));if(!a)return;const url=location.origin+location.pathname+'#article-'+a.id;$('articleDetail').innerHTML=`<div class="meta"><span class="category-tag">${esc(a.categories?.name||'সংবাদ')}</span><span>${date(a.published_at||a.created_at)}</span><span>${esc(a.author||'দৃষ্টিপাতBD')}</span></div><h1>${esc(a.title)}</h1>${img(a.image_url,a.title,'article-image')}<p class="excerpt">${esc(a.excerpt||'')}</p><div class="article-body">${esc(a.body||'')}</div><div class="share-row"><a target="_blank" rel="noopener" href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}">Facebook-এ শেয়ার</a><a target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(a.title+' '+url)}">WhatsApp</a><a target="_blank" rel="noopener" href="https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(a.title)}">Telegram</a><button id="nativeShareArticle">আরও শেয়ার</button><button id="copyArticleLink">লিংক কপি</button></div><section class="comments-box"><h2>পাঠকের মন্তব্য</h2><p class="muted">মন্তব্য যাচাইয়ের পর প্রকাশ করা হবে।</p><form id="commentForm"><label>আপনার নাম<input id="commentName" maxlength="80" minlength="2" required></label><label>মন্তব্য<textarea id="commentBody" maxlength="2000" minlength="2" required rows="4"></textarea></label><button class="btn" type="submit">মন্তব্য পাঠান</button><span id="commentMessage" class="form-message"></span></form><div id="commentList"></div></section>`;$('articleModal').classList.remove('hidden');$('copyArticleLink').onclick=async()=>{try{await navigator.clipboard.writeText(url);toast('লিংক কপি হয়েছে')}catch{prompt('লিংক কপি করুন',url)}};$('nativeShareArticle').onclick=async()=>{if(navigator.share){try{await navigator.share({title:a.title,text:a.title,url})}catch(e){}}else{try{await navigator.clipboard.writeText(url);toast('লিংক কপি হয়েছে')}catch{prompt('লিংক কপি করুন',url)}}};loadComments(a.id);$('commentForm').onsubmit=async e=>{e.preventDefault();const btn=$('commentForm').querySelector('button');btn.disabled=true;try{const {error}=await db.from('article_comments').insert({article_id:a.id,name:$('commentName').value.trim(),body:$('commentBody').value.trim(),status:'pending'});if(error)throw error;$('commentForm').reset();$('commentMessage').textContent='ধন্যবাদ! যাচাইয়ের পর মন্তব্য প্রকাশ করা হবে।'}catch(err){$('commentMessage').textContent='মন্তব্য পাঠানো যায়নি: '+err.message}finally{btn.disabled=false}}}
async function loadComments(articleId){const box=$('commentList');const {data,error}=await db.from('article_comments').select('id,name,body,created_at').eq('article_id',articleId).eq('status','approved').order('created_at',{ascending:false}).limit(100);if(error){box.textContent='মন্তব্য লোড করা যায়নি।';return}box.innerHTML=data.length?data.map(x=>'<article class="comment-item"><b>'+esc(x.name)+'</b><small>'+date(x.created_at)+'</small><p>'+esc(x.body)+'</p></article>').join(''):'<p class="muted">এখনো কোনো প্রকাশিত মন্তব্য নেই।</p>'}
$('closeModal').onclick=()=>$('articleModal').classList.add('hidden');$('articleModal').onclick=e=>{if(e.target===$('articleModal'))$('articleModal').classList.add('hidden')};
$('menuToggle').onclick=()=>$('navLinks').classList.toggle('open');$('searchToggle').onclick=()=>$('searchRow').classList.toggle('hidden');
$('searchSubmit').onclick=()=>{searchTerm=$('searchInput').value.trim();activeCategory='';shown=10;render()};$('searchInput').addEventListener('keydown',e=>{if(e.key==='Enter')$('searchSubmit').click()});
$('loadMore').onclick=()=>{shown+=10;render()};document.querySelector('.home-link').onclick=e=>{e.preventDefault();activeCategory='';searchTerm='';shown=10;render()};
load();
})();