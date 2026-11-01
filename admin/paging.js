// TEKİNOĞULLARI: compact mobile list pagination, no endless list scrolling.
// This is presentation-only; source items, admin permissions and Supabase records stay untouched.
export function initCompactPaging(){
 const configs=[
  // Main İşler and Kasa feeds scroll naturally; keep paging only for secondary tools.
  ["accountList",3],["stockList",2],["stockHistory",3]
 ];
 const compact=()=>window.matchMedia("(max-width:800px)").matches;
 for(const [id,maxPerPage] of configs){
  const list=document.getElementById(id);
  if(!list)continue;
  const pager=document.createElement("nav");pager.className="tek-pager";pager.setAttribute("aria-label","Liste sayfaları");
  const prev=document.createElement("button");prev.type="button";prev.className="tek-page-btn";prev.textContent="‹ Önceki";
  const counter=document.createElement("span");counter.className="tek-page-count";counter.setAttribute("aria-live","polite");
  const next=document.createElement("button");next.type="button";next.className="tek-page-btn";next.textContent="Sonraki ›";
  pager.append(prev,counter,next);list.after(pager);
  let page=0,lastCount=0;
  const perPage=()=>window.innerHeight<660?2:maxPerPage;
  const render=(reset=false)=>{
   const children=Array.from(list.children);
   const count=children.length;
   if(reset||count!==lastCount)page=0;
   lastCount=count;
   const enabled=compact()&&count>perPage();
   pager.hidden=!enabled;
   if(!compact()){
    for(const child of children)child.hidden=false;
    return;
   }
   const size=perPage(),pages=Math.max(1,Math.ceil(count/size));
   page=Math.max(0,Math.min(page,pages-1));
   for(let i=0;i<count;i++)children[i].hidden=i<page*size||i>=(page+1)*size;
   counter.textContent=(page+1)+" / "+pages;
   prev.disabled=page===0;next.disabled=page>=pages-1;
  };
  prev.addEventListener("click",()=>{page--;render()});
  next.addEventListener("click",()=>{page++;render()});
  const observer=new MutationObserver(()=>render(true));
  observer.observe(list,{childList:true});
  window.addEventListener("resize",()=>render());
  render();
 }
}
