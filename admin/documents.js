// Tekinoğulları price proposal / work form. Client-side document, no quote or ledger mutations.
const money=new Intl.NumberFormat("tr-TR",{style:"currency",currency:"TRY"});
const escapeHtml=value=>String(value??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
const $=id=>document.getElementById(id);
const logo='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 400" role="img" aria-label="Tekinoğulları İmalat TO logosu"><path fill="#222629" d="M40 70h280v72H183v208h-75V142H0z"/><path fill="#ff7200" fill-rule="evenodd" d="M344 70a168 168 0 1 1-99 31h95a100 100 0 1 0 4-1z"/><path fill="#ff7200" d="M340 70h6v73h-6z"/></svg>';
const localDate=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-")};
const printDate=value=>value?value.split("-").reverse().join("."):"";
export function initDocuments(){
 let currentQuote=null;
 function addLine(text="",quantity=1,price=""){
  const row=document.createElement("div");row.className="doc-line";
  row.innerHTML='<input class="doc-item-name" maxlength="180" placeholder="İş kalemi / malzeme" aria-label="İş kalemi" required><input class="doc-item-qty" type="number" min="0.001" step="0.001" max="1000000" inputmode="decimal" aria-label="Miktar" required><input class="doc-item-price" type="number" min="0" step="0.01" max="99999999999" inputmode="decimal" placeholder="Birim ₺" aria-label="Birim fiyat" required><button class="doc-item-remove" type="button" aria-label="Kalemi sil">×</button>';
  row.querySelector(".doc-item-name").value=text;
  row.querySelector(".doc-item-qty").value=quantity;
  row.querySelector(".doc-item-price").value=price;
  row.querySelector(".doc-item-remove").addEventListener("click",()=>{if($("docItems").children.length>1){row.remove();updateTotal()}});
  row.addEventListener("input",updateTotal);
  $("docItems").append(row);
  updateTotal();
 }
 function lines(){
  return [...$("docItems").children].map(row=>({
   text:row.querySelector(".doc-item-name").value.trim(),
   quantity:Number(row.querySelector(".doc-item-qty").value),
   price:Number(row.querySelector(".doc-item-price").value)
  }));
 }
 function updateTotal(){
  const sum=lines().reduce((total,item)=>total+(Number.isFinite(item.quantity)&&Number.isFinite(item.price)?item.quantity*item.price:0),0);
  $("docTotal").textContent=money.format(sum);
 }
 function open(data,kind){
  currentQuote=data.quoteId||null;
  $("docForm").reset();
  $("docError").textContent="";
  $("docKind").value=kind==="work"?"work":"offer";
  $("docDate").value=localDate();
  $("docCustomer").value=data.customer||"";
  $("docPhone").value=data.phone||"";
  $("docService").value=data.service||"";
  $("docNotes").value=(data.notes||"").slice(0,1200);
  $("docTax").value="none";
  $("docItems").replaceChildren();
  addLine(data.title||data.service||"İmalat işi",1,data.price==null?"":Number(data.price));
  $("docOverlay").classList.remove("is-hidden");
  $("docOverlay").scrollTop=0;
  $("docCustomer").focus({preventScroll:true});
 }
 function generate(){
  const type=$("docKind").value,rows=lines();
  if(!rows.length||rows.some(x=>!x.text||!Number.isFinite(x.quantity)||x.quantity<=0||!Number.isFinite(x.price)||x.price<0)){
   throw new Error("İş kalemleri, miktarlar ve birim fiyatları kontrol et.");
  }
  const total=rows.reduce((v,x)=>v+x.quantity*x.price,0);
  if(!Number.isFinite(total)||total>99999999999999)throw new Error("Toplam belge sınırını aşıyor.");
  const title=type==="work"?"İŞ / SİPARİŞ FORMU":"FİYAT TEKLİFİ";
  const id="TKN-"+$("docDate").value.replaceAll("-","")+"-"+Math.floor(Date.now()%1000000).toString().padStart(6,"0");
  const taxLabel={none:"KDV durumu belirtilmemiştir. Vergi dahil/hariç tutar teyit edilmelidir.",included:"Tutarlar KDV dahil olarak beyan edilmiştir. Ayrı KDV hesaplaması yapılmamıştır.",excluded:"Tutarlar KDV hariç olarak beyan edilmiştir. KDV ayrıca hesaplanmalıdır."}[$("docTax").value]||"";
  const trs=rows.map((r,i)=>'<tr><td>'+(i+1)+'</td><td>'+escapeHtml(r.text)+'</td><td>'+escapeHtml(r.quantity.toLocaleString("tr-TR"))+'</td><td>'+escapeHtml(money.format(r.price))+'</td><td>'+escapeHtml(money.format(r.quantity*r.price))+'</td></tr>').join("");
  const notes=$("docNotes").value.trim();
  const documentTitle=title+" • TEKİNOĞULLARI İMALAT";
  return '<!DOCTYPE html><html lang="tr"><head><meta charset="utf-8"><title>'+escapeHtml(documentTitle)+'</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+
    '@page{size:A4;margin:17mm 13mm}*{box-sizing:border-box}body{font-family:Arial,"Noto Sans",sans-serif;color:#212b23;background:white;margin:0;font-size:12px;line-height:1.55}'+
    '.header{display:flex;align-items:center;justify-content:space-between;border-bottom:3px solid #ef7720;padding-bottom:15px;margin-bottom:22px}.brand{display:flex;align-items:center;gap:13px}.brand svg{width:75px;height:65px}.brand h1{font-size:19px;letter-spacing:.02em;margin:0}.brand small{font-size:10px;color:#69746d}.doctype{font-size:16px;color:#a94e20;font-weight:bold;text-align:right}'+
    '.meta{display:grid;grid-template-columns:1fr 1fr;gap:8px 16px;margin-bottom:23px}.meta p{margin:0;border-bottom:1px solid #e4e9e3;padding:7px 0}.meta b{color:#67746c;display:block;font-size:10px}.table{width:100%;border-collapse:collapse;margin-bottom:20px}.table th{text-align:left;background:#263127;color:#fff;padding:10px 8px;font-size:11px}.table td{border-bottom:1px solid #e7ebe6;padding:10px 8px;vertical-align:top}.table td:nth-child(n+3),.table th:nth-child(n+3){text-align:right}.total{border-top:2px solid #ef7720;padding:12px 0;display:flex;justify-content:space-between;font-size:19px;font-weight:bold}.notes{white-space:pre-wrap;background:#f5f7f4;padding:13px;border-radius:6px;margin-top:17px}.fine{font-size:10px;color:#657167;margin-top:13px}.signature{display:flex;justify-content:space-between;gap:30px;margin-top:50px}.signature div{width:46%;border-top:1px solid #9ba99b;padding-top:7px;text-align:center}.footer{font-size:10px;color:#667267;border-top:1px solid #e3e8e2;margin-top:36px;padding-top:12px;text-align:center}tr{page-break-inside:avoid}'+
    '</style></head><body><div class="header"><div class="brand">'+logo+'<div><h1>TEKİNOĞULLARI İMALAT</h1><small>Demir Doğrama • Ferforje • Römork • Kaynak İşleri</small></div></div><div class="doctype">'+escapeHtml(title)+'</div></div>'+
    '<div class="meta"><p><b>Belge No</b>'+escapeHtml(id)+'</p><p><b>Tarih</b>'+escapeHtml(printDate($("docDate").value))+'</p><p><b>Müşteri</b>'+escapeHtml($("docCustomer").value)+'</p><p><b>Telefon</b>'+escapeHtml($("docPhone").value)+'</p><p><b>Hizmet</b>'+escapeHtml($("docService").value)+'</p><p><b>Geçerlilik / Teslim Notu</b>'+escapeHtml($("docTerms").value||"Belirtilmedi")+'</p></div>'+
    '<table class="table"><thead><tr><th>No</th><th>İş / Malzeme Açıklaması</th><th>Miktar</th><th>Birim Fiyat</th><th>Tutar</th></tr></thead><tbody>'+trs+'</tbody></table>'+
    '<div class="total"><span>TOPLAM</span><span>'+escapeHtml(money.format(total))+'</span></div>'+
    '<p class="fine">'+escapeHtml(taxLabel)+'</p>'+(notes?'<div class="notes"><b>İş / Teklif Notları</b><div>'+escapeHtml(notes)+'</div></div>':'')+
    '<div class="signature"><div>Firma / Yetkili</div><div>Müşteri / Onay</div></div><div class="footer">TEKİNOĞULLARI İMALAT • Bu belge mali tahsilat kaydı veya fatura değildir. Firma, vergi ve iletişim bilgileri ayrıca teyit edilmelidir.</div></body></html>';
 }
 $("docAddItem").addEventListener("click",()=>addLine());
 $("docKind").addEventListener("change",updateTotal);
 $("docClose").addEventListener("click",()=>{$("docOverlay").classList.add("is-hidden")});
 $("docForm").addEventListener("submit",event=>{
  event.preventDefault();
  if(!event.currentTarget.reportValidity())return;
  $("docError").textContent="";
  try{
   const html=generate();
   if(window.TekinAndroid&&typeof window.TekinAndroid.printPdf==="function"){
    window.TekinAndroid.printPdf(html);
   }else{
    const popup=window.open("","_blank");
    if(!popup)throw new Error("Belge önizlemesi için açılır pencereye izin ver.");
    popup.document.open();popup.document.write(html);popup.document.close();
    popup.focus();popup.setTimeout(()=>popup.print(),300);
   }
  }catch(error){$("docError").textContent=error.message||"Belge oluşturulamadı"}
 });
 return {
  openForQuote:q=>open({quoteId:q.id,customer:q.customer_name,phone:q.customer_phone,service:q.service,title:q.service,notes:q.details},"offer"),
  openForWork:job=>open({quoteId:job.quote_id,customer:job.quote?.customer_name,phone:job.quote?.customer_phone,service:job.quote?.service,title:job.title,price:job.agreed_price,notes:job.notes},"work")
 };
}
