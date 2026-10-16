
const $=id=>document.getElementById(id);
const make=(tag,value,cls)=>{const x=document.createElement(tag);if(value!==undefined&&value!==null)x.textContent=String(value);if(cls)x.className=cls;return x};
const units=["adet","kg","metre","m²","litre","paket","ton"];
const cash=new Intl.NumberFormat("tr-TR",{style:"currency",currency:"TRY"});
export function initStock(sb){
 let materials=[],jobs=[],movements=[],selectedMaterial=null,version=0;
 function notice(msg,bad=false){const n=$("stockNotice");n.textContent=msg;n.className="stock-notice"+(bad?" bad":"")+(msg?"":" is-hidden")}
 function options(select,records,label,value){
  select.replaceChildren();let empty=make("option",label);empty.value="";select.append(empty);
  for(const rec of records){const option=make("option",rec.name);option.value=rec.id;select.append(option)}
  if(value&&records.some(x=>x.id===value))select.value=value;
 }
 function render(){
  const sum=materials.reduce((t,m)=>t+Number(m.quantity)*Number(m.unit_cost),0);
  $("stockTotal").textContent=materials.length;
  $("stockLow").textContent=materials.filter(x=>Number(x.quantity)<=Number(x.min_quantity)).length;
  $("stockValue").textContent=cash.format(sum);
  const search=$("stockSearch").value.toLocaleLowerCase("tr-TR").trim();
  const filter=$("stockFilter").value;
  const list=$("stockList");list.replaceChildren();
  let filtered=materials.filter(x=>(!search||x.name.toLocaleLowerCase("tr-TR").includes(search))&&(filter!=="low"||Number(x.quantity)<=Number(x.min_quantity)));
  filtered.sort((a,b)=>{
   const aLow=Number(a.quantity)<=Number(a.min_quantity),bLow=Number(b.quantity)<=Number(b.min_quantity);
   return Number(bLow)-Number(aLow)||a.name.localeCompare(b.name,"tr");
  });
  if(!filtered.length)list.append(make("p","Bu koşullara uyan malzeme bulunamadı.","stock-empty"));
  for(const material of filtered){
   const card=make("div",null,"stock-item");
   const top=make("div",null,"stock-item-head");
   top.append(make("strong",material.name),make("span",Number(material.quantity)<=Number(material.min_quantity)?"Az Stok":"Stokta",Number(material.quantity)<=Number(material.min_quantity)?"stock-pill danger":"stock-pill"));
   const details=make("div",null,"stock-item-line");
   details.append(make("span",Number(material.quantity).toLocaleString("tr-TR")+" "+material.unit),make("span",cash.format(material.unit_cost)+" / "+material.unit));
   const actions=make("div",null,"stock-item-actions");
   const add=make("button","+ Giriş","stock-action");
   add.type="button";add.addEventListener("click",()=>openMovement(material,"in"));
   const use=make("button","− Çıkış","stock-action");
   use.type="button";use.disabled=Number(material.quantity)<=0;use.addEventListener("click",()=>openMovement(material,"out"));
   const edit=make("button","Düzenle","stock-action subdued");
   edit.type="button";edit.addEventListener("click",()=>openEditor(material));
   actions.append(add,use,edit);card.append(top,details,actions);list.append(card);
  }
  const history=$("stockHistory");history.replaceChildren();
  if(!movements.length)history.append(make("p","Henüz stok hareketi yok.","stock-empty"));
  for(const move of movements){
   const row=make("div",null,"stock-history-line");
   const label=make("div",null,"stock-history-name");
   label.append(make("strong",move.material?.name||"Malzeme"),make("small",new Date(move.created_at).toLocaleString("tr-TR")+(move.work_order?.title?" • "+move.work_order.title:"")+(move.memo?" • "+move.memo:"")));
   row.append(label,make("b",(move.movement_type==="in"?"+":"−")+Number(move.quantity).toLocaleString("tr-TR")+" "+(move.material?.unit||""),move.movement_type==="in"?"stock-positive":"stock-negative"));
   history.append(row);
  }
 }
 async function load(){
  const ticket=++version;
  const [a,b,c]=await Promise.all([
   sb.from("tek_materials").select("id,name,unit,quantity,min_quantity,unit_cost,created_at").order("name",{ascending:true}).limit(1000),
   sb.from("tek_work_orders").select("id,title,status,quote:quote_requests(customer_name)").in("status",["planned","in_progress","ready"]).order("created_at",{ascending:false}).limit(500),
   sb.from("tek_material_movements").select("id,movement_type,quantity,memo,created_at,material:tek_materials(name,unit),work_order:tek_work_orders(title)").order("created_at",{ascending:false}).limit(30)
  ]);
  if(ticket!==version)return;
  if(a.error||b.error||c.error){notice("Stok verileri alınamadı. Yetkili girişini veya bağlantını kontrol et.",true);return}
  materials=a.data||[];jobs=(b.data||[]).map(j=>({...j,name:(j.quote?.customer_name||"Müşteri")+" • "+j.title}));movements=c.data||[];
  options($("stockMaterial"),materials,"Malzeme seç",$("stockMaterial").value);
  options($("stockJob"),jobs,"Atölye / işe bağlama",null);
  $("stockJob").options[0].textContent="Atölye tüketimi (işe bağlı değil)";
  render();
 }
 function openEditor(material){
  const form=$("stockEditor");selectedMaterial=material?.id||null;
  $("stockEditorTitle").textContent=material?"Malzemeyi Düzenle":"Yeni Malzeme";
  $("stockName").value=material?.name||"";
  $("stockUnit").value=material?.unit||"adet";
  $("stockMin").value=material?.min_quantity??0;
  $("stockCost").value=material?.unit_cost??0;
  form.classList.remove("is-hidden");
  form.scrollIntoView({behavior:"smooth",block:"start"});
 }
 function openMovement(material,type){
  $("stockMaterial").value=material?.id||"";
  $("stockType").value=type;
  $("stockQty").value="";
  $("stockMemo").value="";
  $("stockJob").value="";
  $("stockMovementForm").classList.remove("is-hidden");
  $("stockMovementForm").scrollIntoView({behavior:"smooth",block:"start"});
 }
 $("stockNew").addEventListener("click",()=>openEditor(null));
 $("stockEditorCancel").addEventListener("click",()=>{$("stockEditor").classList.add("is-hidden")});
 $("stockMovementNew").addEventListener("click",()=>openMovement(null,"in"));
 $("stockMoveCancel").addEventListener("click",()=>{$("stockMovementForm").classList.add("is-hidden")});
 $("stockType").addEventListener("change",()=>{
   if($("stockType").value==="in")$("stockJob").value="";
   $("stockJob").disabled=$("stockType").value==="in";
 });
 $("stockEditorForm").addEventListener("submit",async event=>{
  event.preventDefault();
  if(!event.currentTarget.reportValidity())return;
  const payload={name:$("stockName").value.trim(),unit:$("stockUnit").value,
   min_quantity:Number($("stockMin").value),unit_cost:Number($("stockCost").value)};
  if(payload.name.length<2||!units.includes(payload.unit)||!Number.isFinite(payload.min_quantity)||payload.min_quantity<0||!Number.isFinite(payload.unit_cost)||payload.unit_cost<0)return notice("Malzeme alanlarını kontrol et.",true);
  const button=$("stockSave");button.disabled=true;
  const result=selectedMaterial?
   await sb.from("tek_materials").update(payload).eq("id",selectedMaterial).select("id").single():
   await sb.from("tek_materials").insert(payload).select("id").single();
  button.disabled=false;
  if(result.error)return notice("Malzeme kaydedilemedi. Yetki ve alanları kontrol et.",true);
  $("stockEditor").classList.add("is-hidden");notice("Malzeme kaydedildi.");await load();
 });
 $("stockMoveForm").addEventListener("submit",async event=>{
  event.preventDefault();if(!event.currentTarget.reportValidity())return;
  const type=$("stockType").value,quantity=Number($("stockQty").value);
  const material_id=$("stockMaterial").value,job=$("stockJob").value||null;
  if(!material_id||!["in","out"].includes(type)||!Number.isFinite(quantity)||quantity<=0)return notice("Geçerli bir malzeme ve miktar seç.",true);
  const button=$("stockMoveSave");button.disabled=true;
  const result=await sb.from("tek_material_movements").insert({
   material_id,movement_type:type,quantity,work_order_id:type==="out"?job:null,memo:$("stockMemo").value.trim().slice(0,350)
  }).select("id").single();
  button.disabled=false;
  if(result.error)return notice(result.error.code==="23514"?"Yetersiz stok. Çıkış miktarını düşür.":"Stok hareketi kaydedilemedi. Bilgileri kontrol et.",true);
  $("stockMovementForm").classList.add("is-hidden");notice("Stok hareketi kaydedildi. İşe bağlı çıkış varsa tahmini kâra yansıyacak.");await load();
 });
 $("stockFilter").addEventListener("change",render);
 $("stockSearch").addEventListener("input",render);
 $("stockRefresh").addEventListener("click",()=>void load());
 $("stockTab").addEventListener("click",()=>void activate());
 async function activate(){
  for(const [tab,view,mobile] of [
   ["homeTab","homeView","mobileHome"],["quoteTab","quoteView","mobileQuotes"],
   ["workTab","workView","mobileWork"],["accountTab","accountView","mobileAccounts"],
   ["financeTab","financeView","mobileFinance"],["stockTab","stockView","mobileStock"]
  ]){
   const active=tab==="stockTab";
   $(view).classList.toggle("is-hidden",!active);
   $(tab).classList.toggle("active",active);
   $(tab).setAttribute("aria-selected",String(active));
   $(mobile).classList.toggle("active",active);
   if(active)$(mobile).setAttribute("aria-current","page");else $(mobile).removeAttribute("aria-current");
  }
  $("adminPageTitle").textContent="Stok ve Malzeme";
  $("refresh").classList.remove("is-hidden");
  await load();
 }
 return {activate,refresh:load};
}
