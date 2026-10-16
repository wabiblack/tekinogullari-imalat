// TEKİNOĞULLARI İMALAT • mobile-first business overview.
// Uses the existing admin-only Supabase RLS policies and finance summary RPC.
// Work order prices are never counted as income.
const money = new Intl.NumberFormat("tr-TR",{style:"currency",currency:"TRY",maximumFractionDigits:2});
const todayISO=()=>{
 const d=new Date();
 return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");
};
const afterDaysISO=days=>{
 const d=new Date();d.setDate(d.getDate()+days);
 return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");
};
const shortDate=value=>value?value.split("-").reverse().join("."):"Belirlenmedi";
const shortStamp=value=>new Date(value).toLocaleString("tr-TR",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"});
const element=(tag,text,className)=>{
 const node=document.createElement(tag);
 if(text!==undefined&&text!==null)node.textContent=String(text);
 if(className)node.className=className;
 return node;
};
export function initHome(sb,{openQuote}){
 const $=id=>document.getElementById(id);
 let sequence=0;
 const display=(id,value)=>{$(id).textContent=String(value)};
 const showError=(message)=>{
  const banner=$("homeError");
  banner.textContent=message;
  banner.classList.remove("is-hidden");
 };
 const clearError=()=>{
  $("homeError").classList.add("is-hidden");
  $("homeError").textContent="";
 };
 const unavailable=id=>display(id,"—");
 const isOk=response=>!response.error;
 function setMetric(response,id){
  if(isOk(response))display(id,Number(response.count||0).toLocaleString("tr-TR"));
  else unavailable(id);
 }
 function openTab(id){
  $(id).click();
  window.scrollTo({top:0,behavior:"auto"});
 }
 function goQuotes(filter=""){
  $("filter").value=filter;
  $("ratingFilter").value="";
  $("search").value="";
  openTab("quoteTab");
  $("requestGrid").classList.remove("mobile-detail-active");
  $("filter").dispatchEvent(new Event("change"));
 }
 function goJobs(filter=""){
  $("workFilter").value=filter;
  $("workSearch").value="";
  openTab("workTab");
  $("workFilter").dispatchEvent(new Event("change"));
 }
 function goFinance(){openTab("financeTab")}
 function renderQuotes(response){
  const list=$("homeRecentQuotes");list.replaceChildren();
  if(!isOk(response)){
   list.append(element("p","Yeni teklif listesi yüklenemedi.","home-empty"));return;
  }
  const quotes=response.data||[];
  if(!quotes.length){list.append(element("p","Bekleyen yeni teklif yok.","home-empty"));return}
  for(const q of quotes){
   const btn=element("button",null,"home-list-item");
   btn.type="button";
   btn.setAttribute("aria-label",q.customer_name+" adlı müşterinin teklifine git");
   const title=element("strong",q.customer_name);
   const detail=element("span",q.service+" • "+shortStamp(q.created_at),"home-list-subtitle");
   const arrow=element("span","›","home-list-chevron");
   const body=element("span",null,"home-list-text");
   body.append(title,detail);btn.append(body,arrow);
   btn.addEventListener("click",()=>openQuote(q.id));
   list.append(btn);
  }
 }
 function renderDue(response,today){
  const list=$("homeUpcomingJobs");list.replaceChildren();
  if(!isOk(response)){
   list.append(element("p","Teslim listesi yüklenemedi.","home-empty"));return;
  }
  const jobs=response.data||[];
  if(!jobs.length){list.append(element("p","Geciken veya önümüzdeki 7 günde teslim edilecek iş yok.","home-empty"));return}
  for(const job of jobs){
   const isLate=job.due_date<today;
   const btn=element("button",null,"home-list-item");
   btn.type="button";
   const name=job.quote?.customer_name||"Müşteri";
   btn.setAttribute("aria-label",name+" iş kaydına git");
   const title=element("strong",job.title);
   const text=element("span",name+" • "+shortDate(job.due_date),"home-list-subtitle");
   const meta=element("span",isLate?"Gecikti":"Yaklaşıyor","home-due-badge"+(isLate?" is-late":""));
   const block=element("span",null,"home-list-text");
   block.append(title,text);
   btn.append(block,meta);
   btn.addEventListener("click",()=>goJobs(isLate?"overdue":"soon"));
   list.append(btn);
  }
 }
 async function refresh(){
  const current=++sequence;
  const refreshButton=$("homeRefresh");
  refreshButton.disabled=true;refreshButton.textContent="Yükleniyor…";
  clearError();
  const month=todayISO().slice(0,7);
  const start=month+"-01";
  const date=new Date(),lastDay=new Date(date.getFullYear(),date.getMonth()+1,0);
  const end=[lastDay.getFullYear(),String(lastDay.getMonth()+1).padStart(2,"0"),String(lastDay.getDate()).padStart(2,"0")].join("-");
  const today=todayISO(),weekEnd=afterDaysISO(7);
  const active=["planned","in_progress","ready"];
  const queries=[
   sb.from("quote_requests").select("id",{head:true,count:"exact"}).eq("status","new"),
   sb.from("quote_requests").select("id",{head:true,count:"exact"}).in("status",["new","reviewing"]),
   sb.from("tek_work_orders").select("id",{head:true,count:"exact"}).in("status",active),
   sb.from("tek_work_orders").select("id",{head:true,count:"exact"}).in("status",active).lt("due_date",today),
   sb.from("tek_work_orders").select("id",{head:true,count:"exact"}).in("status",active).gte("due_date",today).lte("due_date",weekEnd),
   sb.from("quote_requests").select("id,customer_name,service,created_at").eq("status","new").order("created_at",{ascending:false}).limit(5),
   sb.from("tek_work_orders").select("id,title,status,due_date,quote:quote_requests(customer_name)").in("status",active).lte("due_date",weekEnd).order("due_date",{ascending:true}).limit(7),
   sb.rpc("tek_finance_summary",{from_date:start,to_date:end})
  ];
  try{
   const [newQuotes,pending,activeJobs,late,soon,quotes,upcoming,finance]=await Promise.all(queries);
   if(current!==sequence)return;
   setMetric(newQuotes,"homeNew");
   setMetric(pending,"homePending");
   setMetric(activeJobs,"homeActive");
   setMetric(late,"homeLate");
   setMetric(soon,"homeSoon");
   renderQuotes(quotes);renderDue(upcoming,today);
   if(!isOk(finance)){
    for(const id of ["homeIncome","homeExpense","homeNet"])unavailable(id);
   }else{
    const data=Array.isArray(finance.data)?finance.data[0]:finance.data;
    display("homeIncome",money.format(Number(data?.income||0)));
    display("homeExpense",money.format(Number(data?.expenses||0)));
    display("homeNet",money.format(Number(data?.net||0)));
    $("homeNet").classList.toggle("negative",Number(data?.net||0)<0);
    $("homeNet").classList.toggle("positive",Number(data?.net||0)>=0);
   }
   if([newQuotes,pending,activeJobs,late,soon,quotes,upcoming,finance].some(r=>!isOk(r))){
    showError("Bazı bilgiler alınamadı. Hesabını veya bağlantını kontrol edip tekrar yenile.");
   }else{
    display("homeUpdated","Son güncelleme: "+new Date().toLocaleTimeString("tr-TR",{hour:"2-digit",minute:"2-digit"}));
   }
  }catch(error){
   if(current===sequence)showError("Özet yüklenemedi. Bağlantını kontrol edip tekrar dene.");
  }finally{
   if(current===sequence){refreshButton.disabled=false;refreshButton.textContent="Yenile ↻"}
  }
 }
 async function activate(){
  for(const [tab,view,mobile] of [["homeTab","homeView","mobileHome"],["quoteTab","quoteView","mobileQuotes"],["workTab","workView","mobileWork"],["financeTab","financeView","mobileFinance"],["accountTab","accountView","mobileAccounts"],["stockTab","stockView","mobileStock"]]){
   const active=tab==="homeTab";
   $(view).classList.toggle("is-hidden",!active);
   $(tab).classList.toggle("active",active);
   $(tab).setAttribute("aria-selected",String(active));
   $(mobile).classList.toggle("active",active);
   if(active)$(mobile).setAttribute("aria-current","page");
   else $(mobile).removeAttribute("aria-current");
  }
  $("refresh").classList.add("is-hidden");
  display("adminPageTitle","İşletme Özeti");
  window.scrollTo({top:0,behavior:"auto"});
  await refresh();
 }
 document.addEventListener("visibilitychange",()=>{
  if(document.visibilityState==="visible"&&!$("dashboard").classList.contains("is-hidden")&&!$("homeView").classList.contains("is-hidden"))
   void refresh();
 });
 $("homeTab").addEventListener("click",()=>void activate());
 $("homeRefresh").addEventListener("click",()=>void refresh());
 $("homeNewCard").addEventListener("click",()=>goQuotes("new"));
 $("homePendingCard").addEventListener("click",()=>goQuotes("pending"));
 $("homeActiveCard").addEventListener("click",()=>goJobs());
 $("homeLateCard").addEventListener("click",()=>goJobs("overdue"));
 $("homeSoonCard").addEventListener("click",()=>goJobs("soon"));
 $("homeAllQuotes").addEventListener("click",()=>goQuotes("new"));
 $("homeAllJobs").addEventListener("click",()=>goJobs());
 $("homeFinanceGo").addEventListener("click",goFinance);
 $("homeAccountsGo").addEventListener("click",()=>openTab("accountTab"));
 return {activate,refresh};
}
