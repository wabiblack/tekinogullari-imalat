// TEKİNOĞULLARI: Native-select replacement with accessible in-flow choices.
// Existing selects remain the authoritative form value, so current data logic is unchanged.
export function initInlineSelects(){
 const $=id=>document.getElementById(id);
 const allowed=new Set([
  "filter","ratingFilter","workFilter","accountFilter","stockFilter",
  "finPeriod","finKind","finCategory","finQuote",
  "workQuote","workStatus","stockUnit","stockMaterial","stockType","stockJob",
  "docKind","docTax"
 ]);
 const wrappers=[];
 function closeAll(except=null){
  for(const picker of wrappers)if(picker!==except)picker.close();
 }
 function enhance(select){
  if(!select||select.dataset.tekPicker||!(allowed.has(select.id)||select.matches("#detail .select-status")))return;
  select.dataset.tekPicker="true";
  const container=document.createElement("div");
  container.className="tek-inline-select";
  const trigger=document.createElement("button");
  trigger.type="button";trigger.className="tek-inline-trigger";
  trigger.setAttribute("aria-haspopup","listbox");
  trigger.setAttribute("aria-expanded","false");
  trigger.setAttribute("aria-label",select.getAttribute("aria-label")||select.closest("label")?.textContent?.trim().slice(0,85)||"Seçenekleri göster");
  const label=document.createElement("span");label.className="tek-inline-label";
  const arrow=document.createElement("span");arrow.className="tek-inline-chevron";arrow.setAttribute("aria-hidden","true");arrow.textContent="⌄";
  trigger.append(label,arrow);
  const choices=document.createElement("div");choices.className="tek-inline-choices";
  choices.id="tek-choices-"+select.id;
  choices.setAttribute("role","listbox");choices.hidden=true;
  trigger.setAttribute("aria-controls",choices.id);
  container.append(trigger,choices);
  select.classList.add("tek-native-select");
  select.after(container);
  let opened=false,itemsSignature="";
  function sync(){
   const selected=select.selectedOptions?.[0];
   label.textContent=selected?.textContent||"Seçim yap";
   trigger.disabled=select.disabled;
   if(opened)buildOptions();
  }
  function buildOptions(){
   const signature=[...select.options].map(o=>o.value+"|"+o.textContent+"|"+o.disabled).join("\n");
   if(signature===itemsSignature&&choices.childElementCount)return;
   itemsSignature=signature;
   choices.replaceChildren();
   for(const o of select.options){
    const item=document.createElement("button");
    item.type="button";item.setAttribute("role","option");
    item.className="tek-inline-option";
    item.textContent=o.textContent;
    item.dataset.value=o.value;
    item.disabled=o.disabled;
    item.setAttribute("aria-selected",String(select.value===o.value));
    item.addEventListener("click",()=>{
     select.value=o.value;
     select.dispatchEvent(new Event("change",{bubbles:true}));
     sync();close();trigger.focus({preventScroll:true});
    });
    choices.append(item);
   }
  }
  function open(){
   if(select.disabled)return;
   closeAll(picker);
   opened=true;
   itemsSignature="";
   buildOptions();
   trigger.setAttribute("aria-expanded","true");
   choices.hidden=false;
   container.classList.add("is-open");
   const selected=choices.querySelector('[aria-selected="true"]');
   if(selected)selected.scrollIntoView({block:"nearest",inline:"nearest"});
  }
  function close(){
   opened=false;choices.hidden=true;
   trigger.setAttribute("aria-expanded","false");
   container.classList.remove("is-open");
  }
  const picker={close};wrappers.push(picker);
  trigger.addEventListener("click",()=>opened?close():open());
  trigger.addEventListener("keydown",event=>{
   if(event.key==="Escape"){close();event.preventDefault();}
   if(event.key==="ArrowDown"&&!opened){open();event.preventDefault();}
  });
  choices.addEventListener("keydown",event=>{if(event.key==="Escape"){close();trigger.focus();event.preventDefault();}});
  select.addEventListener("change",sync);
  select.addEventListener("invalid",()=>{open();trigger.focus({preventScroll:true})});
  const observer=new MutationObserver(()=>{itemsSignature="";sync()});
  observer.observe(select,{childList:true,subtree:true});
  sync();
 }
 for(const select of document.querySelectorAll("select"))enhance(select);
 const quoteDetail=document.getElementById("detail");
 if(quoteDetail){
  new MutationObserver(()=>{
   for(const control of quoteDetail.querySelectorAll("select.select-status"))enhance(control);
  }).observe(quoteDetail,{childList:true,subtree:true});
 }

 document.addEventListener("pointerdown",event=>{
  if(!event.target.closest(".tek-inline-select"))closeAll();
 },{passive:true});
 for(const tab of document.querySelectorAll(".admin-tab,.mobile-bottom-item")){
  tab.addEventListener("click",()=>{closeAll();queueMicrotask(()=>{for(const select of document.querySelectorAll("select.tek-native-select"))select.dispatchEvent(new Event("tek-select-sync"));})});
 }
 for(const select of document.querySelectorAll("select.tek-native-select")){
  select.addEventListener("tek-select-sync",()=>{
   const wrapper=select.nextElementSibling;
   const label=wrapper?.querySelector(".tek-inline-label");
   if(label)label.textContent=select.selectedOptions?.[0]?.textContent||"Seçim yap";
  });
 }
}
