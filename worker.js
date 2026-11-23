/**
 * VOID Equity Stress Lab — Cloudflare Worker API 代理
 * 將 FMP_API_KEY 設為 Cloudflare Worker Secret，不要寫在程式碼內。
 * Deploy: wrangler secret put FMP_API_KEY
 * 若要正式公開網站，請將 Access-Control-Allow-Origin 限定為你的網站網域。
 */
const HEADERS = {
  'Access-Control-Allow-Origin': '*', // 正式部署時改成你的網站網域
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'public, max-age=300'
};
const json = (data, status=200) => new Response(JSON.stringify(data),{status,headers:{...HEADERS,'Content-Type':'application/json;charset=utf-8'}});
async function requestFmp(name,symbol,key,extra={}){
  const u=new URL('https://financialmodelingprep.com/stable/'+name);
  u.searchParams.set('symbol',symbol);
  u.searchParams.set('apikey',key);
  for(const [k,v] of Object.entries(extra))u.searchParams.set(k,String(v));
  const r=await fetch(u.toString(),{cf:{cacheTtl:300,cacheEverything:true}});
  const data=await r.json().catch(()=>null);
  if(!r.ok)throw new Error(data?.['Error Message']||`FMP HTTP ${r.status}`);
  if(!Array.isArray(data))throw new Error(data?.['Error Message']||'API 回傳格式無效');
  return data;
}
export default {
  async fetch(req,env){
    if(req.method==='OPTIONS')return new Response(null,{status:204,headers:HEADERS});
    if(req.method!=='GET')return json({error:'Method not allowed'},405);
    const url=new URL(req.url);
    const symbol=(url.searchParams.get('symbol')||'').trim().toUpperCase();
    if(!/^[A-Z0-9.\-^]{1,18}$/.test(symbol))return json({error:'請輸入有效股票代號，例如 NVDA、AAPL、TSM'},400);
    if(!env.FMP_API_KEY)return json({error:'Worker 尚未設定 FMP_API_KEY secret'},500);
    try{
      const [qs,ps,ts]=await Promise.allSettled([
        requestFmp('quote',symbol,env.FMP_API_KEY),
        requestFmp('profile',symbol,env.FMP_API_KEY),
        requestFmp('income-statements-ttm',symbol,env.FMP_API_KEY,{limit:1})
      ]);
      if(qs.status==='rejected')throw qs.reason;
      const quote=qs.value[0];if(!quote)throw new Error(`無法取得 ${symbol} 報價`);
      const profile=ps.status==='fulfilled'?ps.value[0]:null;
      let raw=ts.status==='fulfilled'?ts.value[0]:null,period='TTM';
      if(!raw){
        const qr=await requestFmp('income-statement',symbol,env.FMP_API_KEY,{period:'quarter',limit:4}).catch(()=>[]);
        if(qr.length>=4){raw={revenue:qr.slice(0,4).reduce((s,x)=>s+Number(x.revenue||0),0),netIncome:qr.slice(0,4).reduce((s,x)=>s+Number(x.netIncome||0),0),date:qr[0].date,reportedCurrency:qr[0].reportedCurrency};}
        else{const annual=await requestFmp('income-statement',symbol,env.FMP_API_KEY,{period:'annual',limit:1});raw=annual[0];period='FY';}
      }
      if(!raw)throw new Error('無法取得財報；請檢查 FMP 方案授權');
      return json({quote,profile,raw,period});
    }catch(e){return json({error:e.message||'Unknown error'},502)}
  }
};
