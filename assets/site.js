(()=>{
const menu=document.querySelector('#menuButton'),links=document.querySelector('#navLinks');
if(menu&&links){menu.addEventListener('click',()=>{const open=links.classList.toggle('open');menu.setAttribute('aria-expanded',String(open));menu.textContent=open?'✕ Kapat':'☰ Menü'});links.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{links.classList.remove('open');menu.setAttribute('aria-expanded','false');menu.textContent='☰ Menü'}))}
document.querySelectorAll('[data-year]').forEach(el=>el.textContent=String(new Date().getFullYear()));
const prefersReduced=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if('IntersectionObserver'in window&&!prefersReduced){const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('visible');observer.unobserve(entry.target)}}),{threshold:.07});document.querySelectorAll('.reveal').forEach(el=>observer.observe(el))}else{document.querySelectorAll('.reveal').forEach(el=>el.classList.add('visible'))}
const form=document.querySelector('#quoteForm');if(!form)return;
const params=new URLSearchParams(location.search),requested=params.get('hizmet');const service=form.querySelector('#service');if(requested&&service&&[...service.options].some(o=>o.value===requested))service.value=requested;

const apiUrl="https://xrlipgbetpohjewhlbml.supabase.co/functions/v1/submit-quote";
function readPhoto(file){return new Promise((resolve,reject)=>{const reader=new FileReader();const timer=setTimeout(()=>{reader.abort();reject(new Error("Fotoğraf hazırlanamadı. Lütfen daha küçük bir fotoğraf seçip tekrar deneyin."))},12000);reader.onload=()=>{clearTimeout(timer);resolve(reader.result)};reader.onerror=()=>{clearTimeout(timer);reject(new Error("Fotoğraf okunamadı. Lütfen başka bir fotoğraf deneyin."))};reader.onabort=()=>{clearTimeout(timer);reject(new Error("Fotoğraf yükleme işlemi durduruldu. Tekrar deneyin."))};reader.readAsDataURL(file)})}
form.addEventListener('submit',async e=>{
 e.preventDefault();
 const btn=form.querySelector('#sendQuote'),status=form.querySelector('#feedback'),file=form.querySelector('#photo')?.files?.[0],phone=form.querySelector('#customerPhone').value.trim();
 if(!form.reportValidity())return;
 if(!/^[+\d\s()-]{7,35}$/.test(phone)){status.textContent='Telefon numarasını kontrol edin.';return}
 if(file&&(file.size>3145728||!['image/jpeg','image/png','image/webp'].includes(file.type))){status.textContent='Fotoğraf JPG, PNG veya WEBP olmalı ve 3 MB\'yi geçmemeli.';return}
 const body={customer_name:form.querySelector('#customer').value.trim(),customer_phone:phone,service:service.value,details:form.querySelector('#details').value.trim(),website:form.querySelector('#website').value};
 btn.disabled=true;btn.textContent='Gönderiliyor…';status.className='form-feedback';status.textContent=file?'Fotoğraf hazırlanıyor…':'Talebiniz gönderiliyor…';
 try{
  if(file){body.photo=await readPhoto(file);status.textContent='Fotoğraf hazır. Teklifiniz gönderiliyor…'}
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),20000);
  let response, payload;
  try {
    response=await fetch(apiUrl,{method:'POST',mode:'cors',credentials:'omit',cache:'no-store',headers:{'Content-Type':'text/plain;charset=UTF-8'},body:JSON.stringify(body),signal:controller.signal});
    payload=await response.json().catch(()=>({}));
  } finally { clearTimeout(timeout); }
  if(!response.ok||!payload.ok)throw new Error(payload.error||'Talep gönderilemedi. Lütfen tekrar deneyin.');
  form.reset();status.className='form-feedback success';status.textContent='Teklif talebiniz başarıyla alındı! En kısa sürede değerlendirilmek üzere kaydedildi.';
 }catch(error){status.className='form-feedback error';status.textContent=error?.name==='AbortError'?'Sunucu yanıt vermedi. Lütfen yeniden deneyin.':(error instanceof TypeError?'Bağlantı kurulamadı. İnternet bağlantınızı kontrol edip tekrar deneyin.':(error.message||'Bağlantı hatası. Lütfen tekrar deneyin.'))}
 finally{btn.disabled=false;btn.textContent='Teklif Gönder ↗'}
});
})();