import {createClient} from "https://esm.sh/@supabase/supabase-js@2.49.4";
import {initFinance} from "./finance.js?v=7";
import {initAccounts} from "./accounts.js?v=3";
import {initWork} from "./work.js?v=7";
import {initStock} from "./stock.js?v=2";
import {initDocuments} from "./documents.js?v=3";
import {initHome} from "./home.js?v=4";
const sb=createClient("https://xrlipgbetpohjewhlbml.supabase.co","sb_publishable_KR4wJm1CbhzSSJqwTbk57A_f8LThNpD",{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const statusLabels={new:"Yeni",reviewing:"Görüşülüyor",approved:"Onaylandı",in_production:"Üretimde",completed:"Tamamlandı",cancelled:"İptal"};

let notificationStarted=false,notificationInterval=null,notificationLastId=null,notificationChecking=false;
async function startQuoteNotifications(){
 const native=window.TekinAndroid;
 if(!native||typeof native.getDeviceToken!=="function")return;
 try {
  const token=native.getDeviceToken();
  if(!/^[a-f0-9]{64}$/.test(token))throw new Error("Geçersiz cihaz anahtarı");
  const {data,error}=await sb.rpc("tek_register_notification_device",{p_token:token});
  if(error||!data)throw error||new Error("Cihaz yetkilendirilemedi");
  notificationLastId=requests[0]?.id||null;
  notificationStarted=true;
  native.startBackgroundChecks();
  $("notificationHint").textContent="Yeni teklif kontrolü etkin. Android bildirim iznine izin ver.";
  $("notificationHint").classList.remove("is-hidden");
  if(!notificationInterval)notificationInterval=setInterval(()=>void checkForegroundNewQuotes(),45000);
 }catch(error){
  $("notificationHint").textContent="Bildirim kurulamadı. Paneli yenileyip tekrar giriş yap.";
  $("notificationHint").classList.remove("is-hidden");
  console.warn("Notification setup failed:",error);
 }
}
async function checkForegroundNewQuotes(){
 if(!notificationStarted||notificationChecking||document.visibilityState!=="visible")return;
 notificationChecking=true;
 try {
  const {data,error}=await sb.from("quote_requests").select("id")
   .order("created_at",{ascending:false}).limit(1);
  if(error)return;
  const newest=data?.[0]?.id||null;
  if(newest!==notificationLastId&&notificationLastId!==null&&newest){
   if(window.TekinAndroid?.checkNow)window.TekinAndroid.checkNow();
   await loadQuotes();
   if(!$("homeView").classList.contains("is-hidden"))void home.refresh();
   $("notificationHint").textContent="Yeni teklif geldi. Liste güncellendi!";
  }
  notificationLastId=newest;
 }finally{notificationChecking=false}
}

const $=id=>document.getElementById(id);
let requests=[],chosenId=null;
const isMobile=()=>window.matchMedia("(max-width:800px)").matches;
function setMobileDetail(open){
 const grid=$("requestGrid");
 grid.classList.toggle("mobile-detail-active",open);
 if(isMobile()){
  const target=open?$("requestDetailPanel"):$("requestListPanel");
  requestAnimationFrame(()=>target.scrollIntoView({block:"start",behavior:"auto"}));
 }
}
function selectRequest(id){
 chosenId=id;
 renderList();
 void renderDetail();
 if(isMobile()){
  setMobileDetail(true);
  if(history.state?.tekDetailId!==id)history.pushState({tekDetailId:id},"","#talep-"+id);
 }
}
function backToRequests(){
 if(isMobile()&&history.state?.tekDetailId){history.back();return}
 chosenId=null;setMobileDetail(false);renderList();
}
window.addEventListener("popstate",event=>{
 if(event.state?.tekDetailId&&isMobile()){
  chosenId=event.state.tekDetailId;renderList();void renderDetail();setMobileDetail(true);
 }else{
  chosenId=null;setMobileDetail(false);renderList();
 }
});
$("backToRequests").addEventListener("click",backToRequests);
const customerRatings={1:"Kötü",2:"Orta",3:"İyi"};
// Ratings are stored on quotes and synchronized only for matching name + phone identities.
const getStars=q=>Number(q.customer_rating)||0;
const getRatingLabel=stars=>stars?customerRatings[stars]:"Değerlendirilmedi";

const loading=$("loading"),login=$("login"),dashboard=$("dashboard"),logout=$("logout");
const el=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined&&text!==null)e.textContent=String(text);if(cls)e.className=cls;return e};
const date=iso=>new Date(iso).toLocaleString("tr-TR",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"});

function whatsappNumber(phone){
 let digits=String(phone||"").replace(/\D/g,"");
 if(digits.startsWith("00"))digits=digits.slice(2);
 if(digits.length===11&&digits.startsWith("0"))digits="90"+digits.slice(1);
 else if(digits.length===10)digits="90"+digits;
 return /^[1-9][0-9]{9,14}$/.test(digits)?digits:null;
}
function whatsappMessages(q){
 const name=q.customer_name.trim();
 const intro="Merhaba "+name+",\n\nTEKİNOĞULLARI İMALAT olarak";
 const work=q.service.toLocaleLowerCase("tr-TR");
 const regards="\n\nİyi günler dileriz.\nTEKİNOĞULLARI İMALAT";
 const templates=[
  ["received","Teklif talebi alındı",intro+" ilettiğiniz "+work+" talebinizi aldık. Başvurunuzu inceleyip sizinle iletişime geçeceğiz."+regards],
  ["question","Ek bilgi iste",intro+" "+work+" talebinizle ilgili birkaç detaya ihtiyacımız var. Müsait olduğunuzda bize dönüş yapabilir misiniz?"+regards],
  ["offer","Fiyat teklifi görüşmesi",intro+" "+work+" işinizin fiyat teklifini görüşmek istiyoruz. Uygun olduğunuz bir zamanı paylaşabilir misiniz?"+regards]
 ];
 if(q.status==="completed")templates.push(["done","İş tamamlandı",intro+" "+work+" işinizin tamamlandığını bildirmek isteriz. Teslimat detayları için bize dönüş yapabilirsiniz."+regards]);
 templates.push(["custom","Kendi mesajımı yaz",""]);
 return templates;
}
function renderWhatsApp(q){
 const block=el("details",null,"wa-card"),heading=el("summary","WhatsApp ile Mesaj Gönder");
 const desc=el("p","Hazır mesaj seç, istersen düzenle; ardından şirket hesabının açık olduğu WhatsApp'ta gönder.","wa-description");
 const label=el("label","Mesaj Şablonu","wa-label"),select=el("select",null,"wa-select"),messageLabel=el("label","Mesaj Metni","wa-label");
 const message=el("textarea",null,"wa-message");message.rows=6;message.maxLength=2000;
 const templates=whatsappMessages(q);
 for(const [key,title] of templates){const option=el("option",title);option.value=key;select.append(option)}
 const note=el("p","Mesaj otomatik gönderilmez. WhatsApp'ta göndereceğin hesabı kontrol et.","wa-note");
 const phone=whatsappNumber(q.customer_phone),actions=el("div",null,"wa-actions"),feedback=el("p",null,"wa-feedback");
 feedback.setAttribute("role","status");feedback.setAttribute("aria-live","polite");
 label.append(select);messageLabel.append(message);
 const open=el("a","WhatsApp'ta Mesajı Aç ↗","btn wa-open");
 open.target="_blank";open.rel="noopener noreferrer";
 const updateLink=()=>{
  const msg=message.value.trim();
  if(!phone||!msg){
   open.removeAttribute("href");open.classList.add("wa-disabled");
   open.setAttribute("aria-disabled","true");return;
  }
  open.href="https://wa.me/"+phone+"?text="+encodeURIComponent(msg);
  open.classList.remove("wa-disabled");open.removeAttribute("aria-disabled");
 };
 const applyTemplate=()=>{
  message.value=templates.find(t=>t[0]===select.value)?.[2]||"";
  message.focus();updateLink();
 };
 select.addEventListener("change",applyTemplate);
 message.addEventListener("input",updateLink);
 open.addEventListener("click",event=>{
  if(!phone||!message.value.trim()){
   event.preventDefault();
   feedback.textContent=phone?"Önce mesaj metni yazmalısın.":"Telefon numarası WhatsApp bağlantısı için uygun değil.";
   return;
  }
  feedback.textContent="WhatsApp açılacak. Mesajı göndermek için WhatsApp'taki Gönder'e bas.";
 });
 select.value="received";message.value=templates[0][2];updateLink();
 actions.append(open);
 if(!phone)feedback.textContent="Telefon numarası geçersiz görünüyor. Müşteri numarasını kontrol et.";
 block.append(heading,desc,label,messageLabel,actions,note,feedback);
 return block;
}

const showLogin=msg=>{loading.classList.add("is-hidden");login.classList.remove("is-hidden");dashboard.classList.add("is-hidden");logout.style.display="none";$("loginError").textContent=msg||""};
const showDashboard=()=>{loading.classList.add("is-hidden");login.classList.add("is-hidden");dashboard.classList.remove("is-hidden");logout.style.display="block"};
async function validateUser(){
 const {data:{session}}=await sb.auth.getSession();
 if(!session)return showLogin();
 const {data:authorized,error}=await sb.rpc("is_tek_admin");
 if(error||!authorized){await sb.auth.signOut();return showLogin("Bu hesap için yönetici yetkisi tanımlı değil.")}
 showDashboard();$("moreView").classList.add("is-hidden");await loadQuotes();
 const fromNotification=new URLSearchParams(location.search).get("view");
 if(fromNotification==="jobs")$("workTab").click();
 else if(fromNotification==="quotes")$("quoteTab").click();
 else $("homeTab").click();
 void startQuoteNotifications();
}
async function loadQuotes(){
 const list=$("requestList");list.replaceChildren(el("p","Talepler yükleniyor…","empty"));

 const {data,error}=await sb.from("quote_requests")
   .select("id,customer_name,customer_phone,service,details,attachment_path,status,admin_notes,customer_rating,created_at,updated_at")
   .order("created_at",{ascending:false}).limit(300);
 if(error){list.replaceChildren(el("p","Talepler yüklenemedi. Oturumunuzu kontrol edip yeniden deneyin.","error"));return}
 requests=data||[];
 refreshQuoteStats();
 renderList();await renderDetail();
}
const nextStatus={
 new:{status:"reviewing",label:"Görüşmeye Al"},
 reviewing:{status:"approved",label:"Onayla"},
 approved:{status:"in_production",label:"Üretime Al"},
 in_production:{status:"completed",label:"Tamamla"}
};
let statusToastTimer=null,statusToastVersion=0;
function showStatusToast(message,undo){
 const toast=$("statusToast"),text=$("statusToastText"),button=$("statusUndo");
 if(statusToastTimer){clearTimeout(statusToastTimer);statusToastTimer=null}
 const version=++statusToastVersion;
 text.textContent=message;
 button.classList.toggle("is-hidden",!undo);
 button.onclick=undo?()=>{if(statusToastVersion===version){hideStatusToast();void undo()}}:null;
 toast.classList.remove("is-hidden");
 statusToastTimer=setTimeout(()=>{if(statusToastVersion===version)hideStatusToast()},7500);
}
function hideStatusToast(){
 ++statusToastVersion;
 if(statusToastTimer)clearTimeout(statusToastTimer);
 statusToastTimer=null;
 $("statusToast").classList.add("is-hidden");
 $("statusUndo").onclick=null;
}
function refreshQuoteStats(){
 $("statAll").textContent=requests.length;
 $("statNew").textContent=requests.filter(x=>x.status==="new").length;
 $("statReview").textContent=requests.filter(x=>["reviewing","approved","in_production"].includes(x.status)).length;
 $("statDone").textContent=requests.filter(x=>x.status==="completed").length;
}
async function updateQuickStatus(id,expected,target,button=null,allowUndo=true){
 const quote=requests.find(q=>q.id===id);
 if(!quote||quote.status!==expected){
  showStatusToast("Teklifin durumu değişmiş. Listeyi yenile.");
  await loadQuotes();
  return;
 }
 if(button){button.disabled=true;button.textContent="Kaydediliyor…"}
 try{
  const {data,error}=await sb.from("quote_requests")
   .update({status:target,updated_at:new Date().toISOString()})
   .eq("id",id).eq("status",expected)
   .select("id,status").maybeSingle();
  if(error||!data)throw error||new Error("Teklif durumu başka bir yerden değişti.");
  quote.status=target;
  refreshQuoteStats();
  renderList();
  if(chosenId===id)await renderDetail();
  const message=allowUndo
   ?"Durum: "+statusLabels[target]+". Yanlışlıkla değiştirdiysen geri alabilirsin."
   :"Durum eski hâline getirildi.";
  showStatusToast(message,allowUndo?()=>updateQuickStatus(id,target,expected,null,false):null);
 }catch(error){
  showStatusToast("Durum kaydedilemedi. Yeniden deneyin.");
  await loadQuotes();
 }finally{if(button&&button.isConnected){button.disabled=false;button.textContent=nextStatus[expected]?.label||"Kaydet"}}
}
function renderList(){
 const list=$("requestList");list.replaceChildren();
 const term=$("search").value.trim().toLocaleLowerCase("tr-TR"),filter=$("filter").value,ratingFilter=$("ratingFilter").value;
 const subset=requests.filter(x=>(!filter||(filter==="pending"?["new","reviewing"].includes(x.status):x.status===filter))&&(!ratingFilter||(ratingFilter==="unrated"?getStars(x)===0:getStars(x)===Number(ratingFilter)))&&(!term||[x.customer_name,x.customer_phone,x.service,x.details].some(v=>String(v||"").toLocaleLowerCase("tr-TR").includes(term))));
 if(!subset.length){list.append(el("p","Bu koşullara uygun talep bulunamadı.","empty"));return}
 for(const q of subset){
  const card=el("div",null,"request-card"+(q.id===chosenId?" selected":""));
  const button=el("button",null,"request");
  button.type="button";button.setAttribute("aria-label",q.customer_name+" teklif detayını aç");
  const top=el("span",null,"head"),name=el("span",q.customer_name),tag=el("span",statusLabels[q.status]||q.status,"tag "+q.status);top.append(name,tag);
  button.append(top,el("span",q.service+" • "+date(q.created_at),"meta"));
  const score=getStars(q);
  button.append(el("span",score?"★".repeat(score)+"☆".repeat(3-score)+"  "+getRatingLabel(score):"☆☆☆  Değerlendirilmedi","customer-rating-tag"+(score?" scored":"")));
  button.addEventListener("click",()=>selectRequest(q.id));
  card.append(button);
  const next=nextStatus[q.status];
  if(next){
   const actions=el("div",null,"request-quick-actions");
   const step=el("button",next.label+" →","request-next");
   step.type="button";step.setAttribute("aria-label",q.customer_name+" için "+next.label);
   step.addEventListener("click",()=>void updateQuickStatus(q.id,q.status,next.status,step));
   actions.append(step);card.append(actions);
  }
  list.append(card);
 }
}
async function saveCustomerRating(quoteId,stars,feedback,buttons){
 if(!quoteId)return;
 buttons.forEach(b=>b.disabled=true);
 feedback.className="rating-feedback";feedback.textContent="Kaydediliyor…";
 try{
  const value=stars===0?null:stars;
  const {data,error}=await sb.from("quote_requests")
    .update({customer_rating:value,updated_at:new Date().toISOString()})
    .eq("id",quoteId)
    .select("id,customer_rating")
    .single();
  if(error||!data)throw error||new Error("Güncelleme kaydedilemedi.");
  // A customer rating propagates to all matching requests on the server.
  // Reload to reflect those records immediately without sharing it with other customers.
  await loadQuotes();
 }catch(_){
  feedback.className="rating-feedback error";feedback.textContent="Puan kaydedilemedi. Yeniden deneyin.";
  buttons.forEach(b=>b.disabled=false);
 }
}
async function renderDetail(){
 const detail=$("detail");detail.replaceChildren();const q=requests.find(x=>x.id===chosenId);
 if(!q){detail.append(el("p","Detayları görmek için soldan talep seçin.","empty"));return}
 detail.append(el("h3",q.customer_name));
 detail.append(el("p",q.service+" • "+date(q.created_at),"smallprint"));
 const field=(title,value)=>{detail.append(el("p",title,"label"),el("p",value||"Belirtilmemiş","value"))};

 field("TELEFON",q.customer_phone);
 const actions=el("div",null,"customer-actions");
 const call=el("a","Ara","quick-action");
 call.href="tel:"+q.customer_phone.replace(/[^+\d]/g,"");
 actions.append(call);
 const waPhone=whatsappNumber(q.customer_phone);
 if(waPhone){
  const quick=el("a","WhatsApp","quick-action whatsapp");
  quick.href="https://wa.me/"+waPhone;quick.target="_blank";quick.rel="noopener noreferrer";
  actions.append(quick);
 }
 detail.append(actions);
 const pdf=el("button","PDF Fiyat Teklifi Oluştur","quote-pdf-btn");
 pdf.type="button";pdf.addEventListener("click",()=>documents.openForQuote(q));detail.append(pdf);
 if(["approved","in_production","completed"].includes(q.status)){
  const jobBtn=el("button","İş Kaydını Aç / Oluştur","quote-work-btn");
  jobBtn.type="button";
  jobBtn.addEventListener("click",()=>void work.startForQuote(q));
  detail.append(jobBtn);
 }
 const ratingKey=q.id,currentScore=getStars(q);
 const ratingBox=el("div",null,"rating-box");
 const ratingTitle=el("div","MÜŞTERİ DEĞERLENDİRMESİ","rating-title");
 const starsRow=el("div",null,"rating-stars");
 const ratingText=el("div",currentScore?getRatingLabel(currentScore)+" • "+currentScore+"/3 yıldız":"Henüz değerlendirilmedi","rating-current");
 const ratingHelp=el("p","1 yıldız: Kötü  ·  2 yıldız: Orta  ·  3 yıldız: İyi. Aynı ad ve telefonla gelen tekliflerde bu puan korunur.","rating-help");
 const ratingFeedback=el("p",null,"rating-feedback");ratingFeedback.setAttribute("role","status");ratingFeedback.setAttribute("aria-live","polite");
 const starsButtons=[];
 if(ratingKey){
  for(let n=1;n<=3;n++){
   const star=el("button","★","rating-star"+(n<=currentScore?" selected":""));
   star.type="button";star.title=n+" yıldız: "+customerRatings[n];star.setAttribute("aria-label",n+" yıldız: "+customerRatings[n]);
   star.setAttribute("aria-pressed",String(n===currentScore));
   starsButtons.push(star);starsRow.append(star);
   star.addEventListener("click",()=>void saveCustomerRating(ratingKey,n,ratingFeedback,starsButtons));
  }
  if(currentScore){const clear=el("button","Puanı Kaldır","rating-clear");clear.type="button";clear.addEventListener("click",()=>void saveCustomerRating(ratingKey,0,ratingFeedback,[...starsButtons,clear]));starsRow.append(clear)}
 }else{starsRow.append(el("span","Kayıt bulunamadı.","smallprint"))}
 ratingBox.append(ratingTitle,starsRow,ratingText,ratingHelp,ratingFeedback);
 detail.append(ratingBox);
 field("HİZMET",q.service);field("İŞİN DETAYLARI",q.details);
 if(q.attachment_path){
  const label=el("p","İŞ FOTOĞRAFI","label"),figure=el("figure",null,"quote-photo"),state=el("p","Fotoğraf yükleniyor…","photo-state");
  const image=el("img");image.alt=q.customer_name+" tarafından eklenen iş fotoğrafı";image.loading="eager";image.decoding="async";
  const anchor=el("a",null,"photo-link");
  anchor.target="_blank";anchor.rel="noopener noreferrer";anchor.setAttribute("aria-label","İş fotoğrafını büyüt");
  image.addEventListener("load",()=>{if(figure.isConnected)state.remove()});
  image.addEventListener("error",()=>{
   image.remove();
   state.textContent="Fotoğraf gösterilemedi. Sayfayı yenileyerek tekrar deneyin.";
  });
  figure.append(state,anchor);detail.append(label,figure);
  const {data,error}=await sb.storage.from("tek-quote-photos").createSignedUrl(q.attachment_path,3600);
  if(chosenId!==q.id)return;
  if(!error&&data?.signedUrl){
   anchor.href=data.signedUrl;anchor.append(image);image.src=data.signedUrl;
  }else state.textContent="Fotoğraf şu an yüklenemiyor. Lütfen yeniden deneyin.";
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
  else{feedback.className="success";feedback.textContent="Değişiklikler kaydedildi.";q.status=select.value;q.admin_notes=note.value;renderList();refreshQuoteStats()}
  save.disabled=false;save.textContent="Değişiklikleri Kaydet";
 });
 detail.append(renderWhatsApp(q));
}
$("loginForm").addEventListener("submit",async e=>{
 e.preventDefault();const button=e.currentTarget.querySelector("button"),email=$("email").value.trim(),password=$("password").value;
 button.disabled=true;button.textContent="Giriş yapılıyor…";$("loginError").textContent="";
 const {error}=await sb.auth.signInWithPassword({email,password});
 if(error)showLogin("Giriş başarısız. E-posta veya şifreyi kontrol edin.");else await validateUser();
 button.disabled=false;button.textContent="Giriş Yap ↗";
});
$("logout").addEventListener("click",async()=>{
 const native=window.TekinAndroid;
 notificationStarted=false;
 if(notificationInterval){clearInterval(notificationInterval);notificationInterval=null}
 if(native?.getDeviceToken){
  try{await sb.rpc("tek_unregister_notification_device",{p_token:native.getDeviceToken()})}catch(_){}
  native.stopBackgroundChecks();
 }
 await sb.auth.signOut();chosenId=null;requests=[];showLogin();
});
$("refresh").addEventListener("click",()=>{
 if(!$("homeView").classList.contains("is-hidden"))void home.refresh();
 else if(!$("accountView").classList.contains("is-hidden"))void accounts.refresh();
 else if(!$("stockView").classList.contains("is-hidden"))void stock.refresh();
 else if(!$("workView").classList.contains("is-hidden"))$("workRefresh").click();
 else if(!$("financeView").classList.contains("is-hidden"))$("finRefresh").click();
 else void loadQuotes();
});
$("search").addEventListener("input",renderList);
$("filter").addEventListener("change",renderList);
$("ratingFilter").addEventListener("change",renderList);
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


const finance=initFinance(sb);
const accounts=initAccounts(sb,{finance});
const documents=initDocuments();
const stock=initStock(sb);
const work=initWork(sb,{documents});
const home=initHome(sb,{openQuote:id=>{$("quoteTab").click();selectRequest(id)}});
$("mobileHome").addEventListener("click",()=>{$("homeTab").click()});
$("mobileQuotes").addEventListener("click",()=>{
 $("quoteTab").click();
 if(isMobile()&&$("requestGrid").classList.contains("mobile-detail-active"))backToRequests();
 window.scrollTo({top:0,behavior:"auto"});
});
$("mobileAccounts").addEventListener("click",()=>{$("accountTab").click();window.scrollTo({top:0,behavior:"auto"})});
$("mobileStock").addEventListener("click",()=>{$("stockTab").click();window.scrollTo({top:0,behavior:"auto"})});
$("mobileFinance").addEventListener("click",()=>{
 $("financeTab").click();
 window.scrollTo({top:0,behavior:"auto"});
});
$("mobileWork").addEventListener("click",()=>{ $("workTab").click();window.scrollTo({top:0,behavior:"auto"}) });

/* Simplified 4-tab mobile navigation: preserve existing module-specific section buttons. */
const primaryMobileSections=[
 ["mobileHome","homeView"],
 ["mobileQuotes","quoteView"],
 ["mobileWork","workView"]
];
const legacyMoreSections=["accountView","stockView","financeView"];
function paintCompactNav(){
 const moreOpen=!$("moreView").classList.contains("is-hidden");
 for(const [button,view] of primaryMobileSections){
  const selected=!moreOpen&&!$(view).classList.contains("is-hidden");
  $(button).classList.toggle("active",selected);
  if(selected)$(button).setAttribute("aria-current","page");
  else $(button).removeAttribute("aria-current");
 }
 const extraOpen=moreOpen||legacyMoreSections.some(id=>!$(id).classList.contains("is-hidden"));
 $("mobileMore").classList.toggle("active",extraOpen);
 if(extraOpen)$("mobileMore").setAttribute("aria-current","page");
 else $("mobileMore").removeAttribute("aria-current");
 $("mobileMore").setAttribute("aria-expanded",String(moreOpen));
}
function openCompactMore(){
 for(const id of ["homeView","quoteView","workView","accountView","stockView","financeView"])
  $(id).classList.add("is-hidden");
 for(const id of ["homeTab","quoteTab","workTab","accountTab","stockTab","financeTab"]){
  $(id).classList.remove("active");
  $(id).setAttribute("aria-selected","false");
 }
 $("moreView").classList.remove("is-hidden");
 $("refresh").classList.add("is-hidden");
 $("adminPageTitle").textContent="Diğer İşlemler";
 paintCompactNav();
 window.scrollTo({top:0,behavior:"auto"});
}
$("mobileMore").addEventListener("click",openCompactMore);
for(const id of ["homeTab","quoteTab","workTab","accountTab","stockTab","financeTab"]){
 $(id).addEventListener("click",()=>{
  $("moreView").classList.add("is-hidden");
  paintCompactNav();
 });
}
$("moreAccounts").addEventListener("click",()=>$("accountTab").click());
$("moreFinance").addEventListener("click",()=>$("financeTab").click());
$("moreStock").addEventListener("click",()=>$("stockTab").click());
$("moreDocuments").addEventListener("click",()=>documents.openBlank());
$("moreRefresh").addEventListener("click",()=>$("homeTab").click());
$("homeQuickPdf").addEventListener("click",()=>documents.openBlank());
$("homeQuickPayment").addEventListener("click",()=>{
 $("moreView").classList.add("is-hidden");
 void finance.startNewIncome();
 paintCompactNav();
});
