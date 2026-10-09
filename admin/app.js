import {createClient} from "https://esm.sh/@supabase/supabase-js@2.49.4";
const sb=createClient("https://xrlipgbetpohjewhlbml.supabase.co","sb_publishable_KR4wJm1CbhzSSJqwTbk57A_f8LThNpD",{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const statusLabels={new:"Yeni",reviewing:"Görüşülüyor",approved:"Onaylandı",in_production:"Üretimde",completed:"Tamamlandı",cancelled:"İptal"};
const $=id=>document.getElementById(id);
let requests=[],chosenId=null;
const loading=$("loading"),login=$("login"),dashboard=$("dashboard"),logout=$("logout");
const el=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined&&text!==null)e.textContent=String(text);if(cls)e.className=cls;return e};
const date=iso=>new Date(iso).toLocaleString("tr-TR",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"});
const showLogin=msg=>{loading.classList.add("is-hidden");login.classList.remove("is-hidden");dashboard.classList.add("is-hidden");logout.style.display="none";$("loginError").textContent=msg||""};
const showDashboard=()=>{loading.classList.add("is-hidden");login.classList.add("is-hidden");dashboard.classList.remove("is-hidden");logout.style.display="block"};
async function validateUser(){
 const {data:{session}}=await sb.auth.getSession();
 if(!session)return showLogin();
 const {data:authorized,error}=await sb.rpc("is_tek_admin");
 if(error||!authorized){await sb.auth.signOut();return showLogin("Bu hesap için yönetici yetkisi tanımlı değil.")}
 showDashboard();await loadQuotes();
}
async function loadQuotes(){
 const list=$("requestList");list.replaceChildren(el("p","Talepler yükleniyor…","empty"));
 const {data,error}=await sb.from("quote_requests").select("id,customer_name,customer_phone,service,details,attachment_path,status,admin_notes,created_at,updated_at").order("created_at",{ascending:false}).limit(300);
 if(error){list.replaceChildren(el("p","Talepler yüklenemedi. Oturumunuzu kontrol edip yeniden deneyin.","error"));return}
 requests=data||[];
 $("statAll").textContent=requests.length;
 $("statNew").textContent=requests.filter(x=>x.status==="new").length;
 $("statReview").textContent=requests.filter(x=>["reviewing","approved","in_production"].includes(x.status)).length;
 $("statDone").textContent=requests.filter(x=>x.status==="completed").length;
 renderList();await renderDetail();
}
function renderList(){
 const list=$("requestList");list.replaceChildren();
 const term=$("search").value.trim().toLocaleLowerCase("tr-TR"),filter=$("filter").value;
 const subset=requests.filter(x=>(!filter||x.status===filter)&&(!term||[x.customer_name,x.customer_phone,x.service,x.details].some(v=>String(v||"").toLocaleLowerCase("tr-TR").includes(term))));
 if(!subset.length){list.append(el("p","Bu koşullara uygun talep bulunamadı.","empty"));return}
 for(const q of subset){
  const button=el("button",null,"request"+(q.id===chosenId?" selected":""));
  button.type="button";
  const top=el("span",null,"head"),name=el("span",q.customer_name),tag=el("span",statusLabels[q.status]||q.status,"tag "+q.status);top.append(name,tag);
  button.append(top,el("span",q.service+" • "+date(q.created_at),"meta"));
  button.addEventListener("click",()=>{chosenId=q.id;renderList();void renderDetail()});
  list.append(button);
 }
}
async function renderDetail(){
 const detail=$("detail");detail.replaceChildren();const q=requests.find(x=>x.id===chosenId);
 if(!q){detail.append(el("p","Detayları görmek için soldan talep seçin.","empty"));return}
 detail.append(el("h3",q.customer_name));
 detail.append(el("p",q.service+" • "+date(q.created_at),"smallprint"));
 const field=(title,value)=>{detail.append(el("p",title,"label"),el("p",value||"Belirtilmemiş","value"))};
 field("TELEFON",q.customer_phone);
 const contact=el("a","Telefonla Ara ↗","text-link");contact.href="tel:"+q.customer_phone.replace(/[^+\d]/g,"");detail.append(contact);
 field("HİZMET",q.service);field("İŞİN DETAYLARI",q.details);
 if(q.attachment_path){
  const p=el("p","FOTOĞRAF","label");detail.append(p);
  const a=el("a","Fotoğrafı Aç ↗","text-link");a.target="_blank";a.rel="noopener noreferrer";a.href="#";a.addEventListener("click",e=>{if(a.href.endsWith("#"))e.preventDefault()});detail.append(a);
  const {data,error}=await sb.storage.from("tek-quote-photos").createSignedUrl(q.attachment_path,120);
  if(chosenId===q.id){if(!error&&data?.signedUrl)a.href=data.signedUrl;else a.textContent="Fotoğraf açılamadı."}
 }
 const form=el("form");const statLabel=el("label","Talep Durumu");
 const select=el("select",null,"select-status");for(const [key,value] of Object.entries(statusLabels)){const option=el("option",value);option.value=key;select.append(option)}select.value=q.status;statLabel.append(select);
 const noteLabel=el("label","Yönetici Notu");const note=el("textarea");note.value=q.admin_notes||"";note.maxLength=3000;note.placeholder="Müşteriyle görüşme, ölçü, fiyat vb. notlar…";noteLabel.append(note);
 const save=el("button","Değişiklikleri Kaydet","btn");save.type="submit";
 const feedback=el("p",null,"smallprint");feedback.setAttribute("role","status");
 form.append(statLabel,noteLabel,save,feedback);detail.append(form);
 form.addEventListener("submit",async e=>{
  e.preventDefault();save.disabled=true;save.textContent="Kaydediliyor…";feedback.textContent="";
  const {error}=await sb.from("quote_requests").update({status:select.value,admin_notes:note.value.slice(0,3000),updated_at:new Date().toISOString()}).eq("id",q.id);
  if(error){feedback.className="error";feedback.textContent="Kaydedilemedi. Yeniden deneyin."}
  else{feedback.className="success";feedback.textContent="Değişiklikler kaydedildi.";q.status=select.value;q.admin_notes=note.value;renderList();$("statNew").textContent=requests.filter(x=>x.status==="new").length;$("statReview").textContent=requests.filter(x=>["reviewing","approved","in_production"].includes(x.status)).length;$("statDone").textContent=requests.filter(x=>x.status==="completed").length}
  save.disabled=false;save.textContent="Değişiklikleri Kaydet";
 });
}
$("loginForm").addEventListener("submit",async e=>{
 e.preventDefault();const button=e.currentTarget.querySelector("button"),email=$("email").value.trim(),password=$("password").value;
 button.disabled=true;button.textContent="Giriş yapılıyor…";$("loginError").textContent="";
 const {error}=await sb.auth.signInWithPassword({email,password});
 if(error)showLogin("Giriş başarısız. E-posta veya şifreyi kontrol edin.");else await validateUser();
 button.disabled=false;button.textContent="Giriş Yap ↗";
});
$("logout").addEventListener("click",async()=>{await sb.auth.signOut();chosenId=null;requests=[];showLogin()});
$("refresh").addEventListener("click",()=>void loadQuotes());
$("search").addEventListener("input",renderList);
$("filter").addEventListener("change",renderList);
const bootstrap=new URLSearchParams(location.hash.slice(1)).get("kurulum");
const setup=$("setup");
const setupApi="https://xrlipgbetpohjewhlbml.supabase.co/functions/v1/setup-tek-admin";
const bootstrapAnonKey="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhybGlwZ2JldHBvaGpld2hsYm1sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE1NDMyMTgsImV4cCI6MjEwNzExOTIxOH0.6FSUxlqhACpqsZBcz7c6jSwf8fD2j7V-6LGsxNsiunI";
$("setupForm").addEventListener("submit",async e=>{
 e.preventDefault();
 const button=e.currentTarget.querySelector('button[type="submit"]'),notice=$("setupError"),email=$("setupEmail").value.trim(),password=$("setupPassword").value;
 button.disabled=true;button.textContent="Hesap oluşturuluyor…";notice.textContent="";
 try{
  const res=await fetch(setupApi,{method:"POST",headers:{"Content-Type":"application/json","apikey":bootstrapAnonKey,"Authorization":"Bearer "+bootstrapAnonKey},body:JSON.stringify({setup_token:bootstrap,email,password})});
  const payload=await res.json().catch(()=>({}));
  if(!res.ok||!payload.ok)throw new Error(payload.error||"Hesap oluşturulamadı.");
  history.replaceState(null,"","/admin/");
  $("setupPassword").value="";
  const login=await sb.auth.signInWithPassword({email,password});
  if(login.error){setup.classList.add("is-hidden");showLogin("Hesap oluşturuldu. Şimdi giriş yapabilirsin.");}
  else{setup.classList.add("is-hidden");await validateUser();}
 }catch(error){notice.textContent=error.message||"Kurulum hatası. Lütfen tekrar deneyin."}
 finally{button.disabled=false;button.textContent="Hesabı Oluştur ↗"}
});
if(bootstrap&&/^[a-f0-9]{64}$/.test(bootstrap)){
 loading.classList.add("is-hidden");login.classList.add("is-hidden");dashboard.classList.add("is-hidden");setup.classList.remove("is-hidden");
}else validateUser().catch(()=>showLogin("Bağlantı kurulamadı. Lütfen tekrar deneyin."));

