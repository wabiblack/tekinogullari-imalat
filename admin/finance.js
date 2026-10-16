const financeCategories={
 income:["İş Tahsilatı","Kapora / Avans","Ürün Satışı","Hizmet Geliri","Diğer Gelir"],
 expense:["Demir / Profil / Sac","Boya / Kaynak Sarfı","Hidrolik / Yedek Parça","İşçilik / Maaş","Elektrik / Su","Kira","Nakliye / Yakıt","Vergi / Harç","Bakım / Onarım","Diğer Gider"]
};
const finMoney=new Intl.NumberFormat("tr-TR",{style:"currency",currency:"TRY"});
function finLocalDate(date=new Date()){return [date.getFullYear(),String(date.getMonth()+1).padStart(2,"0"),String(date.getDate()).padStart(2,"0")].join("-")}
function finPeriodDates(value){
 const now=new Date(),y=now.getFullYear(),m=now.getMonth();
 if(value==="month")return {start:finLocalDate(new Date(y,m,1)),end:finLocalDate(new Date(y,m+1,0))};
 if(value==="lastmonth")return {start:finLocalDate(new Date(y,m-1,1)),end:finLocalDate(new Date(y,m,0))};
 if(value==="year")return {start:y+"-01-01",end:y+"-12-31"};
 return {start:null,end:null};
}
export function initFinance(sb){
 const $=id=>document.getElementById(id),date=finLocalDate;
 let entries=[],editing=null,quotes=new Map(),loadSerial=0;
 const make=(tag,value,cls)=>{const n=document.createElement(tag);if(value!=null)n.textContent=String(value);if(cls)n.className=cls;return n};
 const message=(text,isError=false)=>{const e=$("finFeedback");e.textContent=text;e.className="fin-feedback "+(text?(isError?"error":"success"):"")};
 function categories(selected){
  const target=$("finCategory");target.replaceChildren();
  for(const cat of financeCategories[$("finKind").value]){const o=make("option",cat);o.value=cat;target.append(o)}
  if(selected&&[...target.options].some(o=>o.value===selected))target.value=selected;
 }
 function resetForm(){
  editing=null;$("finForm").reset();$("finKind").value="income";categories();$("finDate").value=date();
  $("finFormTitle").textContent="Yeni Mali Kayıt";$("finSave").textContent="Kaydı Ekle";$("finCancel").classList.add("is-hidden");
 }
 function quoteOptions(){
  const sel=$("finQuote"),prior=sel.value;sel.replaceChildren();
  const blank=make("option","Bağımsız işletme kaydı");blank.value="";sel.append(blank);
  for(const [id,q] of quotes){
   const option=make("option",q.customer_name+" · "+q.service+" · "+new Date(q.created_at).toLocaleDateString("tr-TR"));
   option.value=id;sel.append(option);
  }
  if(prior&&quotes.has(prior))sel.value=prior;
 }
 async function loadQuoteOptions(){
  const {data,error}=await sb.from("quote_requests").select("id,customer_name,service,created_at").order("created_at",{ascending:false}).limit(300);
  if(error)return;
  quotes=new Map((data||[]).map(q=>[q.id,q]));quoteOptions();
 }
 function bounds(){
  if($("finPeriod").value!=="custom")return finPeriodDates($("finPeriod").value);
  return {start:$("finStart").value||null,end:$("finEnd").value||null};
 }
 function renderList(){
  const list=$("finList");list.replaceChildren();
  if(!entries.length){list.append(make("p","Seçilen dönemde henüz gelir veya gider kaydı bulunmuyor.","empty"));return}
  for(const item of entries){
   const row=make("div",null,"fin-record"),top=make("div",null,"fin-record-top");
   const left=make("div"),title=make("div",item.description,"fin-record-name");
   const linked=item.quote_id&&quotes.get(item.quote_id);
   const metadata=[item.entry_date.split("-").reverse().join("."),item.category,linked?linked.customer_name+" / "+linked.service:(item.quote_id?"İşe bağlı kayıt":null)].filter(Boolean).join(" · ");
   left.append(title,make("div",metadata,"fin-record-meta"));
   const money=make("div",(item.kind==="income"?"+":"−")+finMoney.format(Number(item.amount)),"fin-record-price "+item.kind);
   top.append(left,money);
   const actions=make("div",null,"fin-record-actions");
   const edit=make("button","Düzenle");edit.type="button";edit.addEventListener("click",()=>editEntry(item));
   const del=make("button","Sil","danger");del.type="button";del.addEventListener("click",()=>void deleteEntry(item));
   actions.append(edit,del);row.append(top,actions);list.append(row);
  }
 }
 async function load(){
  const seq=++loadSerial,{start,end}=bounds();
  if(start&&end&&start>end){message("Başlangıç tarihi bitişten sonra olamaz.",true);return}
  $("finList").replaceChildren(make("p","Kayıtlar yükleniyor…","empty"));
  let query=sb.from("finance_transactions").select("id,entry_date,kind,category,description,amount,quote_id,created_at").order("entry_date",{ascending:false}).order("created_at",{ascending:false}).limit(300);
  if(start)query=query.gte("entry_date",start);
  if(end)query=query.lte("entry_date",end);
  const [summary,result]=await Promise.all([sb.rpc("tek_finance_summary",{from_date:start,to_date:end}),query]);
  if(seq!==loadSerial)return;
  if(summary.error||result.error){
   $("finList").replaceChildren(make("p","Mali kayıtlar yüklenemedi. Oturumunuzu kontrol edip Yenile'ye basın.","error"));
   return;
  }
  const totals=Array.isArray(summary.data)?summary.data[0]:summary.data;
  const income=Number(totals?.income||0),expense=Number(totals?.expenses||0),net=Number(totals?.net||0);
  $("finIncome").textContent=finMoney.format(income);
  $("finExpense").textContent=finMoney.format(expense);
  $("finNet").textContent=finMoney.format(net);
  $("finCount").textContent=new Intl.NumberFormat("tr-TR").format(Number(totals?.entry_count||0));
  $("finListLabel").textContent="Bu dönemde "+Number(totals?.entry_count||0)+" kayıt";
  $("finNet").parentElement.classList.toggle("negative",net<0);
  $("finNet").parentElement.classList.toggle("positive",net>=0);
  entries=result.data||[];
  renderList();
 }
 function editEntry(item){
  editing=item.id;message("");
  $("finKind").value=item.kind;categories(item.category);
  $("finDate").value=item.entry_date;$("finAmount").value=item.amount;
  $("finDescription").value=item.description;$("finQuote").value=item.quote_id||"";
  $("finFormTitle").textContent="Mali Kaydı Düzenle";$("finSave").textContent="Değişiklikleri Kaydet";
  $("finCancel").classList.remove("is-hidden");
  $("finForm").scrollIntoView({behavior:"smooth",block:"start"});
 }
 async function deleteEntry(item){
  if(!window.confirm("Bu gelir/gider kaydını kalıcı olarak silmek istediğine emin misin?"))return;
  message("");
  const {data,error}=await sb.from("finance_transactions").delete().eq("id",item.id).select("id").single();
  if(error||!data){message("Kayıt silinemedi. Tekrar deneyin.",true);return}
  if(editing===item.id)resetForm();
  message("Kayıt silindi.");await load();
 }
 $("finKind").addEventListener("change",()=>categories());
 $("finCancel").addEventListener("click",()=>{resetForm();message("")});
 $("finForm").addEventListener("submit",async event=>{
  event.preventDefault();
  const form=$("finForm");if(!form.reportValidity())return;
  const amount=Number($("finAmount").value);
  if(!Number.isFinite(amount)||amount<=0||amount>999999999999.99){message("Geçerli ve sıfırdan büyük bir tutar gir.",true);return}
  const category=$("finCategory").value,kind=$("finKind").value;
  if(!financeCategories[kind]?.includes(category)){message("Geçerli bir kategori seç.",true);return}
  const description=$("finDescription").value.trim();
  if(description.length<2||description.length>400){message("Açıklama 2–400 karakter olmalı.",true);return}
  const payload={entry_date:$("finDate").value,kind,category,description,amount:Number(amount.toFixed(2)),quote_id:$("finQuote").value||null,updated_at:new Date().toISOString()};
  const btn=$("finSave");btn.disabled=true;btn.textContent="Kaydediliyor…";message("");
  try{
   const response=editing?
    await sb.from("finance_transactions").update(payload).eq("id",editing).select("id").single():
    await sb.from("finance_transactions").insert(payload).select("id").single();
   if(response.error||!response.data)throw response.error||new Error("İşlem kaydedilemedi.");
   resetForm();message("Mali kayıt başarıyla kaydedildi.");await load();
  }catch(e){message("Kayıt kaydedilemedi: "+(e?.message||"Lütfen yeniden deneyin."),true)}
  finally{btn.disabled=false;btn.textContent=editing?"Değişiklikleri Kaydet":"Kaydı Ekle"}
 });
 const activate=finance=>{
  $("quoteTab").classList.toggle("active",!finance);
  $("financeTab").classList.toggle("active",finance);
  $("quoteTab").setAttribute("aria-selected",String(!finance));
  $("financeTab").setAttribute("aria-selected",String(finance));
  $("quoteView").classList.toggle("is-hidden",finance);
  $("financeView").classList.toggle("is-hidden",!finance);
  $("workView").classList.add("is-hidden");
  $("accountView").classList.add("is-hidden");
  $("stockView").classList.add("is-hidden");
  $("stockTab").classList.remove("active");$("stockTab").setAttribute("aria-selected","false");
  $("mobileStock").classList.remove("active");$("mobileStock").removeAttribute("aria-current");
  $("accountTab").classList.remove("active");
  $("accountTab").setAttribute("aria-selected","false");
  $("mobileAccounts").classList.remove("active");
  $("mobileAccounts").removeAttribute("aria-current");
  $("homeView").classList.add("is-hidden");
  $("refresh").classList.remove("is-hidden");
  $("homeTab").classList.remove("active");
  $("homeTab").setAttribute("aria-selected","false");
  $("mobileHome").classList.remove("active");
  $("mobileHome").removeAttribute("aria-current");
  $("workTab").classList.remove("active");
  $("workTab").setAttribute("aria-selected","false");
  $("mobileWork").classList.remove("active");
  $("mobileWork").removeAttribute("aria-current");
  $("mobileQuotes").classList.toggle("active",!finance);
  $("mobileFinance").classList.toggle("active",finance);
  if(finance){
   $("mobileFinance").setAttribute("aria-current","page");
   $("mobileQuotes").removeAttribute("aria-current");
  }else{
   $("mobileQuotes").setAttribute("aria-current","page");
   $("mobileFinance").removeAttribute("aria-current");
  }
  $("adminPageTitle").textContent=finance?"Mali Yönetim":"Teklif Talepleri";
 };
 $("quoteTab").addEventListener("click",()=>activate(false));
 let quotesFetched=false;
 $("financeTab").addEventListener("click",async()=>{
  activate(true);
  if(!quotesFetched){quotesFetched=true;await loadQuoteOptions()}
  await load();
 });
 $("finRefresh").addEventListener("click",async()=>{await loadQuoteOptions();await load()});
 $("finPeriod").addEventListener("change",()=>{
  const custom=$("finPeriod").value==="custom";
  $("finDates").classList.toggle("is-hidden",!custom);
  if(!custom)void load();
 });
 $("finApply").addEventListener("click",()=>void load());
 $("finStart").value=finPeriodDates("month").start;
 $("finEnd").value=date();
 async function startForQuote(quoteId){
  activate(true);
  quotesFetched=true;
  await Promise.all([loadQuoteOptions(),load()]);
  resetForm();
  $("finKind").value="income";
  categories("İş Tahsilatı");
  $("finDescription").value="İş tahsilatı";
  const {data,error}=await sb.from("quote_requests")
   .select("id,customer_name,service,created_at").eq("id",quoteId).single();
  if(error||!data){
   message("İlgili müşteri teklifi bulunamadı. Kayıt oluşturulmadı.",true);
   return;
  }
  if(![...$("finQuote").options].some(option=>option.value===quoteId)){
   const option=make("option",data.customer_name+" · "+data.service);
   option.value=quoteId;$("finQuote").append(option);
  }
  $("finQuote").value=quoteId;
  message("Bu ödeme müşterinin hesabına işlenecek. Tutarı girip Kaydı Ekle'ye bas.");
  $("finForm").scrollIntoView({behavior:"smooth",block:"start"});
  $("finAmount").focus({preventScroll:true});
 }
 resetForm();
 return {startForQuote};
}
