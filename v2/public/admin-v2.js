(() => {
  "use strict";
  const $=(s,root=document)=>root.querySelector(s);
  const $$=(s,root=document)=>Array.from(root.querySelectorAll(s));
  const money=sen=>new Intl.NumberFormat("ms-MY",{style:"currency",currency:"MYR"}).format(Number(sen||0)/100);
  const state={orders:[],products:[],affiliates:[]};
  const stages=["quote_requested","awaiting_payment","artwork_review","awaiting_approval","printing","packing","quality_check","ready_to_ship","completed","cancelled"];
  const $feedback=$("#feedback");
  const say=(msg,good=false)=>{const el=$("#dashboard").hidden?$("#loginMessage"):$feedback;el.style.color=good?"#176850":"#ae4d41";el.textContent=msg;};
  const api=async(path,options={})=>{
    const response=await fetch(path,{credentials:"same-origin",...options,headers:{"accept":"application/json",...(options.headers||{})}});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data.error||"Server error");
    return data;
  };
  const post=(path,body,method="POST")=>api(path,{method,headers:{"content-type":"application/json"},body:JSON.stringify(body)});
  const el=(tag,text,className)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=String(text);if(className)n.className=className;return n;};
  function loginScreen(isLoggedIn){
    $("#loginPanel").hidden=isLoggedIn;
    $("#dashboard").hidden=!isLoggedIn;
    $("#logout").hidden=!isLoggedIn;
  }
  async function reload(){
    const [orders,products,affiliates]=await Promise.all([api("/api/admin/orders"),api("/api/admin/products"),api("/api/admin/affiliates")]);
    state.orders=orders.orders||[];
    state.products=products.products||[];
    state.affiliates=affiliates.affiliates||[];
    renderMetrics();renderOrders();renderProducts();renderAffiliates();
  }
  function renderMetrics(){
    $("#metricOrders").textContent=state.orders.length;
    $("#metricQuotes").textContent=state.orders.filter(o=>o.production_status==="quote_requested").length;
    $("#metricEstimate").textContent=money(state.orders.reduce((sum,o)=>sum+o.estimate_sen,0));
    $("#metricAffiliates").textContent=state.affiliates.filter(a=>a.status==="active").length;
  }
  function renderOrders(){
    const search=$("#orderSearch").value.toLowerCase().trim();
    const rows=state.orders.filter(o=>[o.public_code,o.customer_name,o.phone,o.product_code].join(" ").toLowerCase().includes(search));
    const body=$("#ordersBody");body.replaceChildren();
    if(!rows.length){const tr=el("tr");const td=el("td","Tiada tempahan ditemui.");td.colSpan=6;tr.append(td);body.append(tr);return;}
    for(const order of rows){
      const tr=el("tr");
      for(const text of [order.public_code,order.customer_name+" | "+order.phone,order.product_code+" ×"+order.quantity,money(order.estimate_sen)]){
        tr.append(el("td",text));
      }
      const status=el("td");status.append(el("span",order.production_status,"pill"));tr.append(status);
      const action=el("td"),button=el("button","Semak");button.addEventListener("click",()=>showOrder(order.public_code));action.append(button);tr.append(action);body.append(tr);
    }
  }
  function showOrder(code){
    const order=state.orders.find(o=>o.public_code===code);if(!order)return;
    const body=$("#orderDetail");body.replaceChildren();
    body.append(el("h2",order.public_code),el("p","Semak status produksi dan harga final. Bayaran belum boleh diterima dalam V2 staging."));
    const grid=el("div",undefined,"detail-grid");
    for(const [k,v] of Object.entries({"Nama":order.customer_name,"Telefon":order.phone,"Email":order.email||"-","Produk":order.product_code,"Kuantiti":order.quantity,"Artwork":order.artwork_count+" uploaded","Affiliate":order.affiliate_code_snapshot||"Direct","Anggaran":money(order.estimate_sen),"Harga final":order.final_sen===null?"Belum disahkan":money(order.final_sen),"Status bayaran":order.payment_status})){
      const box=el("div");box.append(el("small",k),el("strong",v));grid.append(box);
    }
    body.append(grid);
    const form=el("form",undefined,"detail-actions");
    const label=el("label","Status");
    const select=el("select");
    for(const s of stages){const opt=el("option",s);opt.value=s;opt.selected=s===order.production_status;select.append(opt);}label.append(select);
    const save=el("button","Kemaskini status");save.type="submit";form.append(label,save);
    form.addEventListener("submit",async e=>{e.preventDefault();try{await post("/api/admin/orders/"+encodeURIComponent(code),{productionStatus:select.value},"PATCH");$("#orderDialog").close();await reload();say("Status berjaya dikemaskini",true);}catch(err){say(err.message);}});
    body.append(form);
    const quoteForm=el("form",undefined,"detail-actions");
    const quoteLabel=el("label","Sahkan harga final (RM)");
    const price=el("input");price.type="number";price.min="1";price.step=".01";price.required=true;price.value=((order.final_sen??order.estimate_sen)/100).toFixed(2);quoteLabel.append(price);
    const quoteButton=el("button","Sahkan quotation");quoteButton.type="submit";quoteForm.append(quoteLabel,quoteButton);
    quoteForm.addEventListener("submit",async e=>{e.preventDefault();try{const finalSen=Math.round(Number(price.value)*100);await post("/api/admin/orders/"+encodeURIComponent(code),{finalSen},"PATCH");$("#orderDialog").close();await reload();say("Quotation disahkan. Belum ada pembayaran automatik.",true);}catch(err){say(err.message);}});
    body.append(quoteForm);
    $("#orderDialog").showModal();
  }
  function renderProducts(){
    const parent=$("#productEditors");parent.replaceChildren();
    for(const product of state.products){
      const form=el("form",undefined,"product-card");form.append(el("h3",product.code));
      const inputs={};
      for(const [key,label,value] of [["name","Nama produk",product.name],["baseSen","Yuran asas RM",(product.base_sen/100).toFixed(2)],["unitSen","Harga / unit RM",(product.unit_sen/100).toFixed(2)],["minimumSen","Minimum RM",(product.minimum_sen/100).toFixed(2)]]){
        const lbl=el("label",label);const input=el("input");input.value=value;input.required=true;input.name=key;if(key!=="name"){input.type="number";input.min="0";input.step=".01";}lbl.append(input);form.append(lbl);inputs[key]=input;
      }
      const activeLabel=el("label","Produk aktif");const active=el("input");active.type="checkbox";active.checked=!!product.active;activeLabel.append(active);form.append(activeLabel);
      const btn=el("button","Simpan harga");btn.type="submit";form.append(btn);
      form.addEventListener("submit",async e=>{
        e.preventDefault();
        const body={name:inputs.name.value,baseSen:Math.round(Number(inputs.baseSen.value)*100),unitSen:Math.round(Number(inputs.unitSen.value)*100),minimumSen:Math.round(Number(inputs.minimumSen.value)*100),active:active.checked};
        try{await post("/api/admin/products/"+encodeURIComponent(product.code),body,"PATCH");await reload();say("Harga produk disimpan",true);}catch(err){say(err.message);}
      });
      parent.append(form);
    }
  }
  function renderAffiliates(){
    const body=$("#affiliatesBody");body.replaceChildren();
    if(!state.affiliates.length){const tr=el("tr"),td=el("td","Tiada affiliates lagi.");td.colSpan=5;tr.append(td);body.append(tr);return;}
    for(const a of state.affiliates){
      const tr=el("tr");tr.append(el("td",a.name),el("td",a.code),el("td",(a.commission_bps/100).toFixed(2)+"%"),el("td",a.status));
      const col=el("td"),btn=el("button","Salin pautan");
      btn.addEventListener("click",async()=>{
        const url=location.origin+"/?ref="+encodeURIComponent(a.code);
        try{await navigator.clipboard.writeText(url);say("Affiliate link disalin",true);}catch{say("Pautan: "+url,true);}
      });
      col.append(btn);tr.append(col);body.append(tr);
    }
  }
  $("#loginForm").addEventListener("submit",async e=>{
    e.preventDefault();
    try{
      await post("/api/admin/login",{password:$("#password").value});
      $("#password").value="";
      loginScreen(true);await reload();say("Selamat datang.",true);
    }catch(err){say(err.message);}
  });
  $("#logout").addEventListener("click",async()=>{try{await api("/api/admin/logout",{method:"POST"});}catch{}loginScreen(false);});
  $("#refresh").addEventListener("click",()=>reload().then(()=>say("Data terkini dimuatkan",true)).catch(e=>say(e.message)));
  $("#orderSearch").addEventListener("input",renderOrders);
  $$("[data-tab]").forEach(btn=>btn.addEventListener("click",()=>{
    $$("[data-tab]").forEach(b=>b.classList.toggle("active",b===btn));
    for(const k of ["orders","products","affiliates"])$("#"+k+"Panel").hidden=btn.dataset.tab!==k;
  }));
  $("#newAffiliateForm").addEventListener("submit",async e=>{
    e.preventDefault();const form=e.currentTarget,d=new FormData(form);
    try{
      const b={name:d.get("name"),code:d.get("code"),email:d.get("email"),phone:d.get("phone"),commissionBps:Math.round(Number(d.get("commissionPct"))*100)};
      await post("/api/admin/affiliates",b);form.reset();await reload();say("Affiliate baru dicipta. Komisen belum aktif sehingga pembayaran diintegrasikan.",true);
    }catch(err){say(err.message);}
  });
  api("/api/admin/session").then(()=>{loginScreen(true);return reload();}).catch(()=>loginScreen(false));
})();