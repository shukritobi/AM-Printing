type Env = {
  DB: D1Database;
  ARTWORKS: R2Bucket;
  ASSETS: Fetcher;
  ADMIN_PASSWORD?: string;
  SESSION_SECRET?: string;
};
type AnyObject = Record<string, unknown>;
type Product = { code: string; name: string; base_sen: number; unit_sen: number; minimum_sen: number; active: number };
type Affiliate = { id: string; code: string; commission_bps: number };
const JSON_HEADERS = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" };
function reply(data: unknown, status = 200): Response { return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS }); }
function error(message: string, status = 400): Response { return reply({ error: message }, status); }
function field(value: unknown, max = 200): string { return typeof value === "string" ? value.trim().slice(0, max) : ""; }
function allowed<T extends string>(value: unknown, options: readonly T[], fallback: T): T { return options.includes(value as T) ? value as T : fallback; }
function randomHex(length = 32): string { return Array.from(crypto.getRandomValues(new Uint8Array(length)), b => b.toString(16).padStart(2, "0")).join(""); }
async function sha256(text: string): Promise<string> { const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))); return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join(""); }
async function jsonBody(req: Request): Promise<AnyObject> {
  if (!req.headers.get("content-type")?.includes("application/json")) throw new Error("JSON body required");
  const raw = await req.text();
  if (raw.length > 20000) throw new Error("Request too large");
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid request");
  return value as AnyObject;
}
function validOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  return !origin || new URL(origin).origin === new URL(req.url).origin;
}
function estimate(product: Product, quantity: number, size: string, material: string, artwork: string, urgency: string): number {
  const factors: Record<string, number> = { small: .92, standard: 1, large: 1.25, custom: 1.35 };
  const materials: Record<string, number> = { standard: 1, premium: 1.25, waterproof: 1.35, custom: 1.2 };
  const urgencies: Record<string, number> = { normal: 1, priority: 1.15, urgent: 1.3 };
  const design: Record<string, number> = { ready: 0, edit: 1500, design: 4500 };
  const before = (product.base_sen + quantity * product.unit_sen) * factors[size] * materials[material] * urgencies[urgency];
  return Math.max(product.minimum_sen, Math.round(before + design[artwork]));
}
async function makeSignature(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return Array.from(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload))), b => b.toString(16).padStart(2, "0")).join("");
}
function equalFixed(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}
async function isAdmin(req: Request, env: Env): Promise<boolean> {
  if (!env.SESSION_SECRET || !env.ADMIN_PASSWORD) return false;
  const cookie = req.headers.get("cookie") || "";
  const match = cookie.match(/(?:^|;\s*)am_admin=([^;]+)/);
  if (!match) return false;
  const [kind, expiry, sig] = match[1].split(".");
  if (kind !== "v1" || !expiry || !sig || !/^\d+$/.test(expiry) || +expiry < Date.now()) return false;
  const expected = await makeSignature(env.SESSION_SECRET, kind + "." + expiry);
  return equalFixed(sig, expected);
}
async function audit(db: D1Database, action: string, entityType: string, id: string) {
  await db.prepare("INSERT INTO audit_log (id,action,entity_type,entity_id) VALUES (?,?,?,?)").bind(crypto.randomUUID(),action,entityType,id).run();
}
const PRODUCTION_STATES = ["quote_requested","awaiting_payment","artwork_review","awaiting_approval","printing","packing","quality_check","ready_to_ship","completed","cancelled"];
async function route(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method;
  if (path === "/api/health" && method === "GET") return reply({ service: "amcraftbrew-v2", status: "staging", paymentEnabled: false });
  if (!env.DB) return error("Database is not configured", 503);
  if (["POST","PUT","PATCH","DELETE"].includes(method) && !validOrigin(req)) return error("Cross-origin requests are not allowed", 403);
  if (path === "/api/products" && method === "GET") {
    const rows = await env.DB.prepare("SELECT code,name,base_sen,unit_sen,minimum_sen FROM products WHERE active=1 ORDER BY rowid").all();
    return reply({ products: rows.results });
  }
  if (path === "/api/waitlist" && method === "POST") {
    const b = await jsonBody(req);
    const name = field(b.name,120), phone = field(b.phone,25);
    if (name.length < 2 || !/^[+0-9 ()-]{8,25}$/.test(phone)) return error("Valid name and phone required");
    await env.DB.prepare("INSERT INTO waitlist (id,name,phone) VALUES (?,?,?)").bind(crypto.randomUUID(),name,phone).run();
    return reply({ ok: true },201);
  }
  if (path === "/api/orders" && method === "POST") {
    const b = await jsonBody(req);
    const code = field(b.product,60);
    const product = await env.DB.prepare("SELECT code,name,base_sen,unit_sen,minimum_sen,active FROM products WHERE code=? AND active=1").bind(code).first<Product>();
    if (!product) return error("Unknown product");
    const quantity = Number(b.quantity);
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 100000) return error("Quantity must be between 1 and 100,000");
    const customerName = field(b.customerName,120), phone = field(b.phone,25), email = field(b.email,180);
    if (customerName.length < 2 || !/^[+0-9 ()-]{8,25}$/.test(phone)) return error("Valid customer name and phone required");
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return error("Invalid email");
    const size = allowed(b.size,["small","standard","large","custom"],"standard");
    const material = allowed(b.material,["standard","premium","waterproof","custom"],"standard");
    const artwork = allowed(b.artwork,["ready","edit","design"],"ready");
    const urgency = allowed(b.urgency,["normal","priority","urgent"],"normal");
    const dueDate = field(b.dueDate,10);
    if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return error("Invalid due date");
    const quoteSen = estimate(product,quantity,size,material,artwork,urgency);
    const accessToken = randomHex();
    const accessHash = await sha256(accessToken);
    const id = crypto.randomUUID();
    const publicCode = "AM" + new Date().toISOString().slice(2,10).replace(/-/g,"") + "-" + randomHex(4).toUpperCase();
    const affiliateCode = field(b.affiliateCode,60);
    const affiliate = affiliateCode ? await env.DB.prepare("SELECT id,code,commission_bps FROM affiliates WHERE code=? COLLATE NOCASE AND status='active'").bind(affiliateCode).first<Affiliate>() : null;
    await env.DB.prepare(
      "INSERT INTO orders (id,public_code,access_token_hash,customer_name,phone,email,due_date,product_code,quantity,size,material,artwork_type,urgency,notes,estimate_sen,affiliate_id,affiliate_code_snapshot,affiliate_bps_snapshot) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)"
    ).bind(id,publicCode,accessHash,customerName,phone,email||null,dueDate||null,code,quantity,size,material,artwork,urgency,field(b.notes,2000),quoteSen,affiliate?.id||null,affiliate?.code||null,affiliate?.commission_bps??null).run();
    return reply({ orderId: publicCode, accessToken, estimateSen: quoteSen, status:"quote_requested", paymentEnabled:false },201);
  }
  const track = path.match(/^\/api\/orders\/([A-Za-z0-9-]+)$/);
  if (track && method === "GET") {
    const token = field(req.headers.get("x-order-token"),128);
    if (!/^[0-9a-f]{64}$/.test(token)) return error("Private order token required",401);
    const hash = await sha256(token);
    const item = await env.DB.prepare(
      "SELECT public_code,product_code,quantity,estimate_sen,final_sen,production_status,payment_status,created_at,updated_at FROM orders WHERE public_code=? AND access_token_hash=?"
    ).bind(track[1],hash).first();
    return item ? reply({ order:item }) : error("Order not found or token invalid",404);
  }
  const artworkRoute = path.match(/^\/api\/orders\/([A-Za-z0-9-]+)\/artwork$/);
  if (artworkRoute && method === "POST") {
    if (!env.ARTWORKS) return error("Artwork storage not configured",503);
    const token = field(req.headers.get("x-order-token"),128);
    if (!/^[0-9a-f]{64}$/.test(token)) return error("Private order token required",401);
    const found = await env.DB.prepare("SELECT id FROM orders WHERE public_code=? AND access_token_hash=?").bind(artworkRoute[1],await sha256(token)).first<{id:string}>();
    if (!found) return error("Order not found",404);
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size < 1 || file.size > 10 * 1024 * 1024) return error("File required (maximum 10 MB)");
    const suffix = file.name.toLowerCase().split(".").pop() || "";
    if (!["pdf","ai","psd","png","jpg","jpeg"].includes(suffix)) return error("Unsupported file extension");
    const key = "orders/" + found.id + "/" + crypto.randomUUID() + "." + suffix;
    await env.ARTWORKS.put(key,await file.arrayBuffer(),{httpMetadata:{contentType:"application/octet-stream"}});
    await env.DB.prepare("INSERT INTO order_artworks (id,order_id,r2_key,filename,content_type,bytes) VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(),found.id,key,field(file.name,220),field(file.type,100)||"application/octet-stream",file.size).run();
    return reply({ ok:true, filename:field(file.name,220) },201);
  }
  if (path === "/api/admin/login" && method === "POST") {
    if (!env.ADMIN_PASSWORD || !env.SESSION_SECRET) return error("Admin login not configured",503);
    const b=await jsonBody(req);
    const pass=field(b.password,512);
    if (!pass || !equalFixed(await sha256(pass),await sha256(env.ADMIN_PASSWORD))) return error("Invalid credentials",401);
    const expiry=String(Date.now()+12*60*60*1000);
    const payload="v1."+expiry;
    const sig=await makeSignature(env.SESSION_SECRET,payload);
    const secure=url.protocol==="https:"?"; Secure":"";
    const response=reply({ok:true});
    response.headers.append("set-cookie","am_admin="+payload+"."+sig+"; HttpOnly; SameSite=Strict; Path=/api; Max-Age=43200"+secure);
    return response;
  }
  if (path.startsWith("/api/admin/")) {
    if (!await isAdmin(req,env)) return error("Admin login required",401);
    if (path==="/api/admin/session" && method==="GET") return reply({ authenticated:true });
    if (path==="/api/admin/logout" && method==="POST") {
      const response=reply({ok:true});
      response.headers.append("set-cookie","am_admin=; HttpOnly; SameSite=Strict; Path=/api; Max-Age=0"+(url.protocol==="https:"?"; Secure":""));
      return response;
    }
    if (path==="/api/admin/orders" && method==="GET") {
      const results=await env.DB.prepare("SELECT o.public_code,o.customer_name,o.phone,o.email,o.product_code,o.quantity,o.estimate_sen,o.final_sen,o.production_status,o.payment_status,o.created_at,o.updated_at,o.affiliate_code_snapshot, (SELECT count(*) FROM order_artworks a WHERE a.order_id=o.id) AS artwork_count FROM orders o ORDER BY o.created_at DESC LIMIT 200").all();
      return reply({orders:results.results});
    }
    const orderMatch=path.match(/^\/api\/admin\/orders\/([A-Za-z0-9-]+)$/);
    if (orderMatch && method==="PATCH") {
      const b=await jsonBody(req);
      const status=field(b.productionStatus,40);
      const finalSen=b.finalSen===undefined?null:Number(b.finalSen);
      if (!status && finalSen===null) return error("No changes supplied");
      if (status && !PRODUCTION_STATES.includes(status)) return error("Unsupported production status");
      if (finalSen!==null && (!Number.isSafeInteger(finalSen)||finalSen<100||finalSen>100000000)) return error("Invalid final amount");
      const item=await env.DB.prepare("SELECT id,payment_status FROM orders WHERE public_code=?").bind(orderMatch[1]).first<{id:string,payment_status:string}>();
      if (!item) return error("Order not found",404);
      if (finalSen!==null) {
        await env.DB.prepare("UPDATE orders SET final_sen=?,production_status='awaiting_payment',updated_at=datetime('now') WHERE id=?").bind(finalSen,item.id).run();
        await audit(env.DB,"quote_confirmed","order",item.id);
      } else {
        await env.DB.prepare("UPDATE orders SET production_status=?,updated_at=datetime('now') WHERE id=?").bind(status,item.id).run();
        await audit(env.DB,"production_status_changed","order",item.id);
      }
      return reply({ok:true});
    }
    if (path==="/api/admin/products" && method==="GET") {
      const results=await env.DB.prepare("SELECT * FROM products ORDER BY rowid").all();
      return reply({ products:results.results });
    }
    const productMatch=path.match(/^\/api\/admin\/products\/([a-z0-9-]+)$/);
    if (productMatch && method==="PATCH") {
      const b=await jsonBody(req);
      const name=field(b.name,150);
      const base=Number(b.baseSen),unit=Number(b.unitSen),minimum=Number(b.minimumSen);
      if (!name || ![base,unit,minimum].every(n=>Number.isSafeInteger(n)&&n>=0&&n<=100000000)) return error("Invalid product data");
      const res=await env.DB.prepare("UPDATE products SET name=?,base_sen=?,unit_sen=?,minimum_sen=?,active=? WHERE code=?").bind(name,base,unit,minimum,b.active===false?0:1,productMatch[1]).run();
      if (!res.meta.changes) return error("Unknown product",404);
      await audit(env.DB,"product_updated","product",productMatch[1]);
      return reply({ok:true});
    }
    if (path==="/api/admin/affiliates" && method==="GET") {
      const results=await env.DB.prepare("SELECT id,code,name,email,phone,commission_bps,status,created_at FROM affiliates ORDER BY created_at DESC LIMIT 200").all();
      return reply({ affiliates:results.results });
    }
    if (path==="/api/admin/affiliates" && method==="POST") {
      const b=await jsonBody(req);
      const name=field(b.name,120), email=field(b.email,180), phone=field(b.phone,25),code=field(b.code,30).toUpperCase();
      const bps=Number(b.commissionBps);
      if (name.length<2 || !/^[A-Z0-9-]{3,30}$/.test(code) || !Number.isInteger(bps) || bps<0 || bps>3000) return error("Invalid affiliate details");
      const already=await env.DB.prepare("SELECT id FROM affiliates WHERE code=? COLLATE NOCASE").bind(code).first();
      if (already) return error("Affiliate code already exists",409);
      const id=crypto.randomUUID();
      await env.DB.prepare("INSERT INTO affiliates (id,code,name,email,phone,commission_bps,status) VALUES (?,?,?,?,?,?,'active')").bind(id,code,name,email||null,phone||null,bps).run();
      await audit(env.DB,"affiliate_created","affiliate",id);
      return reply({ok:true,id,link:url.origin+"/?ref="+encodeURIComponent(code)},201);
    }
    return error("Unknown admin route",404);
  }
  return error("Route not found",404);
}
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const pathname=new URL(request.url).pathname;
      if (pathname.startsWith("/api/")) return await route(request,env);
      return env.ASSETS.fetch(request);
    } catch (e) {
      console.error("AM V2 error:",e instanceof Error ? e.message:"Unexpected error");
      if (e instanceof SyntaxError) return error("Invalid JSON");
      if (e instanceof Error && /required|request too large|invalid request/i.test(e.message)) return error(e.message);
      return error("Unexpected server error",500);
    }
  }
} satisfies ExportedHandler<Env>;
