(() => {
  "use strict";
  const $ = (s,root=document)=>root.querySelector(s);
  const $$=(s,root=document)=>Array.from(root.querySelectorAll(s));
  const modal=$("#orderModal"),form=$("#orderForm"),track=$("#trackForm");
  const labels={"sampul-raya":"Sampul Duit Raya",stickers:"Sticker & Label","photo-4r":"4R Photo Printing",polaroid:"Polaroid & Mini Prints",cards:"Custom Cards",bulk:"Bulk / Corporate"};
  const currency=sen=>new Intl.NumberFormat("ms-MY",{style:"currency",currency:"MYR"}).format(sen/100);
  const notify=message=>{const toast=$("#toast");toast.textContent=message;toast.classList.add("show");setTimeout(()=>toast.classList.remove("show"),4500);};
  const getField=id=>$("#"+id)?.value;
  let priceRows={};
  let currentStep=1;
  let busy=false;
  const savedOrders=()=>{try{return JSON.parse(localStorage.getItem("am_v2_order_tokens")||"{}");}catch{return {};}};
  const referral=()=>{
    try{const row=JSON.parse(localStorage.getItem("am_v2_ref")||"null");return row&&row.expires>Date.now()?row.code:"";}catch{return "";}
  };
  const incoming=new URL(location.href).searchParams.get("ref");
  if(incoming&&/^[a-z0-9-]{3,30}$/i.test(incoming)){
    localStorage.setItem("am_v2_ref",JSON.stringify({code:incoming.toUpperCase(),expires:Date.now()+30*86400000}));
  }
  async function api(path,options={}){
    const response=await fetch(path,{...options,headers:{"Accept":"application/json",...(options.headers||{})}});
    let data;
    try{data=await response.json();}catch{data={};}
    if(!response.ok)throw new Error(data.error||"Sistem tidak tersedia sekarang.");
    return data;
  }
  async function getProducts(){
    try{
      const result=await api("/api/products");
      priceRows=Object.fromEntries(result.products.map(p=>[p.code,p]));
      const select=$("#orderProduct");
      select.querySelectorAll("option").forEach(opt=>{if(!priceRows[opt.value])opt.disabled=true;else opt.textContent=priceRows[opt.value].name;});
      estimate();
    }catch(e){notify("Sistem tempahan belum tersedia. Sila cuba lagi kemudian.");console.error(e);}
  }
  function estimate(){
    const p=priceRows[getField("orderProduct")];
    const qty=Math.max(1,Math.min(100000,Number(getField("orderQuantity"))||1));
    if(!p){$("#estimatePrice").textContent="Harga selepas semakan";return 0;}
    const factors={small:.92,standard:1,large:1.25,custom:1.35};
    const materials={standard:1,premium:1.25,waterproof:1.35,custom:1.2};
    const urgencies={normal:1,priority:1.15,urgent:1.3};
    const design={ready:0,edit:1500,design:4500};
    const value=Math.max(p.minimum_sen,Math.round((p.base_sen+qty*p.unit_sen)*(factors[getField("orderSize")]||1)*(materials[getField("orderMaterial")]||1)*(urgencies[getField("orderUrgency")]||1)+(design[getField("orderArtwork")]||0)));
    $("#estimatePrice").textContent=currency(value);
    return value;
  }
  $$("#orderProduct, #orderQuantity, #orderSize, #orderMaterial, #orderArtwork, #orderUrgency").forEach(el=>el.addEventListener("change",estimate));
  $("#orderQuantity")?.addEventListener("input",estimate);
  function step(n){currentStep=n;$$(".form-step",form).forEach(el=>el.classList.toggle("active",Number(el.dataset.step)===n));}
  function openOrder(product){
    form.reset();
    if(product&&priceRows[product])$("#orderProduct").value=product;
    $("#orderQuantity").value=["photo-4r","polaroid"].includes(product)?10:100;
    $("#orderSuccess").hidden=true;
    form.hidden=false;
    step(1);
    estimate();
    modal.classList.add("open");
    modal.setAttribute("aria-hidden","false");
    document.body.classList.add("modal-open");
    setTimeout(()=>$("#orderProduct").focus(),100);
  }
  const close=()=>{modal.classList.remove("open");modal.setAttribute("aria-hidden","true");document.body.classList.remove("modal-open");};
  $$("#menuToggle").forEach(el=>el.addEventListener("click",()=>{
    const open=$("#siteNav").classList.toggle("open");
    el.setAttribute("aria-expanded",String(open));
  }));
  $$("#siteNav a").forEach(el=>el.addEventListener("click",()=>$("#siteNav").classList.remove("open")));
  $$("[data-open-order]").forEach(el=>el.addEventListener("click",()=>openOrder(el.dataset.product||"")));
  $$("[data-choose-product]").forEach(el=>el.addEventListener("click",()=>openOrder(el.dataset.chooseProduct)));
  $$("[data-close-modal]").forEach(el=>el.addEventListener("click",close));
  document.addEventListener("keydown",event=>{if(event.key==="Escape")close();});
  $$("[data-next-step]").forEach(el=>el.addEventListener("click",()=>{
    const current=$('.form-step[data-step="'+currentStep+'"]',form);
    const required=$$("input[required],select[required]",current);
    const invalid=required.find(node=>!node.checkValidity());
    if(invalid){invalid.reportValidity();return;}
    if(currentStep===2 && !form.elements.customerName.value.trim()){notify("Sila isi nama pelanggan.");return;}
    if(currentStep===2)showSummary();
    step(Math.min(3,currentStep+1));
  }));
  $$("[data-prev-step]").forEach(el=>el.addEventListener("click",()=>step(Math.max(1,currentStep-1))));
  function showSummary(){
    const d=new FormData(form);
    const s=$("#orderSummary");
    const rows=[["Produk",labels[d.get("product")]||d.get("product")],["Kuantiti",d.get("quantity")],["Saiz",d.get("size")],["Material",d.get("material")],["Anggaran awal",$("#estimatePrice").textContent]];
    s.replaceChildren();
    rows.forEach(([key,value])=>{
      const row=document.createElement("div");row.className="summary-row";
      const left=document.createElement("span");left.textContent=String(key);
      const right=document.createElement("strong");right.textContent=String(value);
      row.append(left,right);s.append(row);
    });
  }
  form?.addEventListener("submit",async event=>{
    event.preventDefault();
    if(busy||!form.checkValidity())return form.reportValidity();
    if(!Object.keys(priceRows).length)return notify("Sistem tempahan belum tersedia.");
    busy=true;
    const submit=form.querySelector('[type="submit"]');submit.disabled=true;
    const d=new FormData(form);
    const payload={product:d.get("product"),quantity:Number(d.get("quantity")),size:d.get("size"),material:d.get("material"),artwork:d.get("artwork"),urgency:d.get("urgency"),customerName:d.get("customerName"),phone:d.get("phone"),email:d.get("email"),dueDate:d.get("dueDate"),notes:d.get("notes"),affiliateCode:referral()};
    try{
      const result=await api("/api/orders",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload)});
      const tokens=savedOrders();tokens[result.orderId]=result.accessToken;
      localStorage.setItem("am_v2_order_tokens",JSON.stringify(tokens));
      $("#successOrderId").textContent=result.orderId;
      $("#successAccessToken").textContent=result.accessToken;
      const notice=$("#uploadNotice");notice.textContent="";
      const file=$("#artworkFile")?.files?.[0];
      if(file){
        try{
          const formData=new FormData();formData.append("file",file);
          await api("/api/orders/"+encodeURIComponent(result.orderId)+"/artwork",{method:"POST",headers:{"x-order-token":result.accessToken},body:formData});
          notice.textContent="Artwork berjaya dimuat naik.";
        }catch(e){notice.textContent="Tempahan diterima tetapi artwork gagal dimuat naik: "+e.message+". Simpan kod akses dan hubungi kami.";}
      }
      const mailBody=encodeURIComponent("Tempahan: "+result.orderId+"\nProduk: "+(labels[payload.product]||payload.product)+"\nAnggaran awal: "+currency(result.estimateSen)+"\nNo telefon: "+payload.phone);
      $("#emailOrderLink").href="mailto:amcraftbrew@gmail.com?subject="+encodeURIComponent("Tempahan "+result.orderId)+"&body="+mailBody;
      form.hidden=true;
      $("#orderSuccess").hidden=false;
    }catch(e){notify(e.message);}finally{busy=false;submit.disabled=false;}
  });
  $("#copyOrderId")?.addEventListener("click",async()=>{
    await navigator.clipboard.writeText($("#successOrderId").textContent+" | Kod akses: "+$("#successAccessToken").textContent);
    notify("Nombor tempahan dan kod akses disalin.");
  });
  track?.addEventListener("submit",async event=>{
    event.preventDefault();
    const id=fieldTrack($("#trackId").value);
    const token=$("#trackToken").value.trim()||savedOrders()[id];
    const result=$("#trackResult");
    if(!id||!token){result.textContent="Masukkan nombor tempahan dan kod akses. Pada peranti asal, kod disimpan secara automatik.";return;}
    try{
      const data=await api("/api/orders/"+encodeURIComponent(id),{headers:{"x-order-token":token}});
      const row=data.order;
      result.replaceChildren();
      const title=document.createElement("strong");title.textContent="Status: "+row.production_status;
      const desc=document.createElement("span");desc.textContent="Produk: "+(labels[row.product_code]||row.product_code)+" | Kuantiti: "+row.quantity+" | Anggaran: "+currency(row.estimate_sen)+" | Bayaran: "+row.payment_status;
      result.append(title,desc);
    }catch(e){result.textContent=e.message;}
  });
  const fieldTrack=s=>String(s||"").trim().toUpperCase();
  $("#waitlistForm")?.addEventListener("submit",async event=>{
    event.preventDefault();
    const f=event.currentTarget;const d=new FormData(f);
    try{await api("/api/waitlist",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({name:d.get("name"),phone:d.get("phone")})});f.reset();notify("Berjaya! Kami sudah terima pendaftaran anda.");}
    catch(e){notify(e.message);}
  });
  $("#year").textContent=new Date().getFullYear();
  if("IntersectionObserver" in window){
    const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add("visible");observer.unobserve(entry.target);}}),{threshold:.05});
    $$(".reveal").forEach(el=>observer.observe(el));
  }else $$(".reveal").forEach(el=>el.classList.add("visible"));
  getProducts();
})();
