const MONTHS=["","Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"],$=s=>document.querySelector(s);
const CITY=window.TCESP_CITY,OWNER="transparencia-sp",APP_VERSION="v1.0-central";
if(!CITY)throw Error("Município não configurado.");
const DATA_BASE=`https://raw.githubusercontent.com/${OWNER}/${CITY.repo}/main/`;
const DBN=`tcesp-central-${CITY.id}-v1`,STORE="dados",KEY="base";
let tab="painel",db,compareReal=false,renderToken=0,selectedYear=null,yearChangeToken=0;
function idbOpen(){return new Promise((res,rej)=>{let r=indexedDB.open(DBN,1);r.onupgradeneeded=()=>r.result.createObjectStore(STORE);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
async function idbGet(){let d=await idbOpen();return new Promise((res,rej)=>{let r=d.transaction(STORE).objectStore(STORE).get(KEY);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
async function save(){let d=await idbOpen();return new Promise((res,rej)=>{let r=d.transaction(STORE,"readwrite").objectStore(STORE).put(db,KEY);r.onsuccess=()=>res();r.onerror=()=>rej(r.error)})}
function brl(v){return new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(v||0)} function n(v){return +v||0} function esc(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}
function orgMatch(raw,filter){if(filter==="Todos")return true;let o=String(raw||"").toUpperCase();if(filter==="Prefeitura")return o.includes("PREFEITURA");if(filter==="Câmara")return o.includes("CÂMARA")||o.includes("CAMARA");return true}
function queryValue(){return $("#q").value.trim().toLocaleLowerCase("pt-BR")}
function periodFilt(arr,withOrg=false){let m=+$("#mes").value,o=$("#orgao").value;return arr.filter(x=>x.ano==+$("#ano").value&&(!m||x.mesNum==m)&&(!withOrg||orgMatch(x.orgao,o)))}
function baseFilt(arr,withOrg=false){let q=queryValue(),rows=periodFilt(arr,withOrg);return q?rows.filter(x=>JSON.stringify(x).toLocaleLowerCase("pt-BR").includes(q)):rows}
function evSums(d){let e={};d.forEach(x=>e[x.evento]=(e[x.evento]||0)+n(x.valor));return e} function net(e){return n(e.Empenhado)+n(e.Reforço)-n(e.Anulação)}
function supplierKey(x){return x.fornecedorId||("NOME:"+(x.fornecedor||"(sem nome)"))}
function supplierGroups(d){let g={};d.forEach(x=>{let id=supplierKey(x),k=id;g[k]??={id,nome:x.fornecedor||"(sem nome)",e:{}};if((x.fornecedor||"").length>g[k].nome.length)g[k].nome=x.fornecedor;g[k].e[x.evento]=(g[k].e[x.evento]||0)+n(x.valor)});return Object.values(g)}
function analysisContext(d,r){let query=$("#q").value.trim();if(!query)return {kind:"general",query:""};let q=query.toLocaleLowerCase("pt-BR"),matches=supplierGroups(d).filter(g=>(g.nome+" "+g.id).toLocaleLowerCase("pt-BR").includes(q));if(matches.length===1)return {kind:"supplier",query,supplier:matches[0]};if(d.length&&!r.length)return {kind:"expenses",query};if(r.length&&!d.length)return {kind:"revenues",query};if(d.length||r.length)return {kind:"mixed",query};return {kind:"empty",query}}
function currentViewData(){let d=baseFilt(db.despesas,true),r=baseFilt(db.receitas,false),ctx=analysisContext(d,r);if(ctx.kind==="supplier")d=d.filter(x=>supplierKey(x)===ctx.supplier.id);return {d,r,ctx}}
function restoreGeneralView(focusSearch=false){let q=$("#q");q.value="";$("#clearQ").hidden=true;clearTimeout(searchTimer);try{render();let stuck=!$("#analysisScope").hidden||(tab==="painel"&&($("#painel").textContent.includes("Gasto selecionado")||$("#painel").textContent.includes("Composição dos pagamentos")));if(stuck){location.reload();return}}catch(e){console.warn("Falha ao restaurar o panorama geral",e);location.reload();return}if(focusSearch)q.focus()}
function clearSearch(){restoreGeneralView(true)}
function syncYears(){
  let years=[...new Set([...(db?.exercicios||[]),...(db?.despesas||[]).map(x=>+x.ano),...(db?.receitas||[]).map(x=>+x.ano)])].filter(Number.isFinite).sort((a,b)=>b-a);
  db.exercicios=years;
  let sel=$("#ano"),domYear=+sel.value,cur=(selectedYear&&years.includes(selectedYear))?selectedYear:(domYear&&years.includes(domYear)?domYear:(years[0]||new Date().getFullYear()));
  sel.innerHTML=years.map(y=>`<option value="${y}">${y}</option>`).join("");
  if(years.includes(cur)){sel.value=String(cur);selectedYear=cur}
  else if(years.length){sel.value=String(years[0]);selectedYear=years[0]}
}
function renderAnalysisScope(view){let {d,r,ctx}=view||currentViewData(),el=$("#analysisScope");if(ctx.kind==="general"){el.hidden=true;el.innerHTML="";return}let label="Pesquisa aplicada",title=`“${esc(ctx.query)}”`,detail=`${d.length.toLocaleString("pt-BR")} registros de despesa e ${r.length.toLocaleString("pt-BR")} de receita encontrados.`;if(ctx.kind==="supplier"){label="Análise individual do gasto";title=esc(ctx.supplier.nome);detail=(String(ctx.supplier.id).startsWith("NOME:")?"Sem identificação informada":esc(ctx.supplier.id))+" • títulos, indicadores e gráficos adaptados ao credor selecionado."}else if(ctx.kind==="empty")detail="Nenhum registro encontrado com os filtros atuais.";el.hidden=false;el.innerHTML=`<div><small>${label}</small><strong>${title}</strong><small>${detail}</small></div><button id="scopeClear" type="button">Voltar ao panorama geral</button>`;$("#scopeClear").onclick=clearSearch}
function cards(view){let {d,r,ctx}=view||currentViewData(),e=evSums(d),rec=r.reduce((a,x)=>a+n(x.valor),0),nl=net(e),saldo=rec-nl,expenseMode=ctx.kind==="supplier"||ctx.kind==="expenses",metrics=expenseMode?[["Empenhado",e.Empenhado],["Reforço",e.Reforço],["Anulação",e.Anulação],["Empenho líquido",nl],["Liquidado",e["Valor Liquidado"]],["Pago",e["Valor Pago"]]]:[["Receita",rec],["Empenhado",e.Empenhado],["Reforço",e.Reforço],["Anulação",e.Anulação],["Empenho líquido",nl],["Liquidado",e["Valor Liquidado"]],["Pago",e["Valor Pago"]],["Receita − empenho líquido",saldo]];$("#cards").innerHTML=metrics.map(x=>`<div class="metric card ${(x[0]==="Empenho líquido"||x[0]==="Receita − empenho líquido")?'emph':''}"><small>${x[0]}</small><strong>${brl(x[1])}</strong></div>`).join("")}
function canvasSetup(c){let r=c.getBoundingClientRect(),dpr=devicePixelRatio||1;c.width=r.width*dpr;c.height=r.height*dpr;let x=c.getContext("2d");x.scale(dpr,dpr);return {x,w:r.width,h:r.height}}
function pie(c,data){let {x,w,h}=canvasSetup(c),tot=data.reduce((a,b)=>a+b.v,0),cx=w*.38,cy=h*.48,R=Math.min(w,h)*.32,a=-Math.PI/2,colors=["#1565c0","#ef5350","#f9a825","#2e7d32","#7e57c2","#ef6c00","#00838f","#d81b60","#6d4c41","#546e7a","#43a047"];data.forEach((z,i)=>{let da=tot?z.v/tot*Math.PI*2:0;x.beginPath();x.moveTo(cx,cy);x.arc(cx,cy,R,a,a+da);x.closePath();x.fillStyle=colors[i%colors.length];x.fill();a+=da});x.font="11px Segoe UI";data.slice(0,11).forEach((z,i)=>{let yy=18+i*25,xx=w*.72;x.fillStyle=colors[i%colors.length];x.fillRect(xx,yy,10,10);x.fillStyle="#26333d";let nm=z.n.length>24?z.n.slice(0,23)+"…":z.n;x.fillText(nm,xx+15,yy+9);x.fillStyle="#66727e";x.fillText((tot?z.v/tot*100:0).toFixed(1).replace(".",",")+"%",xx+15,yy+21)})}
function lines(c,series){let {x,w,h}=canvasSetup(c),pad={l:55,r:15,t:18,b:35},vals=series.flatMap(s=>s.v),max=Math.max(...vals,1),min=Math.min(0,...vals),colors=["#17324d","#2f6fa5","#8b5e3c"];x.font="10px Segoe UI";x.strokeStyle="#dfe5e9";for(let i=0;i<=4;i++){let y=pad.t+(h-pad.t-pad.b)*i/4;x.beginPath();x.moveTo(pad.l,y);x.lineTo(w-pad.r,y);x.stroke();let v=max-(max-min)*i/4;x.fillStyle="#66727e";x.fillText((v/1e6).toFixed(1)+" mi",3,y+3)}let months=Array.from({length:12},(_,i)=>i+1).filter(m=>!+$("#mes").value||m==+$("#mes").value);months.forEach((m,i)=>{let xx=pad.l+(w-pad.l-pad.r)*(months.length===1?.5:i/(months.length-1));x.fillStyle="#66727e";x.fillText(MONTHS[m].slice(0,3),xx-8,h-12)});series.forEach((s,si)=>{x.strokeStyle=colors[si];x.lineWidth=2;x.beginPath();s.v.forEach((v,i)=>{let xx=pad.l+(w-pad.l-pad.r)*(s.v.length===1?.5:i/(s.v.length-1)),yy=pad.t+(max-v)/(max-min||1)*(h-pad.t-pad.b);i?x.lineTo(xx,yy):x.moveTo(xx,yy)});x.stroke()})}
function bars(c,data){let {x,w,h}=canvasSetup(c),pad={l:160,r:15,t:10,b:15},max=Math.max(...data.map(z=>z.v),1),bh=(h-pad.t-pad.b)/data.length*.65,gap=(h-pad.t-pad.b)/data.length;x.font="10px Segoe UI";data.forEach((z,i)=>{let y=pad.t+i*gap;x.fillStyle="#2f6fa5";x.fillRect(pad.l,y,(w-pad.l-pad.r)*z.v/max,bh);x.fillStyle="#26333d";let nm=z.n.length>24?z.n.slice(0,23)+"…":z.n;x.fillText(nm,3,y+bh*.75);x.fillText((z.v/1e6).toFixed(2).replace(".",",")+" mi",pad.l+4,y+bh*.75)})}
function annualBars(c,rows){let {x,w,h}=canvasSetup(c),pad={l:54,r:12,t:24,b:42},vals=rows.flatMap(z=>[z.rec,z.net,z.paid]),max=Math.max(...vals,1),colors=["#17324d","#2f6fa5","#8b5e3c"],gw=(w-pad.l-pad.r)/Math.max(rows.length,1),bw=Math.max(5,Math.min(18,gw*.22));x.font="10px Segoe UI";x.strokeStyle="#dfe5e9";for(let i=0;i<=4;i++){let y=pad.t+(h-pad.t-pad.b)*i/4;x.beginPath();x.moveTo(pad.l,y);x.lineTo(w-pad.r,y);x.stroke();x.fillStyle="#66727e";x.fillText(((max*(4-i)/4)/1e6).toFixed(0)+" mi",3,y+3)}rows.forEach((z,i)=>{let cx=pad.l+gw*(i+.5);[z.rec,z.net,z.paid].forEach((v,j)=>{let bh=(h-pad.t-pad.b)*v/max;x.fillStyle=colors[j];x.fillRect(cx+(j-1)*bw-bw*.45,h-pad.b-bh,bw*.9,bh)});x.fillStyle="#66727e";x.fillText(String(z.y),cx-12,h-17)});[["Receita",colors[0]],["Emp. líquido",colors[1]],["Pago",colors[2]]].forEach((z,i)=>{let xx=pad.l+i*105;x.fillStyle=z[1];x.fillRect(xx,5,10,10);x.fillStyle="#26333d";x.fillText(z[0],xx+14,14)})}
function growthLines(c,rows){let {x,w,h}=canvasSetup(c),pad={l:48,r:12,t:24,b:42},vals=rows.flatMap(z=>[z.recG,z.paidG]).filter(Number.isFinite);if(!vals.length)return;let max=Math.max(5,...vals),min=Math.min(-5,...vals),colors=["#17324d","#8b5e3c"],gw=(w-pad.l-pad.r)/Math.max(rows.length-1,1);x.font="10px Segoe UI";x.strokeStyle="#dfe5e9";for(let i=0;i<=4;i++){let y=pad.t+(h-pad.t-pad.b)*i/4,v=max-(max-min)*i/4;x.beginPath();x.moveTo(pad.l,y);x.lineTo(w-pad.r,y);x.stroke();x.fillStyle="#66727e";x.fillText(v.toFixed(0)+"%",3,y+3)}rows.forEach((z,i)=>{let xx=pad.l+gw*i;x.fillStyle="#66727e";x.fillText(String(z.y),xx-12,h-17)});[["Receita",'recG'],["Pago",'paidG']].forEach((q,si)=>{x.strokeStyle=colors[si];x.lineWidth=2;x.beginPath();let started=false;rows.forEach((z,i)=>{let v=z[q[1]];if(!Number.isFinite(v))return;let xx=pad.l+gw*i,yy=pad.t+(max-v)/(max-min||1)*(h-pad.t-pad.b);started?x.lineTo(xx,yy):(x.moveTo(xx,yy),started=true)});x.stroke();x.fillStyle=colors[si];x.fillRect(pad.l+si*90,5,10,10);x.fillStyle="#26333d";x.fillText(q[0],pad.l+14+si*90,14)})}
function paymentGroupsByCommitment(rows){let g={};rows.filter(x=>x.evento==="Valor Pago").forEach(x=>{let id=x.empenho||"(sem número informado)";g[id]??={id,n:"Empenho "+id,v:0,count:0};g[id].v+=n(x.valor);g[id].count++});return Object.values(g).sort((a,b)=>b.v-a.v)}
function topWithOther(rows,limit,label){let top=rows.slice(0,limit).map(x=>({...x})),other=rows.slice(limit).reduce((a,x)=>a+x.v,0);if(other)top.push({n:label,v:other});return top}
function monthlyValues(rows,months,kind){return months.map(m=>{let monthRows=rows.filter(x=>x.mesNum==m);if(kind==="rec")return monthRows.reduce((a,x)=>a+n(x.valor),0);let e=evSums(monthRows);if(kind==="net")return net(e);if(kind==="liq")return n(e["Valor Liquidado"]);return n(e["Valor Pago"])})}
function paymentDateValue(raw,row){
  const s=String(raw||"").trim();
  let m=s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})(?:\D|$)/);
  if(m)return Date.UTC(+m[3],+m[2]-1,+m[1]);
  m=s.match(/^(\d{4})[\/.-](\d{1,2})[\/.-](\d{1,2})(?:\D|$)/);
  if(m)return Date.UTC(+m[1],+m[2]-1,+m[3]);
  const t=Date.parse(s);
  if(Number.isFinite(t))return t;
  const y=+(row?.ano||0),mo=+(row?.mesNum||0);
  return y&&mo?Date.UTC(y,mo-1,1):0;
}
function chronologicalCompare(a,b){
  const da=paymentDateValue(a.data,a),dbv=paymentDateValue(b.data,b);
  if(da!==dbv)return da-dbv;
  const ma=+(a.mesNum||0),mb=+(b.mesNum||0);
  if(ma!==mb)return ma-mb;
  return String(a.empenho||"").localeCompare(String(b.empenho||""),"pt-BR",{numeric:true})||n(a.valor)-n(b.valor);
}
function normalizedName(row){return String(row?.fornecedor||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase()}
function expenseSector(row){let t=normalizedName(row);if(/FOLHA DE PAGAMENTO|PAGAMENTOS[- ]SERVIDORES|\bSALARI|\bREMUNERAC|13O?\s+SALARIO|SUBSIDIOS? DE VEREADORES/.test(t))return "Folha de pagamento";if(/LIMPEZA PUBLICA|VARRI|COLETA.*(LIXO|RESIDU)|LIXO|RESIDU|ATERRO|ROCAD/.test(t))return "Limpeza pública";if(/SAUDE|SALUT|MEDIC|HOSPITAL|CIRURG|FARMAC|DROGARIA|ODONT|FISIO|LABORAT|AMBULAN|CLINIC|RADIOLOG|SANTA CASA|ENFERMAG/.test(t))return "Saúde";if(/EDUCAC|EDUCACIONAL|ESCOLA|CRECHE|MERENDA|PEDAGOG|MATERIAL ESCOLAR|FUNDEB/.test(t))return "Educação";if(/AUTO POSTO|POSTO .*COMBUST|COMBUST|AUTO PEC|PNEU|OFICINA|TRATOR/.test(t))return "Frota e combustíveis";if(/ENGENHARIA|CONSTRUT|PAVIMENT|ASFALTO|\bOBRAS\b|CONCRETO|MATERIAL DE CONSTRU/.test(t))return "Obras e infraestrutura";if(/ASSISTENCIA SOCIAL|ASSISTENCIAL|ASILO|CRIANCA|ADOLESCENTE|IDOSO/.test(t))return "Assistência social";if(/CULTUR|EVENTO|ARTISTIC|PRODUCOES|FESTA|SHOW|MUSIC/.test(t))return "Cultura e eventos";if(/SOFTWARE|TELEFONICA|CORREIOS|ASSESSORIA|CONSULTORIA|CONTABIL|PUBLICIDADE|BANCO DO BRASIL/.test(t))return "Administração e serviços";return "Outros / não classificados"}
function sectorComposition(rows){let g={};rows.filter(x=>x.evento==="Valor Pago").forEach(x=>{let k=expenseSector(x);g[k]=(g[k]||0)+n(x.valor)});return Object.entries(g).map(([n,v])=>({n,v})).filter(x=>x.v>0).sort((a,b)=>b.v-a.v)}
function travelType(row){let t=normalizedName(row);if(/\bDIARIAS?\b/.test(t))return "Diária";if(/HOTEL|HOTELEIR|POUSADA|PASSAGEM|TRANSPORTADORA TURISTICA|TRANSPORTES E TURISMO|AGENCIA.*VIAG|\bVIAGENS?\b|AEREOS? LTDA/.test(t))return "Viagem";return ""}
function travelRows(){return baseFilt(db.despesas,true).filter(x=>x.evento==="Valor Pago"&&travelType(x)).sort((a,b)=>paymentDateValue(b.data)-paymentDateValue(a.data)||n(b.valor)-n(a.valor))}
function revenueCompositionRows(rows){let g={};rows.forEach(r=>{let k=revenueCategory(r);g[k]=(g[k]||0)+n(r.valor)});return Object.entries(g).map(([n,v])=>({n,v})).filter(x=>x.v>0).sort((a,b)=>b.v-a.v)}
function auditDateParts(row){
  const s=String(row?.data||"").trim();
  let m=s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})(?:\D|$)/);
  if(m)return {y:+m[3],m:+m[2],d:+m[1],ts:Date.UTC(+m[3],+m[2]-1,+m[1])};
  m=s.match(/^(\d{4})[\/.\-](\d{1,2})[\/.\-](\d{1,2})(?:\D|$)/);
  if(m)return {y:+m[1],m:+m[2],d:+m[3],ts:Date.UTC(+m[1],+m[2]-1,+m[3])};
  const t=Date.parse(s);
  if(Number.isFinite(t)){const z=new Date(t);return {y:z.getUTCFullYear(),m:z.getUTCMonth()+1,d:z.getUTCDate(),ts:Date.UTC(z.getUTCFullYear(),z.getUTCMonth(),z.getUTCDate())}}
  return null;
}
function auditDateKey(row){const p=auditDateParts(row);return p?`${p.y}-${String(p.m).padStart(2,"0")}-${String(p.d).padStart(2,"0")}`:String(row?.data||"sem-data")}
function displaySupplierId(id){return String(id||"").startsWith("NOME:")?"Sem identificação informada":String(id||"Sem identificação informada")}
function aliasesForSupplier(key,rows=db.despesas){return [...new Set(rows.filter(x=>supplierKey(x)===key).map(x=>x.fornecedor).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"pt-BR"))}
function annualSupplierSummary(key,org){
  const rows=db.despesas.filter(x=>supplierKey(x)===key&&orgMatch(x.orgao,org));
  const ys=[...new Set(rows.map(x=>+x.ano))].filter(Boolean).sort((a,b)=>b-a);
  return ys.map(y=>{const yr=rows.filter(x=>+x.ano===y),e=evSums(yr),payments=yr.filter(x=>x.evento==="Valor Pago");return {y,net:net(e),liq:n(e["Valor Liquidado"]),paid:n(e["Valor Pago"]),payments:payments.length,commitments:new Set(yr.map(x=>x.empenho).filter(Boolean)).size}})
}
function showPaymentDetails(key){
  const y=+$("#ano").value,m=+$("#mes").value,org=$("#orgao").value;
  const currentRows=(tab==="auditoria"?db.despesas.filter(x=>+x.ano===y&&orgMatch(x.orgao,org)):periodFilt(db.despesas,true)).filter(x=>supplierKey(x)===key),group=supplierGroups(currentRows)[0]||supplierGroups(db.despesas.filter(x=>supplierKey(x)===key))[0]||{nome:"Credor não localizado",id:key,e:{}};
  const allRows=db.despesas.filter(x=>supplierKey(x)===key&&orgMatch(x.orgao,org)),aliases=aliasesForSupplier(key,db.despesas),annual=annualSupplierSummary(key,org),historicalPaid=annual.reduce((a,z)=>a+z.paid,0),historicalNet=annual.reduce((a,z)=>a+z.net,0),historicalPayments=annual.reduce((a,z)=>a+z.payments,0),historicalCommitments=new Set(allRows.map(x=>`${x.ano}:${x.empenho}`).filter(x=>!x.endsWith(':'))).size;
  const payments=currentRows.filter(x=>x.evento==="Valor Pago").sort((a,b)=>paymentDateValue(b.data)-paymentDateValue(a.data)||n(b.valor)-n(a.valor)),commitments=paymentGroupsByCommitment(currentRows),e=evSums(currentRows),period=`${tab==="auditoria"?"Ano inteiro":(m?MONTHS[m]:"Ano inteiro")} de ${y} • ${org}`;
  $("#paymentDetailTitle").textContent=group.nome;
  const aliasHtml=aliases.length?aliases.map(esc).join(" · "):"—";
  const annualRows=annual.map(z=>`<tr><td>${z.y}</td><td class="num">${brl(z.net)}</td><td class="num">${brl(z.liq)}</td><td class="num">${brl(z.paid)}</td><td class="num">${z.commitments.toLocaleString("pt-BR")}</td><td class="num">${z.payments.toLocaleString("pt-BR")}</td></tr>`).join("");
  const summaryRows=commitments.map(z=>`<tr><td>${esc(z.id)}</td><td>${z.count.toLocaleString("pt-BR")}</td><td class="num">${brl(z.v)}</td><td>${commitmentLink(z.id,y,"Abrir TCESP")}</td></tr>`).join("");
  const paymentRows=payments.map(x=>`<tr><td>${esc(x.data||"—")}</td><td>${esc(x.mes||MONTHS[x.mesNum]||"—")}</td><td>${esc(x.empenho||"—")}</td><td>${esc(x.orgao||"—")}</td><td class="num">${brl(x.valor)}</td></tr>`).join("");
  $("#paymentDetailBody").innerHTML=`<div class="payment-detail"><p class="detail-context"><strong>${esc(displaySupplierId(group.id||key))}</strong> • ${esc(period)}.</p><section class="dossier-identity"><small>Nomes encontrados para a mesma identificação na base</small><strong>${aliasHtml}</strong></section><div class="detail-metrics dossier-metrics">${[["Pago no período",brl(e["Valor Pago"])],["Pago no histórico",brl(historicalPaid)],["Empenho líquido histórico",brl(historicalNet)],["Exercícios ativos",annual.length.toLocaleString("pt-BR")],["Empenhos no histórico",historicalCommitments.toLocaleString("pt-BR")],["Pagamentos no histórico",historicalPayments.toLocaleString("pt-BR")]].map(z=>`<div class="detail-metric"><small>${z[0]}</small><strong>${z[1]}</strong></div>`).join("")}</div><section class="detail-section"><h3>Histórico por exercício</h3><p>Consolidação pelo identificador do credor; alterações de grafia permanecem agrupadas.</p><div class="detail-tablewrap"><table class="detail-table"><thead><tr><th>Ano</th><th>Emp. líquido</th><th>Liquidado</th><th>Pago</th><th>Empenhos</th><th>Pagamentos</th></tr></thead><tbody>${annualRows||'<tr><td colspan="6">Sem histórico.</td></tr>'}</tbody></table></div></section><section class="detail-section"><h3>Resumo dos pagamentos por empenho — período selecionado</h3><p>${commitments.length.toLocaleString("pt-BR")} empenhos e ${payments.length.toLocaleString("pt-BR")} lançamentos de pagamento.</p><div class="detail-tablewrap"><table class="detail-table"><thead><tr><th>Nº do empenho</th><th>Lançamentos</th><th>Total pago</th><th>Consulta</th></tr></thead><tbody>${summaryRows||'<tr><td colspan="4">Nenhum pagamento no período.</td></tr>'}</tbody></table></div></section><section class="detail-section"><h3>Lançamentos do período</h3><p>Relação individual para cotejo com a base do TCESP.</p><div class="detail-tablewrap"><table class="detail-table"><thead><tr><th>Data</th><th>Mês</th><th>Nº do empenho</th><th>Órgão</th><th>Valor pago</th></tr></thead><tbody>${paymentRows||'<tr><td colspan="5">Nenhum pagamento no período.</td></tr>'}</tbody></table></div></section><p class="detail-note">A ficha consolida os registros disponíveis no painel pelo identificador do credor. Ela não informa, por si, objeto contratado, modalidade de licitação, número do contrato ou regularidade do pagamento.</p></div>`;
  let dlg=$("#paymentDialog");if(typeof dlg.showModal==="function"){if(!dlg.open)dlg.showModal()}else dlg.setAttribute("open","")
}
function renderPanel(view){
  const token=++renderToken,selectedYear=+$("#ano").value;
  let {d,r,ctx}=view||currentViewData(),individual=ctx.kind==="supplier";
  if(ctx.kind==="empty"){$("#painel").innerHTML=`<section class="empty-panel card"><strong>Nenhum registro encontrado.</strong><p>Limpe a pesquisa para voltar ao panorama geral.</p><button id="emptyClear" type="button">Limpar pesquisa</button></section>`;$("#emptyClear").onclick=clearSearch;return}
  let groups=supplierGroups(d);
  let paid=groups.map(g=>({n:g.nome,v:n(g.e["Valor Pago"]),id:g.id})).filter(x=>x.v>0).sort((a,b)=>b.v-a.v);
  let ranked=paid.slice(0,40),commitments=individual?paymentGroupsByCommitment(d).filter(x=>x.v>0):[];
  let pieData=individual?topWithOther(commitments,10,"Demais empenhos"):topWithOther(paid,10,"Demais gastos");
  let barData=individual?commitments.slice(0,40):ranked;
  let months=Array.from({length:12},(_,i)=>i+1).filter(m=>!+$("#mes").value||m==+$("#mes").value);
  let expenseMode=individual||ctx.kind==="expenses";
  let lineSeries=expenseMode?[{v:monthlyValues(d,months,"net")},{v:monthlyValues(d,months,"liq")},{v:monthlyValues(d,months,"paid")}]:[{v:monthlyValues(r,months,"rec")},{v:monthlyValues(d,months,"net")},{v:monthlyValues(d,months,"paid")}];
  let supplierName=individual?ctx.supplier.nome:"",shown=Math.min(40,paid.length),barShown=Math.min(40,barData.length);
  let generalPaidTitle=paid.length>40?"40 maiores gastos pagos":shown===1?"1 gasto pago":shown?`${shown} gastos pagos`:"Gastos pagos";
  let generalRankTitle=paid.length>40?"Ranking — 40 maiores gastos por valor pago":shown===1?"Ranking — 1 gasto por valor pago":shown?`Ranking — ${shown} gastos por valor pago`:"Ranking de gastos por valor pago";
  let individualPieText=!commitments.length?"Nenhum pagamento encontrado no filtro atual.":commitments.length===1?"1 empenho com pagamento, conforme o filtro atual.":`${Math.min(10,commitments.length)} maiores empenhos${commitments.length>10?" + demais":""}, conforme o filtro atual.`;
  let generalPieText=!paid.length?"Nenhum pagamento encontrado no filtro atual.":paid.length===1?"1 gasto por credor, conforme o filtro atual.":`${Math.min(10,paid.length)} gastos por credor${paid.length>10?" — 10 maiores + demais":""}, conforme o filtro atual.`;
  let pieTitle=individual?`Composição dos pagamentos — ${esc(supplierName)} — ${selectedYear}`:`Gastos pagos por credor — ${selectedYear}`;
  let pieText=individual?individualPieText:generalPieText;
  let lineTitle=expenseMode?`Evolução mensal dos gastos${individual?" — "+esc(supplierName):" encontrados"} — ${selectedYear}`:`Receita × empenho líquido × pago — ${selectedYear}`;
  let lineText=expenseMode?"Empenho líquido, liquidado e pago no resultado atual.":"Evolução mensal. Empenho líquido = empenhado + reforço − anulação.";
  let legend=expenseMode?"Empenho líquido • Liquidado • Pago":"Receita • Empenho líquido • Pago";
  let barTitle=individual?`Pagamentos por empenho — ${esc(supplierName)} — ${selectedYear}`:`${generalPaidTitle} — ${selectedYear}`;
  let barText=individual?`${barShown} ${barShown===1?"empenho exibido":"empenhos exibidos"}, ${barShown===1?"ordenado":"ordenados"} pelo total pago.`:"Ranking por credor, agrupado prioritariamente pelo identificador/CNPJ.";
  let rankTitle=individual?`Gasto selecionado — ${selectedYear}`:`${generalRankTitle} — ${selectedYear}`;
  let rankText=ranked.length?"Clique no nome do credor para conferir todos os pagamentos e números de empenho.":"Nenhum pagamento encontrado no filtro atual.";
  let barHeight=Math.max(330,Math.min(1040,barData.length*25+40));
  let revComp=!individual?revenueCompositionRows(r):[],sectorComp=!individual?sectorComposition(d):[],sectorHeight=Math.max(330,sectorComp.length*34+40);
  $("#painel").innerHTML=`<section class="chartcard card"><h3>${pieTitle}</h3><p>${pieText}</p><div class="chartbox"><canvas id="pie"></canvas></div></section><section class="chartcard card"><h3>${lineTitle}</h3><p>${lineText}</p><div class="chartbox"><canvas id="line"></canvas></div><div class="barlegend">${legend}</div></section>${!individual?`<section class="chartcard card"><h3>Composição das receitas — ${selectedYear}</h3><p>Gráfico de pizza pelas descrições de fonte, alínea e subalínea informadas pelo TCESP.</p><div class="chartbox"><canvas id="revenuePie"></canvas></div></section><section class="chartcard card"><h3>Gastos pagos por setor — ${selectedYear}</h3><p>Classificação indicativa pelo nome do credor; consulte a metodologia.</p><div class="chartbox" style="height:${sectorHeight}px"><canvas id="sectorBars"></canvas></div></section>`:""}<section class="chartcard card"><h3>${barTitle}</h3><p>${barText}</p><div class="chartbox" style="height:${barHeight}px"><canvas id="bars"></canvas></div></section><section class="rank card"><h3>${rankTitle}</h3><p>${rankText}</p><div class="rankgrid">${ranked.map((z,i)=>`<div class="rankrow"><span class="badge">${i+1}</span><button class="ranklink" type="button" data-rank-index="${i}">${esc(z.n)}<small>${esc(z.id)}</small><span class="rankaction">Abrir ficha do credor</span></button><b>${brl(z.v)}</b></div>`).join("")}</div></section>`;
  $("#painel").querySelectorAll(".ranklink").forEach(b=>b.addEventListener("click",()=>showPaymentDetails(ranked[+b.dataset.rankIndex].id)));
  requestAnimationFrame(()=>{if(token!==renderToken||selectedYear!==+$("#ano").value)return;if(pieData.length)pie($("#pie"),pieData);lines($("#line"),lineSeries);if(revComp.length)pie($("#revenuePie"),revComp);if(sectorComp.length)bars($("#sectorBars"),sectorComp);if(barData.length)bars($("#bars"),barData)})
}
// O cadastro como pessoa física não comprova vínculo público nem a natureza do pagamento.
function isNaturalPerson(row){return /CPF|PESSOA F[IÍ]SICA/i.test(row.fornecedorId||"")&&!/CNPJ|JUR[IÍ]DICA/i.test(row.fornecedorId||"")}
function tceExpenseUrl(year){return `https://transparencia.tce.sp.gov.br/municipio/${CITY.apiSlug}/${year}/despesas`}
function commitmentLink(emp,year,label){return `<a href="${tceExpenseUrl(year)}" target="_blank" rel="noopener" title="Abra o TCESP e filtre Evento = Valor Liquidado e Nº do empenho = ${esc(emp||'—')}">${esc(label||emp||"Consultar")}</a>`}
function minimumWage(year){return ({2014:724,2015:788,2016:880,2017:937,2018:954,2019:998,2020:1045,2021:1100,2022:1212,2023:1320,2024:1412,2025:1518,2026:1621})[+year]||0}
function monthlyCadenceStats(rows){
  const byMonth=new Map();
  rows.forEach(x=>{const m=+x.mesNum;if(!m)return;const z=byMonth.get(m)||{count:0,total:0};z.count++;z.total+=n(x.valor);byMonth.set(m,z)});
  const months=[...byMonth.keys()].sort((a,b)=>a-b),activeMonths=months.length;
  const span=activeMonths?months[activeMonths-1]-months[0]+1:0;
  const coverage=span?activeMonths/span:0;
  const counts=months.map(m=>byMonth.get(m).count),maxPerMonth=counts.length?Math.max(...counts):0,avgPerMonth=activeMonths?rows.length/activeMonths:0;
  const totals=months.map(m=>byMonth.get(m).total),mean=totals.length?totals.reduce((a,b)=>a+b,0)/totals.length:0;
  const variance=totals.length?totals.reduce((a,v)=>a+(v-mean)*(v-mean),0)/totals.length:0;
  const cv=mean>0?Math.sqrt(variance)/mean:0;
  return {byMonth,months,activeMonths,span,coverage,maxPerMonth,avgPerMonth,cv,meanMonthly:mean};
}
function delegatedActivityLike(rows,distinct,repeatMonths){
  const c=monthlyCadenceStats(rows);
  const continuous=c.activeMonths>=4&&c.span>=4&&c.coverage>=.75;
  const onePerMonth=c.avgPerMonth<=1.35&&c.maxPerMonth<=2;
  const variable=distinct>=3&&repeatMonths/Math.max(c.activeMonths,1)<=.5;
  const enoughHistory=c.activeMonths>=5||(c.activeMonths>=4&&c.coverage===1);
  return {match:continuous&&onePerMonth&&variable&&enoughHistory,stats:c};
}
function monthSetSimilarity(a,b){
  const A=new Set(a||[]),B=new Set(b||[]),inter=[...A].filter(x=>B.has(x)).length,uni=new Set([...A,...B]).size;
  return {overlap:inter,jaccard:uni?inter/uni:0};
}
function delegatedCohortLike(rows,distinct,strongProfiles){
  const c=monthlyCadenceStats(rows);
  const softCadence=c.activeMonths>=3&&c.span>=4&&c.coverage>=.60;
  const concentrated=c.avgPerMonth<=1.70&&c.maxPerMonth<=3;
  const variable=distinct>=2;
  if(!softCadence||!concentrated||!variable||!strongProfiles.length)return {match:false,stats:c};
  const mean=c.meanMonthly||1;
  let best={overlap:0,jaccard:0,ratio:0};
  for(const p of strongProfiles){
    const sim=monthSetSimilarity(c.months,p.months),ratio=p.meanMonthly>0?mean/p.meanMonthly:1;
    if(sim.overlap>best.overlap||(sim.overlap===best.overlap&&sim.jaccard>best.jaccard))best={...sim,ratio};
    if(sim.overlap>=3&&sim.jaccard>=.60&&ratio>=.20&&ratio<=5)return {match:true,stats:c,similarity:sim};
  }
  return {match:false,stats:c,similarity:best};
}
function paymentDayOfMonth(row){
  const s=String(row?.data||"").trim();
  let m=s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})(?:\D|$)/);
  if(m)return +m[1];
  m=s.match(/^(\d{4})[\/.-](\d{1,2})[\/.-](\d{1,2})(?:\D|$)/);
  if(m)return +m[3];
  const t=Date.parse(s);if(Number.isFinite(t))return new Date(t).getUTCDate();
  return null;
}
function shortRecurringSequenceLike(rows){
  const c=monthlyCadenceStats(rows);
  if(c.activeMonths<3||c.activeMonths>4)return {match:false,stats:c};
  const compact=c.span<=c.activeMonths+1&&c.coverage>=.75;
  const concentrated=c.avgPerMonth<=1.35&&c.maxPerMonth<=2;
  if(!compact||!concentrated)return {match:false,stats:c};
  const monthDays=c.months.map(m=>{
    const days=rows.filter(x=>+x.mesNum===m).map(paymentDayOfMonth).filter(Number.isFinite).sort((a,b)=>a-b);
    return days.length?days[Math.floor(days.length/2)]:null;
  }).filter(Number.isFinite);
  const dayAligned=monthDays.length>=3&&(Math.max(...monthDays)-Math.min(...monthDays)<=8);
  const amountAligned=c.cv<=.35;
  const threeMonthRun=c.activeMonths===3&&c.span<=4;
  return {match:compact&&concentrated&&(dayAligned||amountAligned||threeMonthRun),stats:c};
}
function confidenceBand(score){return score>=85?"Muito alta":"Alta"}
const EVENTUAL_MIN_CONFIDENCE=70;
function eventualTriageGroups(){
  const y=+$("#ano").value, org=$("#orgao").value;
  const all=db.despesas.filter(x=>+x.ano===y&&x.evento==="Valor Pago"&&isNaturalPerson(x)&&orgMatch(x.orgao,org)&&n(x.valor)>0);
  const buckets=new Map();
  all.forEach(x=>{let k=supplierKey(x);if(!buckets.has(k))buckets.set(k,{id:k,name:x.fornecedor,year:y,rows:[]});buckets.get(k).rows.push(x)});
  const meta=new Map(),strongProfiles=[];
  for(const g of buckets.values()){
    const byAmount=new Map();
    g.rows.forEach(x=>{const c=Math.round(n(x.valor)*100);if(!byAmount.has(c))byAmount.set(c,new Set());byAmount.get(c).add(+x.mesNum)});
    const repeated=[...byAmount].sort((a,b)=>b[1].size-a[1].size||b[0]-a[0]);
    const top=repeated[0],repeatMonths=top?.[1].size||0,repeatValue=top?top[0]/100:0;
    const months=new Set(g.rows.map(x=>+x.mesNum)).size,distinct=byAmount.size;
    const delegated=delegatedActivityLike(g.rows,distinct,repeatMonths);
    meta.set(g.id,{byAmount,repeated,repeatMonths,repeatValue,months,distinct,delegated});
    if(delegated.match)strongProfiles.push({id:g.id,months:delegated.stats.months,meanMonthly:delegated.stats.meanMonthly||1});
  }

  const out=[];let delegatedExcluded=0,cohortExcluded=0,shortRecurringExcluded=0,lowConfidenceExcluded=0;
  for(const g of buckets.values()){
    const m=meta.get(g.id),{byAmount,repeated,repeatMonths,repeatValue,months,distinct,delegated}=m;
    const stipendLike=repeatMonths>=3&&repeatValue>0&&repeatValue<minimumWage(y)&&repeatMonths/Math.max(months,1)>=.6;
    const regularServiceLike=!stipendLike&&repeatMonths>=3&&repeatMonths/Math.max(months,1)>=.7&&repeated.length<=2;
    if(stipendLike||regularServiceLike)continue;
    const variable=distinct>=2;
    if(g.rows.length<2||!variable)continue;
    if(delegated.match){delegatedExcluded++;continue}
    const cohort=delegatedCohortLike(g.rows,distinct,strongProfiles.filter(p=>p.id!==g.id));
    if(cohort.match){delegatedExcluded++;cohortExcluded++;continue}
    const shortRecurring=shortRecurringSequenceLike(g.rows);
    if(shortRecurring.match){shortRecurringExcluded++;continue}
    let candidates=g.rows.filter(x=>{
      const c=Math.round(n(x.valor)*100), reps=byAmount.get(c)?.size||0;
      if(n(x.valor)<minimumWage(y)&&reps>=3)return false;
      return true;
    });
    if(!candidates.length)continue;
    const total=candidates.reduce((a,x)=>a+n(x.valor),0);
    let confidence=45;
    if(distinct>=3)confidence+=15;
    if(candidates.length>=4)confidence+=10;
    if(repeatMonths<=2)confidence+=10;
    confidence=Math.min(90,confidence);
    if(confidence<EVENTUAL_MIN_CONFIDENCE){lowConfidenceExcluded++;continue}
    out.push({...g,rows:candidates,total,count:candidates.length,confidence,distinct});
  }
  out.delegatedExcluded=delegatedExcluded;
  out.cohortExcluded=cohortExcluded;
  out.shortRecurringExcluded=shortRecurringExcluded;
  out.lowConfidenceExcluded=lowConfidenceExcluded;
  return out.sort((a,b)=>b.total-a.total||a.name.localeCompare(b.name,"pt-BR"));
}
function renderTravel(){
  const groups=eventualTriageGroups();
  const q=queryValue(),m=+$("#mes").value;
  const shown=groups.map(g=>({...g,displayRows:g.rows.filter(x=>(!m||+x.mesNum===m)&&(!q||JSON.stringify(x).toLocaleLowerCase("pt-BR").includes(q)))})).filter(g=>g.displayRows.length||(!m&&!q));
  const ranking=shown.map(g=>({...g,displayTotal:g.displayRows.length?g.displayRows.reduce((a,x)=>a+n(x.valor),0):g.total,displayCount:g.displayRows.length||g.count})).sort((a,b)=>b.displayTotal-a.displayTotal||a.name.localeCompare(b.name,"pt-BR"));

  const grouped=ranking.map((g,rankIndex)=>{
    const rows=(g.displayRows.length?g.displayRows:g.rows).slice().sort(chronologicalCompare);
    return {g,rank:rankIndex+1,rows};
  });
  const detailCount=grouped.reduce((a,z)=>a+z.rows.length,0);
  const rankHtml=ranking.map((g,i)=>`<div class="rankrow"><span class="badge">${i+1}</span><button class="ranklink" data-person-key="${esc(g.id)}">${esc(g.name)}</button><span class="rankmeta">${g.displayCount} lançamento(s) • triagem ${confidenceBand(g.confidence).toLowerCase()}</span><b>${brl(g.displayTotal)}</b></div>`).join("")||"<p>Nenhum padrão eventual com confiança suficiente foi identificado nos filtros atuais.</p>";
  const detailHtml=grouped.map(({g,rank,rows})=>`<section class="person-card card" data-person-rank="${rank}"><div class="person-card-head"><div><strong><span class="person-rank">${rank}º</span> ${esc(g.name)}</strong><span>${rows.length} lançamento(s) • total selecionado ${brl(g.displayTotal)} • triagem ${confidenceBand(g.confidence).toLowerCase()}</span></div></div><div class="tablewrap"><table class="person-table"><thead><tr><th>Data</th><th>Empenho</th><th>Valor do lançamento</th><th>Classificação</th><th>Empenho / liquidação</th></tr></thead><tbody>${rows.map(x=>`<tr><td>${esc(x.data||"—")}</td><td>${esc(x.empenho||"—")}</td><td class="num">${brl(x.valor)}</td><td>Pagamento pessoal eventual — natureza a confirmar</td><td>${commitmentLink(x.empenho,g.year,"Consultar no TCESP")}</td></tr>`).join("")}</tbody></table></div></section>`).join("");

  $("#travelSec").innerHTML=`<div class="travel-hero card"><div class="travel-titleline"><h2>Pagamentos eventuais a pessoas físicas — triagem</h2><span class="version-badge version-card">${APP_VERSION}</span></div><p>Ranking do maior para o menor valor entre os lançamentos que permaneceram após uma triagem conservadora de recorrência e ambiguidade.</p></div>
  <div class="note card"><strong>Leitura correta.</strong> A base do TCESP não informa, com precisão suficiente, a natureza nominal destes pagamentos. Assim, um lançamento selecionado <strong>não deve ser chamado automaticamente de diária</strong>. Pode corresponder, por exemplo, a diária, ressarcimento ou reembolso, alimentação, combustível/deslocamento, adiantamento ou outra verba eventual. O painel publica apenas perfis de confiança alta e retém fora da exposição padrões recorrentes ou ambíguos. Por integridade da análise, a regra detalhada de pontuação não é apresentada na interface. A confirmação depende do Portal da Transparência de ${esc(CITY.nome)} e dos documentos do empenho/liquidação.</div>
  <section class="rank card travel-rank"><h3>Pagamentos pessoais eventuais — total em ordem decrescente</h3><p>Lista de triagem para conferência documental. Ela não define a natureza jurídica ou contábil do pagamento.</p><div class="rankgrid">${rankHtml}</div></section>
  <section class="travel-detail-list"><div class="card travel-list-intro"><h3>Lançamentos selecionados — agrupados por pessoa</h3><p>Os blocos seguem exatamente a ordem do ranking. Dentro de cada pessoa, os lançamentos são mostrados do mais antigo para o mais recente.</p></div>${detailHtml||'<div class="card"><p>Nenhum lançamento.</p></div>'}<div class="card detail-note">Cada pessoa possui tabela própria. O link abre a página oficial de despesas do TCESP no exercício selecionado. Para cotejar, filtre <strong>Evento = Valor Liquidado</strong> e pesquise o número do empenho. A natureza do pagamento deve ser confirmada no Portal da Transparência Municipal.</div></section>`;
  $("#travelSec").querySelectorAll("[data-person-key]").forEach(b=>b.addEventListener("click",()=>showPaymentDetails(b.dataset.personKey)));
  return detailCount;
}
function renderTable(){
  let d=baseFilt(db.despesas,true),r=baseFilt(db.receitas,false),rows=[],heads=[];
  if(tab==="despesas"){heads=["Valor","Mês","Evento","Empenho","Data","Órgão","Credor","Identificação"];rows=d.sort((a,b)=>b.valor-a.valor).map(x=>[brl(x.valor),x.mes,x.evento,x.empenho,x.data,x.orgao,x.fornecedor,x.fornecedorId])}
  if(tab==="receitas"){heads=["Valor","Mês","Fonte","Aplicação","Natureza / alínea","Subalínea"];rows=r.sort((a,b)=>b.valor-a.valor).map(x=>[brl(x.valor),x.mes,x.fonte,x.aplicacao,x.alinea,x.subalinea])}
  if(tab==="gastos"){
    heads=["Gasto / credor","Identificação","Empenhado","Reforço","Anulação","Empenho líquido","Liquidado","Pago"];
    const groups=supplierGroups(d).map(g=>({...g,paid:n(g.e["Valor Pago"])})).sort((a,b)=>b.paid-a.paid||a.nome.localeCompare(b.nome,"pt-BR"));
    $("#thead").innerHTML="<tr>"+heads.map(h=>`<th>${h}</th>`).join("")+"</tr>";
    $("#tbody").innerHTML=groups.map(g=>`<tr><td><button type="button" class="audit-link gasto-dossier" data-gasto-key="${esc(g.id)}">${esc(g.nome)}</button></td><td>${esc(displaySupplierId(g.id))}</td><td>${brl(g.e.Empenhado)}</td><td>${brl(g.e.Reforço)}</td><td>${brl(g.e.Anulação)}</td><td>${brl(net(g.e))}</td><td>${brl(g.e["Valor Liquidado"])}</td><td>${brl(g.e["Valor Pago"])}</td></tr>`).join("");
    $("#tbody").querySelectorAll("[data-gasto-key]").forEach(b=>b.addEventListener("click",()=>showPaymentDetails(b.dataset.gastoKey)));
    return groups.length;
  }
  $("#thead").innerHTML="<tr>"+heads.map(h=>`<th>${h}</th>`).join("")+"</tr>";
  $("#tbody").innerHTML=rows.map(r=>"<tr>"+r.map(v=>`<td>${esc(v)}</td>`).join("")+"</tr>").join("");
  return rows.length
}
function money(s){return +(s||"").replace(/[^\d,-]/g,"").replace(/\./g,"").replace(",",".")}
function auditYearRows(){const y=+$("#ano").value,o=$("#orgao").value;return {y,d:db.despesas.filter(x=>+x.ano===y&&orgMatch(x.orgao,o)),r:db.receitas.filter(x=>+x.ano===y),org:o}}
function auditExcludedSupplier(row){let t=normalizedName(row);return /FOLHA DE PAGAMENTO|PAGAMENTOS[- ]SERVIDORES|ENERGISA|TELEFONICA|TELECOM|CORREIOS|TRIVALE|ROM CARD|INSS|INSTITUTO NACIONAL DO SEGURO SOCIAL|CAIXA ECONOMICA|BANCO DO BRASIL|CAMARA MUNICIPAL|PREFEITURA MUNICIPAL|MUNICIPIO DE ADOLFO/.test(t)}
function referenceDispensationLimit(row){const y=+row.ano,m=+(row.mesNum||auditDateParts(row)?.m||0);if(y<2018)return 8000;if(y===2018&&m&&m<=6)return 8000;if(y<=2023)return 17600;if(y===2024)return 59906.02;if(y===2025)return 62725.59;if(y>=2026)return 65492.11;return 0}
function commitmentAuditRecords(rows){
  const map=new Map();
  rows.forEach(x=>{let k=`${supplierKey(x)}|${x.orgao||""}|${x.empenho||"SEM"}`,z=map.get(k);if(!z){z={key:supplierKey(x),name:x.fornecedor||"(sem nome)",id:x.fornecedorId||"",emp:x.empenho||"—",year:+x.ano,month:+x.mesNum,dates:[],e:{},sample:x};map.set(k,z)}z.e[x.evento]=(z.e[x.evento]||0)+n(x.valor);if(x.data)z.dates.push(x.data)});
  return [...map.values()].map(z=>({...z,net:net(z.e),liq:n(z.e["Valor Liquidado"]),paid:n(z.e["Valor Pago"]),limit:referenceDispensationLimit(z.sample)}));
}
function fragmentationSignals(rows){
  const recs=commitmentAuditRecords(rows).filter(z=>z.net>0&&!auditExcludedSupplier(z.sample)&&z.emp!=="—"),g=new Map();
  recs.forEach(z=>{let a=g.get(z.key);if(!a){a={key:z.key,name:z.name,id:z.id,items:[]};g.set(z.key,a)}a.items.push(z)});
  const out=[];
  for(const a of g.values()){
    const small=a.items.filter(z=>z.limit>0&&z.net<=z.limit),sum=small.reduce((s,z)=>s+z.net,0),maxLimit=Math.max(0,...small.map(z=>z.limit)),near=small.filter(z=>z.limit&&z.net/z.limit>=.8).length;
    const repeated=small.length>=4&&sum>maxLimit*2;
    const dense=small.length>=8&&sum>maxLimit*1.5;
    if(repeated||dense)out.push({...a,count:small.length,total:sum,max:Math.max(0,...small.map(z=>z.net)),near,emps:small.map(z=>z.emp)});
  }
  return out.sort((a,b)=>b.total-a.total||b.count-a.count||a.name.localeCompare(b.name,"pt-BR"));
}
function coincidentPaymentSignals(rows){
  const g=new Map();
  rows.filter(x=>x.evento==="Valor Pago"&&n(x.valor)>0&&auditDateParts(x)).forEach(x=>{const cents=Math.round(n(x.valor)*100),k=`${supplierKey(x)}|${auditDateKey(x)}|${cents}`;let z=g.get(k);if(!z){z={key:supplierKey(x),name:x.fornecedor||"(sem nome)",id:x.fornecedorId||"",date:auditDateKey(x),value:cents/100,rows:[]};g.set(k,z)}z.rows.push(x)});
  return [...g.values()].map(z=>({...z,emps:[...new Set(z.rows.map(x=>x.empenho||"—"))]})).filter(z=>z.rows.length>=2&&z.emps.length>=2).map(z=>({...z,repeated:z.value*(z.rows.length-1)})).sort((a,b)=>b.repeated-a.repeated||b.value-a.value);
}
function qualitySignals(rows,revs){
  const mismatch=rows.filter(x=>{const p=auditDateParts(x);return p&&(+x.ano!==p.y||(+x.mesNum&&+x.mesNum!==p.m))});
  const weekend=rows.filter(x=>x.evento==="Valor Pago").filter(x=>{const p=auditDateParts(x);if(!p)return false;const w=new Date(p.ts).getUTCDay();return w===0||w===6});
  const missingId=rows.filter(x=>!String(x.fornecedorId||"").trim());
  const ids=new Map();rows.forEach(x=>{if(!x.fornecedorId)return;let s=ids.get(x.fornecedorId);if(!s){s=new Set();ids.set(x.fornecedorId,s)}if(x.fornecedor)s.add(x.fornecedor)});const aliases=[...ids.values()].filter(s=>s.size>1).length;
  const exactDup=a=>{let seen=new Set(),c=0;a.forEach(x=>{let k=JSON.stringify(x);if(seen.has(k))c++;else seen.add(k)});return c};
  return {mismatch,weekend,missingId,aliases,exactD:exactDup(rows),exactR:exactDup(revs),negativePaid:rows.filter(x=>x.evento==="Valor Pago"&&n(x.valor)<0),negativeLiq:rows.filter(x=>x.evento==="Valor Liquidado"&&n(x.valor)<0),negativeRev:revs.filter(x=>n(x.valor)<0)};
}
function stageIntegrity(rows){
  const recs=commitmentAuditRecords(rows),tol=.01;
  return {liqAboveNet:recs.filter(z=>z.liq-z.net>tol),paidAboveLiq:recs.filter(z=>z.paid-z.liq>tol),paidWithoutCommitment:recs.filter(z=>z.paid>tol&&z.net<=tol)};
}
function audit(){
  const {y,d,r,org}=auditYearRows(),coverage=[...new Set(d.map(x=>+x.mesNum).filter(Boolean))].sort((a,b)=>a-b),last=coverage.length?Math.max(...coverage):0,partial=coverage.length<12,frag=fragmentationSignals(d),coinc=coincidentPaymentSignals(d),q=qualitySignals(d,r),integ=stageIntegrity(d);
  const fragRows=frag.slice(0,40).map((z,i)=>`<tr><td>${i+1}</td><td><button class="audit-link" type="button" data-dossier-key="${esc(z.key)}">${esc(z.name)}</button><small>${esc(displaySupplierId(z.id||z.key))}</small></td><td class="num">${z.count.toLocaleString("pt-BR")}</td><td class="num">${brl(z.total)}</td><td class="num">${brl(z.max)}</td><td>${z.emps.slice(0,8).map(esc).join(", ")}${z.emps.length>8?` +${z.emps.length-8}`:""}</td></tr>`).join("");
  const coincRows=coinc.slice(0,40).map((z,i)=>`<tr><td>${i+1}</td><td>${esc(z.date)}</td><td><button class="audit-link" type="button" data-dossier-key="${esc(z.key)}">${esc(z.name)}</button></td><td class="num">${brl(z.value)}</td><td class="num">${z.rows.length}</td><td>${z.emps.map(esc).join(", ")}</td><td class="num">${brl(z.repeated)}</td></tr>`).join("");
  const integrityBad=integ.liqAboveNet.length+integ.paidAboveLiq.length+integ.paidWithoutCommitment.length;
  const qualityCards=[
    ["Competência/data divergentes",q.mismatch.length,"Lançamentos cuja data informada não coincide com a competência carregada."],
    ["Pagamentos em fim de semana",q.weekend.length,"Ocorrências para conferência; a data, isoladamente, não indica irregularidade."],
    ["Credor sem identificação",q.missingId.length,"Registros sem CPF/CNPJ ou identificador equivalente na base carregada."],
    ["Identificadores com nomes distintos",q.aliases,"Grafias diferentes agrupadas pelo mesmo identificador."],
    ["Duplicatas exatas — despesas",q.exactD,"Preservadas; a fonte não oferece ID transacional autônomo."],
    ["Estornos pagamento/liquidação",`${q.negativePaid.length} / ${q.negativeLiq.length}`,"Valores negativos permanecem nos cálculos."],
    ["Receitas negativas",q.negativeRev.length,"Deduções/estornos preservados no total líquido."],
    ["Integridade dos estágios",integrityBad?`${integrityBad} a conferir`:"Sem quebra detectada",integrityBad?"Há empenhos que pedem cotejo entre empenho, liquidação e pagamento.":"Nenhum pagamento acima do liquidado, liquidação acima do empenho líquido ou pagamento sem empenho foi detectado no exercício carregado."]
  ];
  $("#auditSec").innerHTML=`<section class="audit-hero card"><div><small>Sinais de auditoria • ${APP_VERSION}</small><h2>Triagem automática do exercício ${y}</h2><p>Estes testes apontam padrões que merecem cotejo documental; <strong>não qualificam a despesa como irregular</strong>. Para reduzir falsos positivos, esta aba usa o exercício inteiro carregado e respeita apenas o filtro de órgão. Mês e pesquisa textual são ignorados.</p></div><span class="audit-scope">${esc(org)} • ${last?`até ${MONTHS[last]}/${y}`:"sem meses carregados"}${partial?" • exercício parcial":""}</span></section><div class="auditgrid audit-quality">${qualityCards.map((z,i)=>`<div class="audititem card ${i===7&&!integrityBad?'ok':'neutral'}"><small>${z[0]}</small><strong>${typeof z[1]==="number"?z[1].toLocaleString("pt-BR"):z[1]}</strong><small>${z[2]}</small></div>`).join("")}</div><section class="audit-section card"><div class="audit-section-head"><div><h3>Múltiplos empenhos de pequeno valor por credor</h3><p>Triagem de concentração anual de empenhos individualmente pequenos. O padrão pode decorrer de licitação, ata de registro de preços, parcelamento legítimo ou outras causas; a confirmação depende do processo administrativo. A regra detalhada de seleção não é exibida.</p></div><strong>${frag.length.toLocaleString("pt-BR")} credor(es)</strong></div><div class="audit-tablewrap"><table class="audit-table"><thead><tr><th>#</th><th>Credor</th><th>Empenhos selecionados</th><th>Soma</th><th>Maior empenho</th><th>Nº dos empenhos</th></tr></thead><tbody>${fragRows||'<tr><td colspan="6">Nenhum padrão selecionado neste exercício.</td></tr>'}</tbody></table></div></section><section class="audit-section card"><div class="audit-section-head"><div><h3>Pagamentos coincidentes</h3><p>Mesmo credor, mesmo valor e mesma data em empenhos distintos. Há hipóteses legítimas, inclusive divisão por fontes de recursos; por isso a tabela serve para cotejo com notas fiscais, medições e liquidações.</p></div><strong>${coinc.length.toLocaleString("pt-BR")} grupo(s)</strong></div><div class="audit-tablewrap"><table class="audit-table"><thead><tr><th>#</th><th>Data</th><th>Credor</th><th>Valor unitário</th><th>Ocorrências</th><th>Empenhos</th><th>Valor coincidente além da 1ª ocorrência</th></tr></thead><tbody>${coincRows||'<tr><td colspan="7">Nenhuma coincidência selecionada neste exercício.</td></tr>'}</tbody></table></div></section><section class="audit-section card"><h3>O que estes testes não enxergam</h3><p>O TCESP carregado no painel não fornece, de forma suficiente para estes testes, objeto detalhado, modalidade de contratação, contrato, nota fiscal, medição, ata de registro de preços ou justificativa do pagamento. Por isso, os sinais acima devem ser usados como ponto de partida para conferência documental.</p></section>`;
  $("#auditSec").querySelectorAll("[data-dossier-key]").forEach(b=>b.addEventListener("click",()=>showPaymentDetails(b.dataset.dossierKey)));
}
function yearTotals(y){let d=db.despesas.filter(x=>x.ano==y&&orgMatch(x.orgao,$("#orgao").value)),r=db.receitas.filter(x=>x.ano==y),e=evSums(d);return {y,rec:r.reduce((a,x)=>a+n(x.valor),0),emp:n(e.Empenhado),net:net(e),liq:n(e["Valor Liquidado"]),paid:n(e["Valor Pago"]),dr:d.length,rr:r.length}}
const IPCA={2014:6.41,2015:10.67,2016:6.29,2017:2.95,2018:3.75,2019:4.31,2020:4.52,2021:10.06,2022:5.79,2023:4.62,2024:4.83,2025:4.26};
function ipcaFactorTo2025(y){if(y>=2025)return 1;let f=1;for(let a=y+1;a<=2025;a++)f*=1+(IPCA[a]||0)/100;return f}
function revenueCategory(r){let t=[r.fonte,r.aplicacao,r.alinea,r.subalinea].join(" ").toUpperCase();if(/FPM|FUNDO DE PARTICIPA.C..O DOS MUNIC.PIOS/.test(t))return "FPM";if(/ICMS/.test(t))return "ICMS";if(/FUNDEB/.test(t))return "Fundeb";if(/SUS|SA.DE/.test(t))return "SUS / Saúde";if(/ISSQN|ISS\b|SERVI.OS DE QUALQUER NATUREZA/.test(t))return "ISS";if(/IPTU|PROPRIEDADE PREDIAL|PROPRIEDADE TERRITORIAL URBANA/.test(t))return "IPTU";if(/ITBI|TRANSMISS.O.*BENS IM.VEIS/.test(t))return "ITBI";if(/IPVA/.test(t))return "IPVA";if(/ITR|PROPRIEDADE TERRITORIAL RURAL/.test(t))return "ITR";if(/CONV.NIO|CONVENIO|TRANSFER.NCIA/.test(t))return "Outras transferências";return "Demais receitas"}
function revenueComposition(y){let g={};db.receitas.filter(r=>r.ano==y).forEach(r=>{let k=revenueCategory(r);g[k]=(g[k]||0)+n(r.valor)});return Object.entries(g).map(([n,v])=>({n,v})).filter(x=>x.v>0).sort((a,b)=>b.v-a.v)}
function paidComposition(y){let d=db.despesas.filter(x=>x.ano==y),g=supplierGroups(d).map(x=>({n:x.nome,v:n(x.e["Valor Pago"])})).filter(x=>x.v>0).sort((a,b)=>b.v-a.v),top=g.slice(0,8),other=g.slice(8).reduce((a,x)=>a+x.v,0);if(other)top.push({n:"Demais credores",v:other});return top}
function compareYears(){let ys=[...new Set([...(db.exercicios||[]),...db.despesas.map(x=>+x.ano),...db.receitas.map(x=>+x.ano)])].filter(Boolean).sort((a,b)=>a-b),want=[...new Set([2020,2021,2022,2023,2024,2025,2026,...ys])].sort((a,b)=>a-b),raw=want.map(yearTotals),readyRaw=raw.filter(x=>x.dr||x.rr),ready=readyRaw.map(x=>{let f=compareReal&&x.y<=2025?ipcaFactorTo2025(x.y):1;return {...x,rec:x.rec*f,net:x.net*f,liq:x.liq*f,paid:x.paid*f}}),full=ready.filter(x=>{let ms=new Set(db.receitas.filter(r=>r.ano==x.y).map(r=>r.mesNum));return ms.size===12}),growth=full.map((x,i)=>({y:x.y,recG:i?((x.rec/full[i-1].rec)-1)*100:NaN,paidG:i?((x.paid/full[i-1].paid)-1)*100:NaN})),latestFull=[...full].reverse().find(x=>x.y<=2025),selectedY=+$("#ano").value,selectedReady=readyRaw.some(x=>x.y===selectedY&&(x.dr||x.rr)),compY=selectedReady?selectedY:(latestFull?.y||2025),revComp=revenueComposition(compY),paidComp=paidComposition(compY),mode=compareReal?"valores reais, corrigidos pelo IPCA para reais de dez/2025":"valores nominais";
$("#compareSec").innerHTML=`<div class="explain-hero card"><h2>Comparar exercícios</h2><p>Comparação gráfica e numérica dos exercícios já carregados nesta sessão/aparelho. Para incluir outro ano, selecione-o no filtro de exercício; o painel o carrega sob demanda. Exercícios parciais aparecem no gráfico de valores, mas não entram no cálculo de crescimento anual.</p><div class="modeSwitch"><button id="nominalBtn" class="${compareReal?'':'active'}">Valores nominais</button><button id="realBtn" class="${compareReal?'active':''}">Corrigidos pelo IPCA</button></div><small class="ipcanote">Modo atual: ${mode}. IPCA anual oficial do IBGE; 2026 permanece nominal por ser exercício em curso.</small></div>${ready.length?`<div class="comparecharts"><section class="chartcard card"><h3>Receita × empenho líquido × pago</h3><p>Totais dos meses disponíveis em cada exercício — ${mode}.</p><div class="chartbox"><canvas id="annualBars"></canvas></div></section><section class="chartcard card"><h3>Crescimento ${compareReal?'real':'nominal'} anual</h3><p>Variação de receita e pagamentos entre exercícios completos consecutivos.</p><div class="chartbox"><canvas id="growthLines"></canvas></div></section></div><div class="comparecharts"><section class="chartcard card"><h3>Composição da receita — ${compY}</h3><p>Classificação analítica pelas descrições de fonte, alínea e subalínea da API do TCESP.</p><div class="chartbox"><canvas id="revPie"></canvas></div></section><section class="chartcard card"><h3>Composição da despesa paga — ${compY}</h3><p>8 maiores credores + demais. A API usada pelo painel não traz função orçamentária da despesa.</p><div class="chartbox"><canvas id="paidPie"></canvas></div></section></div>`:""}<div class="comparegrid">${ready.slice().reverse().map(x=>`<div class="card compareyear"><h3>${x.y}${x.y===2026?' <small>(parcial)</small>':''}</h3>${x.dr||x.rr?`<small>${x.dr.toLocaleString("pt-BR")} despesas • ${x.rr.toLocaleString("pt-BR")} receitas</small><p><b>Receita</b><span>${brl(x.rec)}</span></p><p><b>Empenho líquido</b><span>${brl(x.net)}</span></p><p><b>Liquidado</b><span>${brl(x.liq)}</span></p><p><b>Pago</b><span>${brl(x.paid)}</span></p>`:`<small>Dados ainda não carregados.</small>`}</div>`).join("")}</div>${ready.length>1?`<div class="note card">Os totais abrangem os meses existentes em cada exercício. Um exercício parcial não deve ser comparado diretamente com 12 meses de um exercício encerrado. A correção pelo IPCA usa as taxas anuais do IBGE e expressa os exercícios encerrados em poder de compra de dezembro de 2025.</div>`:""}`;
$("#nominalBtn")?.addEventListener("click",()=>{compareReal=false;compareYears()});$("#realBtn")?.addEventListener("click",()=>{compareReal=true;compareYears()});if(ready.length)requestAnimationFrame(()=>{annualBars($("#annualBars"),ready);if(growth.length>1)growthLines($("#growthLines"),growth);if(revComp.length)pie($("#revPie"),revComp);if(paidComp.length)pie($("#paidPie"),paidComp)})}
function render(){syncYears();let view=currentViewData();$("#clearQ").hidden=!$("#q").value;renderAnalysisScope(view);cards(view);renderFreshness();$("#painel").hidden=tab!=="painel";$("#tableSec").hidden=!["despesas","receitas","gastos"].includes(tab);$("#travelSec").hidden=tab!=="diarias";$("#auditSec").hidden=tab!=="auditoria";$("#compareSec").hidden=tab!=="comparar";$("#entendaSec").hidden=tab!=="entenda";let count=0;if(tab==="painel")renderPanel(view);else if(tab==="diarias")count=renderTravel();else if(tab==="auditoria")audit();else if(tab==="comparar")compareYears();else if(tab==="entenda"){}else count=renderTable();$("#status").textContent=(count?count.toLocaleString("pt-BR")+" linhas exibidas • ":"")+"base histórica permanente + atualizações locais/API • "+APP_VERSION}
async function importData(raw,mesNum,anoOverride){let a=typeof raw==="string"?JSON.parse(raw.replace(/^```(?:json)?\s*/,"").replace(/\s*```$/,"").trim()):raw;if(!Array.isArray(a)||!a.length)throw Error("JSON sem registros");let isD="evento" in a[0],ano=anoOverride??+$("#ano").value;if(isD){db.despesas=db.despesas.filter(x=>!(x.ano===ano&&x.mesNum===mesNum));db.despesas.push(...a.map(x=>({ano,mesNum,mes:x.mes||MONTHS[mesNum],orgao:x.orgao||"",evento:x.evento||"",empenho:x.nr_empenho||"",fornecedorId:x.id_fornecedor||"",fornecedor:x.nm_fornecedor||"",data:x.dt_emissao_despesa||"",valor:+String(x.vl_despesa||0).replace(/\./g,"").replace(",",".")})))}else{db.receitas=db.receitas.filter(x=>!(x.ano===ano&&x.mesNum===mesNum));db.receitas.push(...a.map(x=>({ano,mesNum,mes:x.mes||MONTHS[mesNum],orgao:x.orgao||"",fonte:x.ds_fonte_recurso||"",aplicacao:x.ds_cd_aplicacao_fixo||"",alinea:x.ds_alinea||"",subalinea:x.ds_subalinea||"",valor:+String(x.vl_arrecadacao||0).replace(/\./g,"").replace(",",".")})))}await save();render()}
function download(name,text,type="application/json"){let a=document.createElement("a");a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
$("#backupBtn").onclick=()=>download(`${CITY.id}-backup-${new Date().toISOString().slice(0,10)}.json`,JSON.stringify(db));$("#restore").onchange=async e=>{let x=JSON.parse(await e.target.files[0].text());if(!x.despesas||!x.receitas)return alert("Backup inválido");db=x;await save();syncYears();render();alert("Backup restaurado.")};$("#resetBtn").onclick=async()=>{if(!confirm("Restaurar a base histórica permanente do repositório? As atualizações locais posteriores serão substituídas pela fotografia arquivada."))return;try{db=await loadPermanentBaseline(true);await save();syncYears();render();alert("Base histórica permanente restaurada.")}catch(e){alert("Não foi possível restaurar a base permanente: "+e.message)}};
$("#csvBtn").onclick=()=>{let table=tab==="diarias"?$("#travelTable"):$("#tableSec table");if(!table||tab==="painel"||tab==="auditoria"||tab==="comparar"||tab==="entenda")return alert("Abra Despesas, Receitas, Gastos ou Pagamentos eventuais para exportar a tabela principal.");let rows=[...table.querySelectorAll("tr")].map(tr=>[...tr.children].map(td=>'"'+td.innerText.replace(/"/g,'""')+'"').join(";"));download(`tcesp-${tab}.csv`,"\ufeff"+rows.join("\n"),"text/csv;charset=utf-8")};
for(let i=1;i<=12;i++)$("#mes").insertAdjacentHTML("beforeend",`<option value="${i}">${MONTHS[i]}</option>`);function selectTab(t){let b=document.querySelector(`nav button[data-tab="${t}"]`);if(!b)return;document.querySelectorAll("nav button").forEach(x=>x.classList.remove("active"));b.classList.add("active");tab=t;if(location.hash!=="#"+t)history.replaceState(null,"","#"+t);render()} document.querySelectorAll("nav button").forEach(b=>b.addEventListener("click",()=>selectTab(b.dataset.tab)));["mes","orgao"].forEach(id=>$("#"+id).addEventListener("change",()=>{$("#paymentDialog").open&&$("#paymentDialog").close();render()}));
$("#ano").addEventListener("change",async()=>{
  $("#paymentDialog").open&&$("#paymentDialog").close();
  const y=+$("#ano").value;
  selectedYear=y;
  const myToken=++yearChangeToken;
  const oldScrollY=window.scrollY;
  const oldScrollX=window.scrollX;
  $("#ano").disabled=true;
  try{
    await ensureYearLoaded(y,false);
    if(myToken!==yearChangeToken)return;
    render();
    requestAnimationFrame(()=>{
      if(myToken!==yearChangeToken)return;
      window.scrollTo(oldScrollX,oldScrollY);
      $("#ano").disabled=false;
      $("#ano").value=String(selectedYear);
    });
  }catch(e){
    if(myToken!==yearChangeToken)return;
    $("#ano").disabled=false;
    $("#status").textContent=`Falha ao carregar ${y}: ${e.message}`;
    alert(`Não foi possível carregar ${y}. ${e.message}`);
  }
});let searchTimer,qInput=$("#q");function queueSearchRender(){$("#clearQ").hidden=!qInput.value;clearTimeout(searchTimer);if(!qInput.value.trim()){restoreGeneralView(false);return}searchTimer=setTimeout(render,120)}function finishSearchChange(){clearTimeout(searchTimer);qInput.value.trim()?render():restoreGeneralView(false)}qInput.addEventListener("input",queueSearchRender);qInput.addEventListener("search",finishSearchChange);qInput.addEventListener("change",finishSearchChange);qInput.addEventListener("compositionend",finishSearchChange);$("#clearQ").onclick=clearSearch;$("#closePaymentDialog").onclick=()=>$("#paymentDialog").close();$("#paymentDialog").addEventListener("click",e=>{if(e.target===$("#paymentDialog"))$("#paymentDialog").close()});
$("#file").onchange=async e=>{let m=+$("#mes").value;if(!m)return alert("Selecione o mês que será substituído.");try{for(let f of e.target.files)await importData(await f.text(),m);alert("Importação concluída. O mês correspondente foi substituído, preservando duplicidades legítimas.")}catch(err){alert("Falha: "+err.message)}};
const MUNICIPIO_API=CITY.apiSlug;
const AUDESP_2026={7:"2026-08-20",8:"2026-09-21",9:"2026-10-20",10:"2026-11-23"};
function fmtDT(v){if(!v)return "—";try{return new Intl.DateTimeFormat("pt-BR",{dateStyle:"short",timeStyle:"short"}).format(new Date(v))}catch{return v}}
function monthCoverage(y){let ms=[...new Set([...db.despesas.filter(x=>x.ano==y).map(x=>x.mesNum),...db.receitas.filter(x=>x.ano==y).map(x=>x.mesNum)])].filter(Boolean).sort((a,b)=>a-b);return ms}
function renderFreshness(){let el=$("#apiFreshness");if(!el)return;let y=+$("#ano").value,ms=monthCoverage(y),last=ms.length?Math.max(...ms):0,u=db.apiUpdates||{},k=last?`${y}-${String(last).padStart(2,"0")}`:"",info=k?u[k]:null,next=last<12?last+1:null,deadline=(y===2026&&next)?AUDESP_2026[next]:null;el.innerHTML=`<div><small>Último mês disponível no painel</small><strong>${last?MONTHS[last]+"/"+y:"Nenhum mês carregado"}</strong></div><div><small>Última atualização pela API</small><strong>${info?.loadedAt?fmtDT(info.loadedAt):"Ainda não registrada"}</strong></div><div><small>Última verificação automática</small><strong>${db.lastApiCheck?fmtDT(db.lastApiCheck):"Ainda não realizada"}</strong></div><div><small>${deadline?"Prazo AUDESP do próximo mês":"Próxima atualização"}</small><strong>${deadline?new Date(deadline+"T12:00:00").toLocaleDateString("pt-BR"):"Consultar TCESP"}</strong></div>`}
function markApiUpdate(y,m,d,r){db.apiUpdates??={};db.apiUpdates[`${y}-${String(m).padStart(2,"0")}`]={loadedAt:new Date().toISOString(),despesas:Array.isArray(d)?d.length:0,receitas:Array.isArray(r)?r.length:0}}
async function updateMonthFromApi(y,m,silent=false){let base="https://transparencia.tce.sp.gov.br/api/json",[d,r]=await Promise.all([fetchJson(`${base}/despesas/${MUNICIPIO_API}/${y}/${m}`),fetchJson(`${base}/receitas/${MUNICIPIO_API}/${y}/${m}`)]);if(!Array.isArray(d)||!d.length||!Array.isArray(r)||!r.length)throw Error("mês ainda sem dados completos na API");await importData(d,m,y);await importData(r,m,y);markApiUpdate(y,m,d,r);db.lastApiCheck=new Date().toISOString();await save();renderFreshness();if(!silent)alert("Mês atualizado integralmente.");return true}
async function autoCheckCurrentYear(){let y=new Date().getFullYear();if(y!==2026)return;let ms=monthCoverage(y),last=ms.length?Math.max(...ms):0,next=last+1,deadline=AUDESP_2026[next];if(!deadline)return;let today=new Date(),due=new Date(deadline+"T23:59:59");if(today<=due)return;let lastTry=db.autoCheck?.[`${y}-${next}`];if(lastTry&&Date.now()-new Date(lastTry).getTime()<20*60*60*1000)return;db.autoCheck??={};db.autoCheck[`${y}-${next}`]=new Date().toISOString();db.lastApiCheck=new Date().toISOString();await save();try{await updateMonthFromApi(y,next,true)}catch(e){console.info("TCESP: próximo mês ainda indisponível",e.message);renderFreshness()}}
async function fetchJson(url){let r=await fetch(url,{cache:"no-store"});if(!r.ok)throw Error("HTTP "+r.status);return r.json()}
function legacyArrayFromText(txt,marker){
  const i=txt.indexOf(marker);
  if(i<0)return [];
  const start=txt.indexOf("[",i+marker.length);
  if(start<0)throw Error("array histórica não localizada");
  let depth=0,inStr=false,escp=false;
  for(let p=start;p<txt.length;p++){
    const ch=txt[p];
    if(inStr){
      if(escp){escp=false;continue}
      if(ch==="\\"){escp=true;continue}
      if(ch==='"')inStr=false;
      continue
    }
    if(ch==='"'){inStr=true;continue}
    if(ch==="[")depth++;
    else if(ch==="]"){
      depth--;
      if(depth===0)return JSON.parse(txt.slice(start,p+1))
    }
  }
  throw Error("array histórica incompleta")
}
async function fetchBaselineManifest(force=false){
  if(CITY.format==="legacy-js"){
    const years=(CITY.years||[]).map(Number).filter(Number.isFinite).sort((a,b)=>a-b);
    return {
      version:CITY.version||`legacy-${CITY.id}`,
      municipio:`${CITY.nome}/SP`,
      apiSlug:CITY.apiSlug,
      exercicios:years,
      arquivos:years.map(ano=>({ano,arquivo:`data-${ano}.js`})),
      origem:"Base histórica arquivada no repositório do projeto"
    }
  }
  const manifestFile=CITY.manifest||"baseline-manifest.json";
  const bust=encodeURIComponent(CITY.version||window.TCESP_BUILD_ID||"baseline");
  $("#status").textContent=`${CITY.nome}: lendo manifesto da base histórica…`;
  let mr=await fetch(`${DATA_BASE}${manifestFile}?v=${bust}`,{cache:"no-store"});
  if(!mr.ok)throw Error("manifesto permanente HTTP "+mr.status);
  let manifest=await mr.json();
  if(!Array.isArray(manifest.arquivos)||!manifest.arquivos.length)throw Error("manifesto permanente sem arquivos anuais");
  return manifest
}
function yearAlreadyLoaded(y){
  y=+y;
  return (db?._loadedYears||[]).includes(y) ||
    (db?.despesas||[]).some(x=>+x.ano===y) ||
    (db?.receitas||[]).some(x=>+x.ano===y)
}
async function fetchPermanentYear(y,force=false,manifestOverride=null){
  const manifest=manifestOverride||db?._baselineManifest||await fetchBaselineManifest(force);
  const item=(manifest.arquivos||[]).find(x=>+x.ano===+y);
  if(!item)throw Error(`exercício ${y} não localizado no manifesto`);
  const file=item.arquivo||item.file||`data-${y}.${CITY.format==="legacy-js"?"js":"json"}`;
  const bust=encodeURIComponent((manifest.version||CITY.version||window.TCESP_BUILD_ID||"baseline")+`-${y}`);
  $("#status").textContent=`${CITY.nome}: carregando ${y}…`;
  let r=await fetch(`${DATA_BASE}${file}?v=${bust}`,{cache:"no-store"});
  if(!r.ok)throw Error(`${file}: HTTP ${r.status}`);
  let pack;
  if(CITY.format==="legacy-js"){
    const txt=await r.text();
    pack={
      ano:+y,
      despesas:legacyArrayFromText(txt,"window.SEED_DATA.despesas.push(..."),
      receitas:legacyArrayFromText(txt,"window.SEED_DATA.receitas.push(...")
    };
  }else{
    pack=await r.json();
  }
  if(!Array.isArray(pack.despesas)||!Array.isArray(pack.receitas))throw Error(`${file}: conteúdo inválido`);
  if(Number.isFinite(item.despesas)&&pack.despesas.length!==item.despesas)throw Error(`${file}: contagem de despesas divergente`);
  if(Number.isFinite(item.receitas)&&pack.receitas.length!==item.receitas)throw Error(`${file}: contagem de receitas divergente`);
  return pack
}
async function ensureYearLoaded(y,force=false){
  y=+y;
  if(yearAlreadyLoaded(y))return true;
  let manifest=db?._baselineManifest||await fetchBaselineManifest(force);
  let pack=await fetchPermanentYear(y,force,manifest);
  db.despesas.push(...pack.despesas);
  db.receitas.push(...pack.receitas);
  db._loadedYears=[...new Set([...(db._loadedYears||[]),y])].sort((a,b)=>a-b);
  db.exercicios=[...new Set([...(db.exercicios||[]),y])].sort((a,b)=>a-b);
  try{await save()}catch(e){console.warn("Ano carregado, mas não persistido integralmente no IndexedDB",e)}
  return true
}
async function loadPermanentBaseline(force=false){
  let manifest=await fetchBaselineManifest(force);
  let years=[...(manifest.exercicios||manifest.arquivos.map(x=>+x.ano))].map(Number).filter(Number.isFinite).sort((a,b)=>a-b);
  if(!years.length)throw Error("manifesto permanente sem exercícios");
  let latest=Math.max(...years);
  let pack=await fetchPermanentYear(latest,force,manifest);
  return {
    _baselineVersion:manifest.version,
    _baselineManifest:manifest,
    _baselineTotals:manifest.totais||{},
    _baselineCoverageWarnings:manifest.coverageWarnings||[],
    _loadedYears:[latest],
    despesas:pack.despesas,
    receitas:pack.receitas,
    exercicios:years,
    apiUpdates:manifest.apiUpdates||{},
    autoCheck:manifest.autoCheck||{}
  }
}
async function loadYear(y){let base="https://transparencia.tce.sp.gov.br/api/json",ok=0,fail=[];$("#status").textContent=`Carregando ${y}: iniciando…`;for(let m=1;m<=12;m++){try{$("#status").textContent=`Carregando ${y}: mês ${m}/12 — despesas…`;let d=await fetchJson(`${base}/despesas/${MUNICIPIO_API}/${y}/${m}`);$("#ano").value=String(y);await importData(d,m,y);$("#status").textContent=`Carregando ${y}: mês ${m}/12 — receitas…`;let r=await fetchJson(`${base}/receitas/${MUNICIPIO_API}/${y}/${m}`);await importData(r,m,y);markApiUpdate(y,m,d,r);ok++}catch(e){fail.push(`${m}: ${e.message}`)}}await save();syncYears();render();if(fail.length)throw Error(`${ok}/12 meses concluídos. Falhas: ${fail.join("; ")}`);return ok}
$("#yearBtn").onclick=async()=>{let y=+$("#ano").value;if(!confirm(`Carregar os 12 meses de ${y} pelo TCESP? Os meses existentes desse exercício serão substituídos pelos dados retornados pela API.`))return;try{await loadYear(y);alert(`Exercício ${y} carregado com 12 meses.`)}catch(e){alert("Carga do exercício incompleta. Os meses concluídos foram preservados. "+e.message)}};
$("#addYearBtn").onclick=async()=>{let raw=prompt("Qual exercício deseja adicionar? Ex.: 2024"),y=+raw,now=new Date().getFullYear();if(!raw)return;if(!Number.isInteger(y)||y<2008||y>now)return alert(`Informe um ano entre 2008 e ${now}.`);db.exercicios=[...new Set([...(db.exercicios||[]),y])];await save();syncYears();$("#ano").value=String(y);render();if(confirm(`Exercício ${y} adicionado ao seletor. Deseja carregar agora os 12 meses pelo TCESP?`)){try{await loadYear(y);alert(`Exercício ${y} carregado.`)}catch(e){alert("Carga incompleta. "+e.message)}}};
$("#apiBtn").onclick=async()=>{let m=+$("#mes").value;if(!m)return alert("Selecione um mês.");let y=+$("#ano").value;try{await updateMonthFromApi(y,m,false)}catch(e){db.lastApiCheck=new Date().toISOString();await save();renderFreshness();alert("A API não respondeu, o mês ainda não está disponível ou o navegador bloqueou a consulta. Detalhe: "+e.message)}};
if("serviceWorker"in navigator)navigator.serviceWorker.getRegistrations().then(rs=>Promise.all(rs.map(r=>r.unregister()))).catch(()=>{});if("caches"in window)caches.keys().then(ks=>Promise.all(ks.filter(k=>/^tcesp-/i.test(k)).map(k=>caches.delete(k)))).catch(()=>{});let deferred;window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferred=e;$("#installBtn").hidden=false});$("#installBtn").onclick=async()=>{if(deferred){deferred.prompt();deferred=null}};

// Base histórica permanente
// Regra central: uma atualização de interface nunca substitui um IndexedDB já existente.
// Os arquivos data-AAAA.json só são baixados automaticamente em navegador sem base local
// ou quando o usuário escolhe explicitamente "Restaurar base".
function hasUsableData(x){
  return !!(x&&typeof x==="object"&&
    ((Array.isArray(x.despesas)&&x.despesas.length>0)||
     (Array.isArray(x.receitas)&&x.receitas.length>0)))
}
function initMunicipalityUI(){
  const sel=$("#municipio");
  sel.innerHTML=(window.TCESP_CITIES||[]).map(c=>`<option value="${esc(c.id)}">${esc(c.nome)}</option>`).join("");
  sel.value=CITY.id;
  sel.addEventListener("change",()=>{
    const u=new URL(location.href);
    u.searchParams.set("municipio",sel.value);
    localStorage.setItem("tcesp-central-city",sel.value);
    location.href=u.pathname+"?"+u.searchParams.toString();
  });
  $("#brandTitle").textContent=`Transparência SP • ${CITY.nome}`;
  document.title=`Transparência SP • ${CITY.nome}`;
  const repo=$("#cityRepoLink");
  if(repo)repo.href=`https://github.com/${OWNER}/${CITY.repo}`;
}
initMunicipalityUI();

(async()=>{
  let initError=null;
  try{
    // Arquitetura unificada: carrega apenas o exercício mais recente na abertura
    // e os demais sob demanda. Isso evita colocar toda a série histórica na memória.
    db=await loadPermanentBaseline(false);
    try{await save()}catch(e){initError=e;console.warn("Base inicial carregada sem persistência integral",e)}
  }catch(e){
    initError=e;
    console.warn("Falha na inicialização da base permanente",e);
    db=structuredClone(window.SEED_DATA||{despesas:[],receitas:[],exercicios:[],apiUpdates:{},autoCheck:{}});
    try{
      let manifest=await fetchBaselineManifest(true);
      db.exercicios=(manifest.exercicios||[]).map(Number).filter(Number.isFinite).sort((a,b)=>a-b);
      db._baselineManifest=manifest;
      db._baselineVersion=manifest.version;
      db._loadedYears=[];
    }catch(_){}
  }

  let ht=location.hash.slice(1);if(ht==="fornecedores")ht="gastos";
  if(["painel","despesas","receitas","gastos","diarias","auditoria","comparar","entenda"].includes(ht)){
    tab=ht;
    document.querySelectorAll("nav button").forEach(x=>x.classList.toggle("active",x.dataset.tab===tab));
  }

  render();

  if(initError&&hasUsableData(db)){
    $("#status").textContent+=" • carregamento sob demanda ativo";
  }else if(!hasUsableData(db)){
    $("#status").textContent="A base permanente não foi carregada. Recarregue a página.";
  }else{
    $("#status").textContent+=" • carregamento sob demanda por exercício";
  }

  setTimeout(()=>autoCheckCurrentYear(),1200);
  addEventListener("resize",()=>tab==="painel"&&renderPanel())
})();
