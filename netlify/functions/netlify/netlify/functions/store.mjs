import { getStore } from "@netlify/blobs";
import { randomUUID } from "node:crypto";

const store = () => getStore("ms-fashion-bari");
const json = (data, status=200) => new Response(JSON.stringify(data), {status, headers:{"Content-Type":"application/json","Access-Control-Allow-Origin":"*"}});
async function read(key, fallback){const v=await store().get(key,{type:"json"});return v??fallback}
async function write(key,val){await store().setJSON(key,val)}
function isAdmin(body){return !!process.env.ADMIN_PASSWORD && body.password===process.env.ADMIN_PASSWORD}

export default async (req) => {
  if(req.method==="OPTIONS") return new Response("",{status:204,headers:{"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"Content-Type","Access-Control-Allow-Methods":"GET,POST"});
  try{
    if(req.method==="GET" && new URL(req.url).searchParams.get("action")==="public"){
      return json({products:await read("products",[]),settings:await read("settings",{name:"MS Fashion Bari",logo:""})});
    }
    if(req.method!=="POST") return json({error:"Method not allowed"},405);
    const b=await req.json();
    if(b.action==="order"){
      if(!b.customer?.name||!b.customer?.phone||!b.customer?.address||!Array.isArray(b.items)||!b.items.length) return json({error:"অর্ডারের তথ্য অসম্পূর্ণ"},400);
      const orders=await read("orders",[]);
      orders.unshift({...b,id:randomUUID(),status:"নতুন",createdAt:new Date().toISOString()});
      await write("orders",orders.slice(0,500));
      return json({ok:true});
    }
    if(!isAdmin(b)) return json({error:"অ্যাডমিন পাসওয়ার্ড সঠিক নয়"},401);
    if(b.action==="admin-check") return json({ok:true});
    if(b.action==="save-product"){
      const arr=await read("products",[]),p=b.product||{};
      if(!p.name||!Number.isFinite(Number(p.price))) return json({error:"নাম ও দাম দিন"},400);
      if(p.id){const i=arr.findIndex(x=>x.id===p.id);if(i<0)return json({error:"পণ্য পাওয়া যায়নি"},404);arr[i]={...arr[i],...p};}
      else arr.unshift({...p,id:randomUUID()});
      await write("products",arr);return json({ok:true});
    }
    if(b.action==="delete-product"){await write("products",(await read("products",[])).filter(x=>x.id!==b.id));return json({ok:true})}
    if(b.action==="save-settings"){const old=await read("settings",{name:"MS Fashion Bari",logo:""});await write("settings",{...old,...b.settings,logo:b.settings?.logo||old.logo});return json({ok:true})}
    if(b.action==="orders") return json({orders:await read("orders",[])});
    if(b.action==="status"){const a=await read("orders",[]),i=a.findIndex(x=>x.id===b.id);if(i<0)return json({error:"অর্ডার পাওয়া যায়নি"},404);a[i].status=b.status;await write("orders",a);return json({ok:true})}
    return json({error:"Unknown action"},400);
  }catch(e){return json({error:e.message||"Server error"},500)}
};
