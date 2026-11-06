const privacy=require('../services/privacyService');
async function handlePrivacyRoutes(req,res,pathname,_params,context){
  const {db,auth,aiService,helpers}=context;
  const {sendJson,sendError,requireAuth,guardMutation,parseBody}=helpers;
  if(pathname==='/api/privacy/analytics' && req.method==='GET'){
    const candidate=String(process.env.GA_MEASUREMENT_ID||'').trim();
    res.setHeader('Cache-Control','no-store');
    sendJson(res,200,{success:true,data:{measurementId:/^G-[A-Z0-9]{5,20}$/.test(candidate)?candidate:''}});return true;
  }
  if(pathname==='/api/privacy/operator' && req.method==='GET'){
    const name=process.env.HISAB_OPERATOR_NAME||'',address=process.env.HISAB_OPERATOR_ADDRESS||'',email=process.env.HISAB_PRIVACY_EMAIL||'';
    sendJson(res,200,{success:true,data:{name,address,email,configured:!!(name&&address&&email)}});return true;
  }
  if(!['/api/privacy/permissions','/api/privacy/export','/api/privacy/account'].includes(pathname))return false;
  if(!['GET','PUT','DELETE'].includes(req.method))return false;
  if(req.method!=='GET'&&!guardMutation(req,res,'privacy',10))return true;
  const user=requireAuth(req,res);if(!user)return true;
  res.setHeader('Cache-Control','no-store');
  if(pathname==='/api/privacy/permissions'&&req.method==='GET'){sendJson(res,200,{success:true,data:privacy.permissions(db,user.id)});return true;}
  if(pathname==='/api/privacy/permissions'&&req.method==='PUT'){
    const body=await parseBody(req);
    if(typeof body.ai!=='boolean'||typeof body.voice!=='boolean'){sendError(res,400,'INVALID_CONSENT','Choose whether to enable AI and voice.');return true;}
    sendJson(res,200,{success:true,data:privacy.savePermissions(db,user.id,body)});return true;
  }
  if(pathname==='/api/privacy/export'&&req.method==='GET'){sendJson(res,200,{success:true,...privacy.exportAccount(db,user.id)});return true;}
  if(pathname==='/api/privacy/account'&&req.method==='DELETE'){
    const body=await parseBody(req);
    const row=db.prepare('SELECT password_salt,password_hash FROM users WHERE id=?').get(user.id);
    if(body.confirmation!=='DELETE'||!auth.verifyPassword(String(body.password||''),row.password_salt,row.password_hash)){sendError(res,400,'CONFIRM_DELETE','Enter your current password and DELETE to confirm.');return true;}
    try{privacy.eraseAccount(db,user.id);}catch(e){sendError(res,409,'DELETE_BLOCKED',e.message);return true;}
    for(const key of aiService.sessions.keys())if(key.startsWith(`user-${user.id}:`)||key===`user-${user.id}`)aiService.sessions.delete(key);
    sendJson(res,200,{success:true,message:'Account and active application records deleted.'},{'Set-Cookie':'hisab_session_id=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0'});return true;
  }
  return false;
}
module.exports={handlePrivacyRoutes};
