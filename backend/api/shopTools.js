const S=require('../services/shopTools');
const C=require('../../frontend/js/shopToolsCore');
async function handleShopTools(req,res,path,params,{db,helpers:h}){
 if(!path.startsWith('/api/shop-tools'))return false;
 if(!['GET','POST'].includes(req.method))return false;
 if(req.method==='POST'&&!h.guardMutation(req,res,'shop-tools',60))return true;
 try{
  if(path==='/api/shop-tools/portal'){
   const a=S.access(db,(req.headers.authorization||'').replace(/^Bearer /,''));if(!a){h.sendError(res,401,'LINK_EXPIRED','This link is invalid, expired or revoked.');return true;}
   const result=req.method==='GET'?S.accessView(db,a):S.respond(db,a,await h.parseBody(req));h.sendJson(res,200,{success:true,data:result});return true;
  }
  const user=h.requireAuth(req,res);if(!user)return true;
  if(path==='/api/shop-tools'&&req.method==='GET'){h.sendJson(res,200,{success:true,data:S.view(db,user.id)});return true;}
  if(req.method!=='POST')return false;
  const body=await h.parseBody(req);
  let data;
  if(path==='/api/shop-tools/action')data=S.apply(db,user.id,body.action,body.fields,body.requestId);
  else if(path==='/api/shop-tools/access')data=S.createAccess(db,user.id,body);
  else if(path==='/api/shop-tools/revoke'){S.initialize(db);db.prepare('UPDATE shop_access SET revoked=1 WHERE id=? AND user_id=?').run(body.id,user.id);data={revoked:true};}
  else if(path==='/api/shop-tools/scenario'){const r=S.records(db,user.id);data=C.scenario(S.load(db,user.id),r.credits,body);}
  else if(path==='/api/shop-tools/scan')data=await require('../services/receiptScan').scan(body.image);
  else return false;
  h.sendJson(res,200,{success:true,data});
 }catch(e){h.sendError(res,400,'SHOP_TOOLS_FAILED',e.message);}
 return true;
}
module.exports={handleShopTools};
