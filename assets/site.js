(()=>{
const menu=document.querySelector('#menuButton'),links=document.querySelector('#navLinks');
if(menu&&links){menu.addEventListener('click',()=>{const open=links.classList.toggle('open');menu.setAttribute('aria-expanded',String(open));menu.textContent=open?'✕ Kapat':'☰ Menü'});links.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{links.classList.remove('open');menu.setAttribute('aria-expanded','false');menu.textContent='☰ Menü'}))}
document.querySelectorAll('[data-year]').forEach(el=>el.textContent=String(new Date().getFullYear()));
const prefersReduced=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if('IntersectionObserver'in window&&!prefersReduced){const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('visible');observer.unobserve(entry.target)}}),{threshold:.07});document.querySelectorAll('.reveal').forEach(el=>observer.observe(el))}else{document.querySelectorAll('.reveal').forEach(el=>el.classList.add('visible'))}
const form=document.querySelector('#quoteForm');if(!form)return;
const params=new URLSearchParams(location.search),requested=params.get('hizmet');const service=form.querySelector('#service');if(requested&&service&&[...service.options].some(o=>o.value===requested))service.value=requested;
form.addEventListener('submit',async e=>{e.preventDefault();const name=form.querySelector('#customer').value.trim(),svc=service.value,detail=form.querySelector('#details').value.trim(),status=form.querySelector('#feedback'),file=form.querySelector('#photo');if(!name||!svc||!detail)return;
const msg='TEKİNOĞULLARI İMALAT | TEKLİF TALEBİ\nAd Soyad: '+name+'\nHizmet: '+svc+'\nİşin Detayları: '+detail+(file?.files?.length?'\nFotoğraf: '+file.files[0].name+' (mesaja ayrıca eklenecek)':'');
try{await navigator.clipboard.writeText(msg);status.textContent='Talep metniniz kopyalandı. WhatsApp veya başka bir mesajlaşma uygulamasına yapıştırabilirsiniz.'}catch(_){status.textContent='Metni aşağıdan seçip kopyalayabilirsiniz:';const t=document.createElement('textarea');t.readOnly=true;t.value=msg;t.style.width='100%';status.appendChild(t);t.select()}
});
})();