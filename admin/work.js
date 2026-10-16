// TEKİNOĞULLARI İMALAT: authenticated, quote-linked work tracking. Financial ledger stays separate.
const workStatuses={
 planned:"Planlandı",
 in_progress:"Üretimde",
 ready:"Teslime Hazır",
 delivered:"Teslim Edildi",
 cancelled:"İptal"
};
const workMoney=new Intl.NumberFormat("tr-TR",{style:"currency",currency:"TRY"});
const workDate=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-")};
const workShortDate=d=>d?d.split("-").reverse().join("."):"Tarih girilmedi";
const workIsActive=job=>["planned","in_progress","ready"].includes(job.status);
const workLate=job=>workIsActive(job)&&Boolean(job.due_date)&&job.due_date<workDate();
const workNear=job=>{
 if(!workIsActive(job)||!job.due_date||workLate(job))return false;
 const deadline=new Date(job.due_date+"T12:00:00"),future=new Date();
 future.setHours(12,0,0,0);future.setDate(future.getDate()+7);
 return deadline<=future;
};
export function initWork(sb){
 const $=id=>document.getElementById(id);
 const el=(type,text,cls)=>{const n=document.createElement(type);if(text!==undefined&&text!==null)n.textContent=String(text);if(cls)n.className=cls;return n};
 let jobs=[],quotes=[],editingId=null,loaded=false,requestSerial=0;
 const feedback=(message,error=false)=>{
  const out=$("workFeedback");out.textContent=message;
  out.className="work-feedback "+(message?(error?"error":"success"):"");
 };
 function showEditor(){
  $("workNotice").classList.add("is-hidden");
  $("workEditor").classList.add("work-form-open");
  $("workEditor").scrollIntoView({behavior:"smooth",block:"start"});
 }
 function resetForm(closeOnMobile=false){
  editingId=null;$("workForm").reset();
  $("workQuote").disabled=false;
  $("workFormTitle").textContent="Yeni İş Kaydı";
  $("workSave").textContent="İşi Kaydet";
  $("workStart").value=workDate();
  $("workStatus").value="planned";
  if(closeOnMobile)$("workEditor").classList.remove("work-form-open");
  feedback("");
  fillQuoteOptions();
 }
 function fillQuoteOptions(){
  const selected=$("workQuote").value;
  $("workQuote").replaceChildren();
  const empty=el("option","Onaylanmış teklif seç");empty.value="";$("workQuote").append(empty);
  const used=new Set(jobs.map(j=>j.quote_id));
  for(const q of quotes){
   if(used.has(q.id)&&q.id!==selected)continue;
   const option=el("option",q.customer_name+" • "+q.service+" • "+new Date(q.created_at).toLocaleDateString("tr-TR"));
   option.value=q.id;$("workQuote").append(option);
  }
  // Retain the current linked quote even if its quote status changed after job creation.
  if(selected&&![...$("workQuote").options].some(x=>x.value===selected)){
   const current=jobs.find(j=>j.quote_id===selected);
   if(current){
    const label=(current.quote?.customer_name||"Müşteri")+" • "+(current.quote?.service||current.title);
    const option=el("option",label);option.value=selected;$("workQuote").append(option);
   }
  }
  if(selected&&[...$("workQuote").options].some(x=>x.value===selected))$("workQuote").value=selected;
 }
 async function loadQuoteOptions(){
  const {data,error}=await sb.from("quote_requests")
   .select("id,customer_name,customer_phone,service,details,status,created_at")
   .in("status",["approved","in_production","completed"])
   .order("created_at",{ascending:false}).limit(500);
  if(error){feedback("Teklif seçenekleri alınamadı. Tekrar deneyin.",true);return false}
  quotes=data||[];
  fillQuoteOptions();
  return true;
 }
 function render(){
  const list=$("workList");list.replaceChildren();
  const active=jobs.filter(workIsActive),late=jobs.filter(workLate),near=jobs.filter(workNear),delivered=jobs.filter(x=>x.status==="delivered");
  $("workTotal").textContent=jobs.length;
  $("workActive").textContent=active.length;
  $("workLate").textContent=late.length;
  $("workSoon").textContent=near.length;
  $("workDelivered").textContent=delivered.length;
  const term=$("workSearch").value.trim().toLocaleLowerCase("tr-TR");
  const filter=$("workFilter").value;
  const visible=jobs.filter(job=>{
   if(filter==="overdue"&&!workLate(job))return false;
   if(filter==="soon"&&!workNear(job))return false;
   if(filter&&filter!=="overdue"&&filter!=="soon"&&job.status!==filter)return false;
   return !term||[job.title,job.notes,job.quote?.customer_name,job.quote?.service,job.quote?.customer_phone].some(x=>String(x||"").toLocaleLowerCase("tr-TR").includes(term));
  }).sort((a,b)=>{
   const rank=x=>workLate(x)?0:workNear(x)?1:workIsActive(x)?2:3;
   const byRank=rank(a)-rank(b);
   if(byRank)return byRank;
   if(workIsActive(a)&&workIsActive(b)){
    if(a.due_date&&!b.due_date)return -1;
    if(!a.due_date&&b.due_date)return 1;
    if(a.due_date&&b.due_date&&a.due_date!==b.due_date)return a.due_date.localeCompare(b.due_date);
   }
   return b.created_at.localeCompare(a.created_at);
  });
  $("workVisibleCount").textContent=visible.length+" iş listeleniyor (en son 500 kayıt)";
  if(!visible.length){list.append(el("p",jobs.length?"Bu filtreye uyan iş bulunamadı.":"Henüz iş kaydı yok. Onaylanan tekliften ilk işi oluşturabilirsin.","empty"));return}
  for(const job of visible){
   const card=el("button",null,"work-item"+(editingId===job.id?" selected":""));
   card.type="button";card.setAttribute("aria-label",(job.quote?.customer_name||"Müşteri")+" "+job.title+" işini düzenle");
   const row=el("div",null,"work-item-top");
   row.append(el("strong",job.title),el("span",workStatuses[job.status]||job.status,"work-status "+job.status));
   card.append(row,el("div",(job.quote?.customer_name||"Müşteri")+" • "+(job.quote?.service||"İş"),"work-item-meta"));
   const bottom=el("div",null,"work-item-bottom");
   const dateText=job.due_date?"Teslim: "+workShortDate(job.due_date):"Teslim tarihi yok";
   let statusText="";
   if(workLate(job))statusText=" • GECİKTİ";
   else if(workNear(job))statusText=" • Yaklaşıyor";
   bottom.append(el("span",dateText+statusText,"work-date"+(workLate(job)?" late":workNear(job)?" soon":"")));
   if(job.agreed_price!==null&&job.agreed_price!==undefined)bottom.append(el("b",workMoney.format(Number(job.agreed_price)),"work-price"));
   card.append(bottom);
   card.addEventListener("click",()=>editJob(job.id));
   list.append(card);
  }
 }
 async function load(){
  const seq=++requestSerial;
  $("workList").replaceChildren(el("p","İşler yükleniyor…","empty"));
  const {data,error}=await sb.from("tek_work_orders")
   .select("id,quote_id,title,agreed_price,start_date,due_date,status,notes,created_at,updated_at,quote:quote_requests(customer_name,customer_phone,service)")
   .order("created_at",{ascending:false}).limit(500);
  if(seq!==requestSerial)return;
  if(error){$("workList").replaceChildren(el("p","İş kayıtları açılamadı. Girişini kontrol edip Yenile'ye bas.","error"));return}
  jobs=data||[];loaded=true;
  render();fillQuoteOptions();
 }
 function editJob(id){
  const job=jobs.find(j=>j.id===id);if(!job)return;
  resetForm();
  editingId=id;
  const q=job.quote||{};
  const option=el("option",(q.customer_name||"Müşteri")+" • "+(q.service||job.title));
  option.value=job.quote_id;$("workQuote").append(option);
  $("workQuote").value=job.quote_id;$("workQuote").disabled=true;
  $("workTitle").value=job.title;
  $("workPrice").value=job.agreed_price??"";
  $("workStart").value=job.start_date;
  $("workDue").value=job.due_date||"";
  $("workStatus").value=job.status;
  $("workNotes").value=job.notes||"";
  $("workFormTitle").textContent="İşi Düzenle";
  $("workSave").textContent="Değişiklikleri Kaydet";
  render();showEditor();
 }
 async function activate(){
  $("homeView").classList.add("is-hidden");
  $("refresh").classList.remove("is-hidden");
  $("quoteView").classList.add("is-hidden");
  $("financeView").classList.add("is-hidden");
  $("accountView").classList.add("is-hidden");
  $("workView").classList.remove("is-hidden");
  for(const id of ["homeTab","quoteTab","financeTab","accountTab","workTab"]){
   const selected=id==="workTab";
   $(id).classList.toggle("active",selected);
   $(id).setAttribute("aria-selected",String(selected));
  }
  for(const id of ["mobileHome","mobileQuotes","mobileFinance","mobileAccounts","mobileWork"]){
   const selected=id==="mobileWork";
   $(id).classList.toggle("active",selected);
   if(selected)$(id).setAttribute("aria-current","page");
   else $(id).removeAttribute("aria-current");
  }
  $("adminPageTitle").textContent="İş Takibi";
  if(!loaded)await load();
  await loadQuoteOptions();
 }
 async function startForQuote(q){
  if(!["approved","in_production","completed"].includes(q.status)){
   window.alert("İş oluşturmak için önce teklifi onaylamalısın.");
   return;
  }
  await activate();
  const exists=jobs.find(x=>x.quote_id===q.id);
  if(exists){editJob(exists.id);return}
  resetForm();
  if(!quotes.some(x=>x.id===q.id)){
   const option=el("option",q.customer_name+" • "+q.service);
   option.value=q.id;$("workQuote").append(option);
  }
  $("workQuote").value=q.id;
  $("workTitle").value=(q.service||"Özel İmalat").slice(0,150);
  $("workNotes").value=(q.details||"").slice(0,2000);
  showEditor();
 }
 $("workNew").addEventListener("click",()=>{resetForm();showEditor()});
 $("workCancel").addEventListener("click",()=>{resetForm(true);render()});
 $("workRefresh").addEventListener("click",async()=>{await Promise.all([load(),loadQuoteOptions()])});
 $("workFilter").addEventListener("change",render);
 $("workSearch").addEventListener("input",render);
 $("workQuote").addEventListener("change",()=>{
  if(editingId)return;
  const q=quotes.find(x=>x.id===$("workQuote").value);
  if(!q)return;
  $("workTitle").value=(q.service||"Özel İmalat").slice(0,150);
  $("workNotes").value=(q.details||"").slice(0,2000);
 });
 $("workTab").addEventListener("click",()=>void activate());
 $("workForm").addEventListener("submit",async event=>{
  event.preventDefault();
  if(!$("workForm").reportValidity())return;
  const quote_id=$("workQuote").value;
  const title=$("workTitle").value.trim(),notes=$("workNotes").value.trim();
  const status=$("workStatus").value;
  const start_date=$("workStart").value,due_date=$("workDue").value||null;
  const entered=$("workPrice").value.trim();
  const agreed_price=entered===""?null:Number(entered);
  if(!quote_id){feedback("Bir müşteri teklifi seçmelisin.",true);return}
  if(title.length<2||title.length>150){feedback("İş adı 2 ile 150 karakter arasında olmalı.",true);return}
  if(notes.length>2000){feedback("Notlar en fazla 2000 karakter olabilir.",true);return}
  if(!Object.hasOwn(workStatuses,status)){feedback("Geçerli bir iş durumu seçmelisin.",true);return}
  if(agreed_price!==null&&(!Number.isFinite(agreed_price)||agreed_price<0||agreed_price>999999999999.99)){
   feedback("Geçerli, sıfır veya pozitif bir iş bedeli yaz.",true);return;
  }
  if(due_date&&due_date<start_date){feedback("Teslim tarihi başlangıçtan önce olamaz.",true);return}
  const payload={title,agreed_price,status,start_date,due_date,notes};
  if(!editingId)payload.quote_id=quote_id;
  const save=$("workSave");save.disabled=true;save.textContent="Kaydediliyor…";feedback("");
  try{
   const result=editingId?
    await sb.from("tek_work_orders").update(payload).eq("id",editingId).select("id").single():
    await sb.from("tek_work_orders").insert(payload).select("id").single();
   if(result.error||!result.data)throw result.error||new Error("Kaydedilemedi");
   resetForm(true);
   await load();
   await loadQuoteOptions();
   $("workNotice").textContent="İş başarıyla kaydedildi. İş listesinden istediğin zaman düzenleyebilirsin.";
   $("workNotice").classList.remove("is-hidden");
   $("workList").scrollIntoView({behavior:"smooth",block:"start"});
  }catch(error){
   const duplicate=error?.code==="23505";
   const reason=duplicate?"Bu teklif için zaten bir iş kaydı var. İş listesinden açabilirsin.":
    "İş kaydedilemedi. Teklifin onaylı olduğundan, tarih ve bilgilerin doğru olduğundan emin ol.";
   feedback(reason,true);
  }finally{save.disabled=false;save.textContent=editingId?"Değişiklikleri Kaydet":"İşi Kaydet"}
 });
 resetForm(true);
 return {activate,startForQuote,refresh:load};
}
