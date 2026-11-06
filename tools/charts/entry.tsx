import React, { Component, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { MotionConfig, useReducedMotion } from 'motion/react';
import { BarChart } from './bklit/bar-chart';
import { Bar } from './bklit/bar';
import { BarXAxis } from './bklit/bar-x-axis';
import { Grid } from './bklit/grid';
import { ChartTooltip } from './bklit/tooltip/chart-tooltip';

const rupees = (value:number) => new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(value);
import { normalise } from './data.cjs';
class Recovery extends Component<any,any> {
  state={failed:false};
  static getDerivedStateFromError(){return{failed:true};}
  componentDidCatch(){this.props.recover();}
  render(){return this.state.failed?null:this.props.children;}
}
function Cashflow({data,ready}:any){
 const reduced=useReducedMotion();
 useEffect(()=>{ready();},[data]);
 return <MotionConfig reducedMotion="user"><div role="img" aria-label="Monthly cash flow chart: money received and spent. Exact figures follow below.">
 <BarChart data={data} xDataKey="month" aspectRatio="2 / 1" barWidth={data.length===1?120:undefined} animationDuration={reduced?0:450} margin={{top:18,right:15,bottom:35,left:15}}>
 <Grid horizontal numTicksRows={4}/><Bar dataKey="inflow" fill="var(--chart-line-primary)" lineCap="round"/><Bar dataKey="outflow" fill="var(--chart-line-secondary)" lineCap="round"/><BarXAxis/><ChartTooltip showDatePill={false} content={({point}:any)=><div className="hisab-chart-tooltip"><strong>{point.month}</strong><p>Received: {rupees(point.inflow)}</p><p>Spent: {rupees(point.outflow)}</p><p>Net: {rupees(point.inflow-point.outflow)}</p></div>}/>
 </BarChart></div><details className="cashflow-values"><summary>View exact monthly figures</summary><table><caption>Money received, spent and net cash flow</caption><thead><tr><th scope="col">Month</th><th scope="col">Received</th><th scope="col">Spent</th><th scope="col">Net</th></tr></thead><tbody>{data.map((row:any,i:number)=><tr key={i}><th scope="row">{row.month}</th><td>{rupees(row.inflow)}</td><td>{rupees(row.outflow)}</td><td>{rupees(row.inflow-row.outflow)}</td></tr>)}</tbody></table></details></MotionConfig>;
}
function install(){
 const app=(window as any).merchantApp;
 if(!app)return;
 const original=app.renderCashflowChart.bind(app);
 let root:any,host:HTMLElement;
 app.renderCashflowChart=(input:any)=>{
  original(input);
  const fallback=document.getElementById('cashflowChartSvg');
  if(!fallback)return;
  const data=normalise(input);
  if(!host){host=document.createElement('div');host.className='hisab-bklit';fallback.before(host);root=createRoot(host);}
  host.hidden=!data.length;fallback.hidden=false;
  if(!data.length){root.render(null);return;}
  const recover=()=>{host.hidden=true;fallback.hidden=false;};
  try{root.render(<Recovery key={JSON.stringify(data)} recover={recover}><Cashflow data={data} ready={()=>{fallback.hidden=true;}}/></Recovery>);}catch{recover();}
 };
 if(app.dashboardData)app.renderCashflowChart(app.dashboardData.cashflow||[]);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
