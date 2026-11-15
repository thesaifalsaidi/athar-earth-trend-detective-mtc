/* ATHAR statistics engine (browser port of athar/stats_engine.py). No dependencies. */
const ATHAR = (() => {
  const erf = x => { const s = Math.sign(x); x = Math.abs(x); const t = 1 / (1 + 0.3275911 * x);
    const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x); return s * y; };
  const normCdf = z => 0.5 * (1 + erf(z / Math.SQRT2));
  const normPpf = p => { // Acklam
    const a=[-39.69683028665376,220.9460984245205,-275.9285104469687,138.357751867269,-30.66479806614716,2.506628277459239],
    b=[-54.47609879822406,161.5858368580409,-155.6989798598866,66.80131188771972,-13.28068155288572],
    c=[-0.007784894002430293,-0.3223964580411365,-2.400758277161838,-2.549732539343734,4.374664141464968,2.938163982698783],
    d=[0.007784695709041462,0.3224671290700398,2.445134137142996,3.754408661907416];
    const pl=0.02425; let q,r;
    if(p<pl){q=Math.sqrt(-2*Math.log(p));return (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5])/((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);}
    if(p>1-pl){q=Math.sqrt(-2*Math.log(1-p));return -(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5])/((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);}
    q=p-0.5;r=q*q;return (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q/(((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1);
  };
  const median = a => { const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  const mean = a => a.reduce((s, v) => s + v, 0) / a.length;
  const std = a => { const m = mean(a); return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / a.length); };

  function mkStat(y){ let s=0; for(let i=0;i<y.length-1;i++)for(let j=i+1;j<y.length;j++)s+=Math.sign(y[j]-y[i]); return s; }
  function mkVar(y){ const n=y.length, c={}; y.forEach(v=>c[v]=(c[v]||0)+1);
    let v=n*(n-1)*(2*n+5); for(const k in c){const t=c[k]; if(t>1) v-=t*(t-1)*(2*t+5);} return v/18; }
  function senSlopes(y,t){ const s=[]; for(let i=0;i<y.length-1;i++)for(let j=i+1;j<y.length;j++){const dt=t[j]-t[i]; if(dt!==0)s.push((y[j]-y[i])/dt);} return s.sort((a,b)=>a-b); }
  function lag1Factor(y,t){
    const n=y.length; if(n<8) return 1;
    const sl=median(senSlopes(y,t)); let d=y.map((v,i)=>v-sl*t[i]); const m=mean(d); d=d.map(v=>v-m);
    let den=0,num=0; for(let i=0;i<n;i++)den+=d[i]*d[i]; if(den===0)return 1;
    for(let i=0;i<n-1;i++)num+=d[i]*d[i+1];
    let r=num/den; if(n>5) r=(r*n+1)/(n-4); r=Math.min(Math.max(r,0),0.9); return (1+r)/(1-r);
  }
  function mannKendall(y,t,alpha=0.05,corr='lag1'){
    const n=y.length; if(n<8) return {S:0,Z:0,p:1,sig:false};
    const S=mkStat(y); let v=mkVar(y); if(corr==='lag1') v*=lag1Factor(y,t); if(v<=0) return {S,Z:0,p:1,sig:false};
    const Z=S>0?(S-1)/Math.sqrt(v):S<0?(S+1)/Math.sqrt(v):0; const p=2*(1-normCdf(Math.abs(Z))); return {S,Z,p,sig:p<alpha};
  }
  function theilSen(y,t,varFactor=1,conf=0.95){
    const sl=senSlopes(y,t), m=sl.length; if(m<1) return {slope:NaN,icpt:NaN,lo:NaN,hi:NaN};
    const slope=median(sl); const c=normPpf(0.5+conf/2)*Math.sqrt(mkVar(y)*varFactor);
    const m1=Math.floor((m-c)/2), m2=Math.ceil((m+c)/2); const cl=i=>Math.max(0,Math.min(m-1,i));
    return {slope,icpt:median(y.map((v,i)=>v-slope*t[i])),lo:sl[cl(m1)],hi:sl[cl(m2)]};
  }
  function rank(a){ const idx=a.map((v,i)=>[v,i]).sort((x,y)=>x[0]-y[0]), r=new Array(a.length); let i=0;
    while(i<idx.length){let j=i; while(j+1<idx.length&&idx[j+1][0]===idx[i][0])j++; const rk=(i+j)/2+1; for(let k=i;k<=j;k++)r[idx[k][1]]=rk; i=j+1;} return r; }
  function pettitt(y){ const n=y.length; if(n<10) return {k:null,p:1}; const r=rank(y); let cum=0,best=0,k=0;
    for(let i=0;i<n;i++){cum+=r[i]; const u=Math.abs(2*cum-(i+1)*(n+1)); if(u>best){best=u;k=i;}}
    return {k,p:Math.min(1,2*Math.exp(-6*best*best/(n**3+n**2)))}; }
  function bh(p,q=0.05){ const m=p.length, o=p.map((v,i)=>[v,i]).sort((a,b)=>a[0]-b[0]); let kmax=-1;
    o.forEach(([v],i)=>{ if(v<=q*(i+1)/m) kmax=i; }); const sig=new Array(m).fill(false); for(let i=0;i<=kmax;i++) sig[o[i][1]]=true; return sig; }
  function analyze(y,t,alpha=0.05){
    const mk=mannKendall(y,t,alpha), f=lag1Factor(y,t), ts=theilSen(y,t,f), base=mean(y);
    const span=Math.max(...t)-Math.min(...t), total=ts.slope*span, resid=y.map((v,i)=>v-(ts.slope*t[i]+ts.icpt)), sd=std(resid);
    const snr=sd>0?Math.abs(total)/sd:0, pc=base!==0?ts.slope*10/Math.abs(base)*100:NaN, pt=pettitt(y);
    let step=false; if(pt.k!==null&&pt.p<0.01&&total!==0){ const jump=Math.abs(median(y.slice(pt.k+1))-median(y.slice(0,pt.k+1))); step=jump>=0.6*Math.abs(total); }
    return {n:y.length,slope:ts.slope,lo:ts.lo,hi:ts.hi,icpt:ts.icpt,total,pctDecade:pc,z:mk.Z,p:mk.p,sig:mk.sig,snr,
      changeYear:pt.k!==null?t[pt.k]:null,changeP:pt.p,step,dir:mk.sig?(ts.slope>0?'up':'down'):'none'};
  }
  function leadLabel(p,snr){ return p<0.01&&snr>=1.5?'strong':p<0.05?'moderate':'noise'; }
  function score(r,completeness){ return 100*(0.5*Math.min(1,-Math.log10(Math.max(r.p,1e-12))/4)+0.3*Math.min(1,r.snr/3)+0.2*completeness); }
  // honesty lab: AR(1) noise, no trend
  function rng(seed){ let s=seed>>>0; return ()=>{ s=(s+0x6D2B79F5)>>>0; let t=s; t=Math.imul(t^t>>>15,t|1); t^=t+Math.imul(t^t>>>7,t|61); return ((t^t>>>14)>>>0)/4294967296; }; }
  function gauss(r){ return Math.sqrt(-2*Math.log(1-r()))*Math.cos(2*Math.PI*r()); }
  function falseAlarm(phi,n,trials,corr,trend=0,seed=7){
    const r=rng(seed); let hit=0; const t=Array.from({length:n},(_,i)=>i);
    for(let k=0;k<trials;k++){ const y=[]; let e=gauss(r); for(let i=0;i<n;i++){ e=phi*e+Math.sqrt(1-phi*phi)*gauss(r); y.push(e+trend*i);} if(mannKendall(y,t,0.05,corr).sig) hit++; }
    return hit/trials;
  }
  function parseCSV(text){
    const rows=text.trim().split(/\r?\n/).map(l=>l.split(/[,;\t]/).map(s=>s.trim())); const out=[];
    for(const r of rows){ const a=parseFloat(r[0]), b=parseFloat(r[1]); if(isFinite(a)&&isFinite(b)) out.push([a,b]); } return out; }
  return {analyze,mannKendall,leadLabel,score,bh,falseAlarm,parseCSV,normCdf,median,mean};
})();
if (typeof module !== 'undefined') module.exports = ATHAR;
