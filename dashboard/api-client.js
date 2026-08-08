/* Gustavo's Cointab GitHub Pages API client. No private keys belong here. */
const CoinTabApi=(()=>{
  const config=window.CointabApiConfig||{};
  const base=(config.baseUrl||'https://api.rentaride.top/api/v1').replace(/\/$/,'');
  const proxy=String(config.proxyUrl||'').trim();
  const timeoutMs=Math.max(5000,Number(config.requestTimeoutMs)||25000);
  const endpoint=path=>proxy?(proxy+(proxy.includes('?')?'&':'?')+'path='+encodeURIComponent(path)):(base+path);
  let token=localStorage.getItem('cointab_api_token')||'';
  let refreshToken=localStorage.getItem('cointab_refresh_token')||'';
  let refreshing=null;
  const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  function saveSession(data){
    const session=(data&&data.session)||data||{};
    token=String(session.token||session.accessToken||'');
    refreshToken=String(session.refreshToken||refreshToken||'');
    if(token)localStorage.setItem('cointab_api_token',token);
    if(refreshToken)localStorage.setItem('cointab_refresh_token',refreshToken);
  }
  function logout(){token='';refreshToken='';localStorage.removeItem('cointab_api_token');localStorage.removeItem('cointab_refresh_token');}
  async function raw(path,payload={},authenticated=true,attempt=0){
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),timeoutMs);
    try{
      const response=await fetch(endpoint(path),{method:'POST',headers:{'Content-Type':'application/json',...(authenticated&&token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(payload),signal:controller.signal});
      const json=await response.json().catch(()=>({}));
      if(response.status===401&&authenticated&&refreshToken&&path!='/auth/refresh'){
        if(!refreshing)refreshing=raw('/auth/refresh',{refreshToken},false).then(result=>{saveSession(result);return result;}).finally(()=>refreshing=null);
        try{await refreshing;return raw(path,payload,true,attempt);}catch(error){logout();throw error;}
      }
      if(!response.ok||json.ok===false){const message=json.error?.message||json.error||json.message||('Request failed (HTTP '+response.status+')');const error=new Error(message);error.code=json.error?.code||json.code||'';error.status=response.status;throw error;}
      return json.data||json;
    }catch(error){
      if(attempt<2&&(error.name==='AbortError'||error.status>=500||!error.status)){await delay(500*(attempt+1));return raw(path,payload,authenticated,attempt+1);}
      if(error.name==='AbortError')throw new Error('The API request timed out. Check api.rentaride.top and your hosting connection.');
      if(error instanceof TypeError||(!error.status&&!error.code)){
        throw new Error(proxy?'Dashboard proxy could not reach api.rentaride.top. Check api-proxy.php and PHP cURL.':'Browser could not reach the API. Add this website origin to the API CORS allowed_origins list.');
      }
      throw error;
    }
    finally{clearTimeout(timeout);}
  }
  return{
    base,proxy,hasSession:()=>!!token,logout,
    health:()=>raw('/health',{},false),
    login:async(email,pin)=>{const data=await raw('/auth/login',{email,pin},false);saveSession(data);return data;},
    access:async(access)=>{const data=await raw('/auth/access',{access},false);saveSession(data);return data;},
    summary:()=>raw('/dashboard/summary'),profile:()=>raw('/account/profile'),
    licenses:()=>raw('/licenses/list'),licenseHistory:()=>raw('/licenses/history'),
    release:(license,installId='')=>raw('/licenses/release',{license,installId}),
    revoke:license=>raw('/licenses/revoke',{license}),restore:license=>raw('/licenses/restore',{license}),
    transfer:(license,email,seller=false)=>raw(seller?'/licenses/seller-transfer':'/licenses/transfer',{license,newEmail:email}),
    command:(type,target,payload={})=>raw('/commands/create',{type,target,payload}),commands:()=>raw('/commands/list'),
    totals:(tabletId=null,location='')=>raw('/sales/totals',{...(tabletId?{tabletId}:{}),...(location?{location}:{})}),
    resetSales:(tabletId=null,location='')=>raw('/sales/reset',{...(tabletId?{tabletId}:{}),...(location?{location}:{})}),
    configuration:()=>raw('/configuration/get'),setConfiguration:(scope,scopeKey,key,value)=>raw('/configuration/set',{scope,scopeKey,key,value}),
    dashboardLink:emailLink=>raw('/dashboard/access',{emailLink:!!emailLink})
  };
})();
