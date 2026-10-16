// TEKİNOĞULLARI İMALAT • customer balances are calculated from existing financial records.
// This view never creates duplicate revenue, advances or customer payment records.
const money = new Intl.NumberFormat("tr-TR",{style:"currency",currency:"TRY"});
const statusNames = {planned:"Planlandı",in_progress:"Üretimde",ready:"Teslime Hazır",delivered:"Teslim Edildi",cancelled:"İptal"};
const el=(tag,text,cls)=>{
 const node=document.createElement(tag);
 if(text!==undefined&&text!==null)node.textContent=String(text);
 if(cls)node.className=cls;
 return node;
};
const turkish=x=>String(x||"").toLocaleLowerCase("tr-TR");
const formatMoney=x=>money.format(Number(x||0));
const isPriced=x=>x.agreed_price!==null&&x.agreed_price!==undefined;
const isCancelled=x=>x.job_status==="cancelled";
const hasDebt=x=>!isCancelled(x)&&isPriced(x)&&Number(x.remaining)>0.005;
const hasExcess=x=>isPriced(x)&&Number(x.extra_paid)>0.005;
const balanced=x=>!isCancelled(x)&&isPriced(x)&&Number(x.remaining)<=0.005&&!hasExcess(x);
const dateText=x=>x?x.split("-").reverse().join("."):"Belirlenmedi";

export function initAccounts(sb,{finance}){
 const $=id=>document.getElementById(id);
 let entries=[],loaded=false,loadVersion=0,paymentVersion=0;
 const message=(text,error=false)=>{
  const node=$("accountNotice");node.textContent=text;
  node.className="account-notice"+(error?" error":"")+(text?"":" is-hidden");
 };
 function updateTotals(){
  const included=entries.filter(x=>!isCancelled(x));
  const priced=included.filter(isPriced);
  const totals=priced.reduce((sum,x)=>{
   sum.prices+=Number(x.agreed_price);
   sum.paid+=Number(x.paid_total);
   sum.remaining+=Number(x.remaining);
   sum.extra+=Number(x.extra_paid);
   return sum;
  },{prices:0,paid:0,remaining:0,extra:0});
  $("accountTotal").textContent=formatMoney(totals.prices);
  $("accountReceived").textContent=formatMoney(totals.paid);
  $("accountOutstanding").textContent=formatMoney(totals.remaining);
  $("accountUnpriced").textContent=included.length-priced.length;
  $("accountTotalLabel").textContent=priced.length+" bedeli belirlenmiş iş";
  $("accountExtra").textContent=totals.extra>0.005?"Fazla ödeme: "+formatMoney(totals.extra):"";
  $("accountCount").textContent=entries.length+" iş hesabı • bedeli belirsiz ve iptal işler toplam tutarlara dahil değil";
 }
 const summary=(job)=>{
  if(isCancelled(job))return ["İptal","cancelled"];
  if(!isPriced(job))return ["Bedel Belirsiz","unknown"];
  if(hasExcess(job))return ["Fazla Ödeme","extra"];
  if(hasDebt(job))return [Number(job.paid_total)>0?"Kısmi Ödeme":"Ödeme Bekliyor",Number(job.paid_total)>0?"partial":"unpaid"];
  return ["Ödendi","paid"];
 };
 function makeAmount(label,value){
  const div=el("div",null,"account-amount");
  div.append(el("small",label),el("strong",value));
  return div;
 }
 function paymentInfo(job,detail){
  const section=el("div",null,"account-history");
  const head=el("strong","Ödeme Geçmişi");
  const list=el("div","Ödemeler yükleniyor…","account-payment-loading");
  section.append(head,list);
  detail.append(section);
  const token=++paymentVersion;
  sb.from("finance_transactions")
   .select("id,entry_date,category,description,amount")
   .eq("quote_id",job.quote_id)
   .eq("kind","income")
   .order("entry_date",{ascending:false})
   .order("created_at",{ascending:false})
   .limit(100)
   .then(({data,error})=>{
    if(!section.isConnected||token>paymentVersion)return;
    list.replaceChildren();
    if(error){list.append(el("p","Ödeme geçmişi yüklenemedi.","account-empty"));return}
    if(!data?.length){list.append(el("p","Bu işe bağlı tahsilat henüz kaydedilmemiş.","account-empty"));return}
    for(const tx of data){
     const row=el("div",null,"account-payment");
     const left=el("div",null,"account-payment-text");
     left.append(el("strong",tx.category),el("small",dateText(tx.entry_date)+" • "+tx.description));
     row.append(left,el("b",formatMoney(tx.amount)));
     list.append(row);
    }
    if(job.payment_count>data.length)list.append(el("p","En yeni 100 ödeme listelendi. Toplamlar tüm kayıtları kapsar.","account-footnote"));
   })
   .catch(()=>{if(section.isConnected)list.textContent="Ödeme geçmişi yüklenemedi."});
 }
 function render(){
  updateTotals();
  const filter=$("accountFilter").value,term=turkish($("accountSearch").value.trim());
  const filtered=entries.filter(job=>{
   if(filter==="debt"&&!hasDebt(job))return false;
   if(filter==="settled"&&!balanced(job))return false;
   if(filter==="unknown"&&(isPriced(job)||isCancelled(job)))return false;
   if(filter==="extra"&&!hasExcess(job))return false;
   if(filter==="cancelled"&&!isCancelled(job))return false;
   return !term||[job.customer_name,job.customer_phone,job.job_title,job.service].some(v=>turkish(v).includes(term));
  }).sort((a,b)=>{
    const rank=x=>hasDebt(x)?0:!isPriced(x)&&!isCancelled(x)?1:hasExcess(x)?2:balanced(x)?3:4;
    const d=rank(a)-rank(b);return d||b.created_at.localeCompare(a.created_at);
  });
  $("accountVisible").textContent=filtered.length+" hesap";
  const list=$("accountList");list.replaceChildren();
  if(!filtered.length){
   list.append(el("p",entries.length?"Bu filtreye uygun müşteri hesabı yok.":"Henüz iş hesabı yok. Önce onaylı bir tekliften iş kaydı oluştur.","account-empty"));
   return;
  }
  for(const job of filtered){
   const card=el("details",null,"account-card");
   const head=el("summary",null,"account-card-head");
   const titleBox=el("span",null,"account-head-text");
   const subtitle=el("small",job.service+" • "+(statusNames[job.job_status]||job.job_status));
   titleBox.append(el("strong",job.customer_name),el("span",job.job_title),subtitle);
   const [state,stateClass]=summary(job);
   const right=el("span",null,"account-head-right");
   right.append(el("span",state,"account-badge "+stateClass),
      el("strong",isPriced(job)?"Kalan "+formatMoney(job.remaining):"Bedel girilmedi","account-due"));
   head.append(titleBox,right);
   card.append(head);
   const detail=el("div",null,"account-card-body");
   const grid=el("div",null,"account-amount-grid");
   grid.append(makeAmount("Anlaşılan İş Bedeli",isPriced(job)?formatMoney(job.agreed_price):"Belirlenmedi"),
       makeAmount("Tahsil Edilen",formatMoney(job.paid_total)),
       makeAmount("Kapora / Avans",formatMoney(job.advance_paid)),
       makeAmount("Kalan Alacak",isPriced(job)?formatMoney(job.remaining):"Hesaplanamaz"));
   detail.append(grid);
   if(isPriced(job)&&Number(job.agreed_price)>0){
    const progress=el("div",null,"account-progress"),bar=el("span");
    bar.style.width=Math.max(0,Math.min(100,100*Number(job.paid_total)/Number(job.agreed_price)))+"%";
    progress.setAttribute("role","progressbar");progress.setAttribute("aria-valuenow",String(Math.min(100,Math.round(100*Number(job.paid_total)/Number(job.agreed_price)))));
    progress.setAttribute("aria-valuemin","0");progress.setAttribute("aria-valuemax","100");
    progress.setAttribute("aria-label","Ödeme yüzdesi");
    progress.append(bar);detail.append(progress);
   }
   if(hasExcess(job))detail.append(el("p","İş bedelinden fazla tahsilat: "+formatMoney(job.extra_paid)+". Mali kayıtları kontrol et.","account-extra"));
   if(!isPriced(job))detail.append(el("p","Kalan alacağı hesaplamak için önce İşler bölümünde iş bedelini belirle.","account-alert"));
   if(isCancelled(job))detail.append(el("p","İptal edilmiş iş. Bu hesap genel alacak toplamına eklenmez.","account-alert"));
   const note=el("p","Ödemeler Mali Yönetim'deki bu teklife bağlı gelir kayıtlarından hesaplanır. İş tutarı tahsilat değildir.","account-detail-note");
   detail.append(note);
   const controls=el("div",null,"account-actions");
   const payment=el("button","Tahsilat / Kapora Gir","account-action primary");
   payment.type="button";
   payment.addEventListener("click",()=>void finance.startForQuote(job.quote_id));
   controls.append(payment);
   const phone=String(job.customer_phone||"").replace(/[^+\d]/g,"");
   if(phone){
    const call=el("a","Müşteriyi Ara","account-action");
    call.href="tel:"+phone;controls.append(call);
   }
   detail.append(controls);
   card.addEventListener("toggle",()=>{
    if(card.open&&!card.dataset.historyLoaded){
     card.dataset.historyLoaded="yes";
     paymentInfo(job,detail);
    }
   });
   card.append(detail);list.append(card);
  }
 }
 async function refresh(){
  const current=++loadVersion;
  $("accountList").replaceChildren(el("p","Hesaplar yükleniyor…","account-empty"));
  message("");
  $("accountRefresh").disabled=true;
  const all=[];
  try{
   // Paged reads prevent silently dropping old customer balances at the API row limit.
   for(let offset=0;offset<10000;offset+=1000){
    const {data,error}=await sb.rpc("tek_customer_account_balances").range(offset,offset+999);
    if(error)throw error;
    if(current!==loadVersion)return;
    const chunk=data||[];
    all.push(...chunk);
    if(chunk.length<1000)break;
   }
   if(current!==loadVersion)return;
   entries=all;loaded=true;
   if(entries.length>=10000)message("İlk 10.000 iş hesabı gösteriliyor. Tam sonuç için yöneticiye başvur.",true);
   render();
   $("accountUpdated").textContent="Güncellendi: "+new Date().toLocaleTimeString("tr-TR",{hour:"2-digit",minute:"2-digit"});
  }catch(error){
   if(current!==loadVersion)return;
   $("accountList").replaceChildren(el("p","Hesaplar alınamadı. Bağlantıyı ve yetkili girişi kontrol edip yeniden dene.","account-empty"));
   for(const id of ["accountTotal","accountReceived","accountOutstanding"])$(id).textContent="—";
   $("accountUnpriced").textContent="—";
   message("Veriler yüklenemedi. Ödeme tutarları tahmin edilmedi.",true);
  }finally{if(current===loadVersion)$("accountRefresh").disabled=false}
 }
 async function activate(){
  for(const [tab,view,mobile] of [["homeTab","homeView","mobileHome"],["quoteTab","quoteView","mobileQuotes"],["workTab","workView","mobileWork"],["accountTab","accountView","mobileAccounts"],["financeTab","financeView","mobileFinance"]]){
   const current=tab==="accountTab";
   $(view).classList.toggle("is-hidden",!current);
   $(tab).classList.toggle("active",current);
   $(tab).setAttribute("aria-selected",String(current));
   $(mobile).classList.toggle("active",current);
   if(current)$(mobile).setAttribute("aria-current","page");
   else $(mobile).removeAttribute("aria-current");
  }
  $("refresh").classList.remove("is-hidden");
  $("adminPageTitle").textContent="Müşteri Hesapları";
  window.scrollTo({top:0,behavior:"auto"});
  await refresh();
 }
 $("accountTab").addEventListener("click",()=>void activate());
 $("accountRefresh").addEventListener("click",()=>void refresh());
 $("accountSearch").addEventListener("input",render);
 $("accountFilter").addEventListener("change",render);
 document.addEventListener("visibilitychange",()=>{
  if(document.visibilityState==="visible"&&!$("dashboard").classList.contains("is-hidden")&&!$("accountView").classList.contains("is-hidden"))
   void refresh();
 });
 return {activate,refresh};
}
