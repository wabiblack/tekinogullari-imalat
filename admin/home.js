// TEKİNOĞULLARI İMALAT • One-screen, RLS-protected management overview.
// All amounts are read from existing authorized records; never counts work value as income.
const money=new Intl.NumberFormat("tr-TR",{style:"currency",currency:"TRY"});
const $=id=>document.getElementById(id);
const localISO=date=>[date.getFullYear(),String(date.getMonth()+1).padStart(2,"0"),String(date.getDate()).padStart(2,"0")].join("-");
const todayISO=()=>localISO(new Date());
const afterDays=days=>{const d=new Date();d.setDate(d.getDate()+days);return localISO(d)};
const cash=x=>money.format(Number(x));
const valid=r=>r&&!r.error;
export function initHome(sb){
 let generation=0;
 const label=(id,value)=>{$(id).textContent=String(value)};
 const goTab=id=>{$(id).click();window.scrollTo({top:0,behavior:"auto"})};
 const goQuotes=()=>{
  // The unified İşler feed begins with new/unconverted offers.
  // No second quote list or duplicate entry form for everyday navigation.
  $("workFilter").value="";
  $("workSearch").value="";
  goTab("workTab");
  $("workFilter").dispatchEvent(new Event("change",{bubbles:true}));
 };
 const goJobs=filter=>{
  $("workFilter").value=filter;
  $("workSearch").value="";
  goTab("workTab");
  $("workFilter").dispatchEvent(new Event("change",{bubbles:true}));
 };
 const setCount=(response,id)=>label(id,valid(response)?Number(response.count||0).toLocaleString("tr-TR"):"—");
 async function refresh(){
  const serial=++generation;
  const refreshButton=$("homeRefresh");
  refreshButton.disabled=true;
  $("homeError").classList.add("is-hidden");
  const today=new Date();
  const monthStart=new Date(today.getFullYear(),today.getMonth(),1);
  const monthEnd=new Date(today.getFullYear(),today.getMonth()+1,0);
  label("homeMonth",today.toLocaleDateString("tr-TR",{month:"long",year:"numeric"}));
  const active=["planned","in_progress","ready"];
  const todayDate=todayISO();
  const requests=[
   sb.from("quote_requests").select("id",{head:true,count:"exact"}).eq("status","new"),
   sb.from("tek_work_orders").select("id",{head:true,count:"exact"}).in("status",active),
   sb.from("tek_work_orders").select("id",{head:true,count:"exact"}).in("status",active).lt("due_date",todayDate),
   sb.from("tek_work_orders").select("id",{head:true,count:"exact"}).in("status",active).gte("due_date",todayDate).lte("due_date",afterDays(7)),
   sb.rpc("tek_home_receivables_summary"),
   sb.rpc("tek_finance_summary",{from_date:localISO(monthStart),to_date:localISO(monthEnd)})
  ];
  try{
   const [quotes,jobs,late,upcoming,receivables,finance]=await Promise.all(requests);
   if(serial!==generation)return;
   setCount(quotes,"homeNew");
   setCount(jobs,"homeActive");
   if(valid(late)&&valid(upcoming)){
    const overdue=Number(late.count||0),soon=Number(upcoming.count||0);
    label("homeDeliveryCount",(overdue+soon).toLocaleString("tr-TR"));
    label("homeDeliveryHint",overdue?"Geciken: "+overdue+" · Yaklaşan: "+soon:"7 gün içindeki teslimler ›");
   }else{
    label("homeDeliveryCount","—");
    label("homeDeliveryHint","Yaklaşan ve geciken ›");
   }
   if(valid(receivables)&&receivables.data!==null&&
      Number.isFinite(Number(receivables.data))){
    label("homeReceivables",cash(receivables.data));
   }else label("homeReceivables","—");
   if(valid(finance)){
    const f=Array.isArray(finance.data)?finance.data[0]:finance.data;
    const income=Number(f?.income??0),expense=Number(f?.expenses??0),net=Number(f?.net??0);
    label("homeIncome",cash(income));
    label("homeExpense",cash(expense));
    label("homeNet",cash(net));
    $("homeNet").classList.toggle("negative",net<0);
    $("homeNet").classList.toggle("positive",net>=0);
   }else for(const id of ["homeIncome","homeExpense","homeNet"])label(id,"—");
   if([quotes,jobs,late,upcoming,receivables,finance].some(r=>!valid(r))){
    $("homeError").textContent="Bazı bilgiler yüklenemedi. Bağlantı sağlanınca otomatik yenilenecek.";
    $("homeError").classList.remove("is-hidden");
   }
   label("homeUpdated",new Date().toLocaleTimeString("tr-TR",{hour:"2-digit",minute:"2-digit"})+" güncellendi");
  }catch(error){
   if(serial===generation){
    $("homeError").textContent="Bağlantı kurulamadı. Sistem otomatik tekrar deneyecek.";
    $("homeError").classList.remove("is-hidden");
   }
  }finally{if(serial===generation)refreshButton.disabled=false}
 }
 async function activate(){
  for(const [tab,view,mobile] of [
   ["homeTab","homeView","mobileHome"],
   ["quoteTab","quoteView","mobileQuotes"],
   ["workTab","workView","mobileWork"],
   ["accountTab","accountView","mobileAccounts"],
   ["financeTab","financeView","mobileFinance"],
   ["stockTab","stockView","mobileStock"]
  ]){
   const selected=tab==="homeTab";
   $(view).classList.toggle("is-hidden",!selected);
   $(tab).classList.toggle("active",selected);
   $(tab).setAttribute("aria-selected",String(selected));
   $(mobile).classList.toggle("active",selected);
   if(selected)$(mobile).setAttribute("aria-current","page");
   else $(mobile).removeAttribute("aria-current");
  }
  label("adminPageTitle","Günün Özeti");
  window.scrollTo({top:0,behavior:"auto"});
  await refresh();
 }
 $("homeTab").addEventListener("click",()=>void activate());
 $("homeRefresh").addEventListener("click",()=>void refresh());
 $("homeNewCard").addEventListener("click",()=>goQuotes("new"));
 $("homeActiveCard").addEventListener("click",()=>goJobs(""));
 $("homeDeliveryCard").addEventListener("click",()=>goJobs("priority"));
 $("homeReceivableCard").addEventListener("click",()=>goTab("accountTab"));
 return {activate,refresh};
}
