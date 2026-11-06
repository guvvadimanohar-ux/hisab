function normalise(input) {
 const periods=Array.isArray(input)?input:(Array.isArray(input?.periods)?input.periods:[]);
 const amount=value=>{const n=Number(value);return Number.isFinite(n)?Math.max(0,n):0;};
 return periods.slice(-6).map(p=>({month:String(p?.period||p?.month||''),inflow:amount(p?.inflow),outflow:amount(p?.outflow)}));
}
module.exports={normalise};
