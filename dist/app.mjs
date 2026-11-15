// AI-assisted implementation, based on the participant's selected Earth-trends task.
// NASA data values are not AI-generated. See ai-disclosure.md.
import {analyzeTrend, annualize, parseCsv, normalizeSeries, studentTCritical} from './lib/trends.mjs';
import {centerSeries, residualLagOneCorrelation} from './lib/views.mjs';

const $ = id => document.getElementById(id);
const VARIABLES = {
  T2M:{name:'Air temperature',unit:'°C',rateUnit:'°C',annual:'Annual day-weighted mean',definition:'Air temperature at 2 metres above the surface'},
  PRECTOTCORR:{name:'Precipitation',unit:'mm',rateUnit:'mm',annual:'Annual total',definition:'Bias-corrected precipitation, accumulated from monthly mean daily rates'},
  RH2M:{name:'Relative humidity',unit:'%',rateUnit:'percentage points',annual:'Annual day-weighted mean',definition:'Relative humidity at 2 metres above the surface'}
};
const datasets = new Map();
let current = null, csvFile = null, csvFilename = '', runNumber = 0;
const fmt = (number,decimals=2) => Number.isFinite(number) ? number.toLocaleString('en',{minimumFractionDigits:decimals,maximumFractionDigits:decimals}) : 'Not defined';
const signed = (number,decimals=2) => (number>0?'+':'') + fmt(number,decimals);
const pText = p => p === null ? 'not defined for constant data' : p === 0 ? '< 1 × 10⁻¹⁵' : p < .0001 ? p.toExponential(2) : p.toFixed(4);
const setText = (id,value) => {$(id).textContent=value;};
function status(message,error=false){setText('status',message);$('status').classList.toggle('error',error);}
function createSvg(tag,attrs={},text){const el=document.createElementNS('http://www.w3.org/2000/svg',tag);Object.entries(attrs).forEach(([k,v])=>el.setAttribute(k,String(v)));if(text!==undefined)el.textContent=text;return el;}
function annualData(dataset,variable){
  if(dataset.kind==='annual')return {points:dataset.points,excludedYears:[],missingValueCount:dataset.missingRows||0};
  const parameter=dataset.raw?.properties?.parameter?.[variable];
  if(!parameter)throw new Error('This source does not contain the selected variable.');
  const monthly=Object.entries(parameter).filter(([key])=>/^\d{6}$/.test(key)&&Number(key.slice(4))>=1&&Number(key.slice(4))<=12).map(([key,value])=>({year:Number(key.slice(0,4)),month:Number(key.slice(4)),value}));
  return annualize(monthly,{missingValues:[-999,-9999,dataset.raw.header?.fill_value].filter(Number.isFinite),weighting:'days',aggregation:variable==='PRECTOTCORR'?'daily-rate-total':'mean'});
}
function variableInfo(dataset,variable){return dataset.kind==='annual'?{name:dataset.label,unit:dataset.unit,rateUnit:dataset.unit,annual:'User-supplied annual values',definition:'Imported data; units and provenance are supplied by the user'}:VARIABLES[variable];}
function datasetName(dataset){return dataset.location?.name||dataset.label;}
function selectedVariable(){return document.querySelector('input[name=variable]:checked').value;}
function readSettings(){
  const dataset=datasets.get($('region').value);
  if(!dataset)throw new Error('Select a loaded dataset.');
  const start=Number($('start-year').value),end=Number($('end-year').value);
  if(!Number.isInteger(start)||!Number.isInteger(end)||start>end)throw new Error('Enter whole years with the start year before the end year.');
  const full=annualData(dataset,selectedVariable());
  const earliest=full.points[0]?.year,latest=full.points.at(-1)?.year;
  if(start<earliest||end>latest)throw new Error(`This dataset covers ${earliest}–${latest}. Choose years inside that range.`);
  return {dataset,variable:selectedVariable(),start,end,compare:dataset.kind==='annual'?'':$('compare').value,view:$('chart-view').value,full};
}
function analyze(){
  try{
    const settings=readSettings(),points=settings.full.points.filter(p=>p.year>=settings.start&&p.year<=settings.end);
    const result=analyzeTrend(points);
    let comparison=null;
    if(settings.compare&&settings.compare!==settings.dataset.id){
      const comparisonDataset=datasets.get(settings.compare);
      if(comparisonDataset){const full=annualData(comparisonDataset,settings.variable);const otherPoints=full.points.filter(p=>p.year>=settings.start&&p.year<=settings.end);comparison={dataset:comparisonDataset,points:otherPoints,result:analyzeTrend(otherPoints)};}
    }
    const diagnostics=residualLagOneCorrelation(result.residuals);
    if(result.residualSumSquares===0){diagnostics.correlation=null;diagnostics.interpretation='A perfect fit has no residual variation to correlate.';}
    current={...settings,points,result,comparison,diagnostics,info:variableInfo(settings.dataset,settings.variable)};
    render();['export-csv','export-report','copy-link'].forEach(id=>{$(id).disabled=false;});setText('chart-description',settings.view==='deviation'?'Deviation from each series’ selected-period mean':'Annual measurements and fitted linear trend');status(`${result.n} valid annual observations analyzed. ${settings.full.excludedYears.length} incomplete years excluded.`);
    if(settings.dataset.kind!=='annual'&&settings.dataset.id!=='custom'){
      const params=new URLSearchParams({region:settings.dataset.id,variable:settings.variable,start:settings.start,end:settings.end});if(settings.compare)params.set('compare',settings.compare);if(settings.view==='deviation')params.set('view','deviation');history.replaceState(null,'','?'+params.toString()+location.hash);
    }
  }catch(error){current=null;['export-csv','export-report','copy-link'].forEach(id=>{$(id).disabled=true;});setText('chart-description','Previous valid result shown; correct the controls and analyze again.');status(error.message,true);}
}
function configureDataset({resetYears=true}={}){
  const dataset=datasets.get($('region').value);if(!dataset)return;
  const imported=dataset.kind==='annual';
  document.querySelectorAll('input[name=variable]').forEach(input=>{input.disabled=imported;});$('compare').disabled=imported;
  if(imported)$('compare').value='';
  const points=annualData(dataset,selectedVariable()).points;
  if(!points.length){status('No complete valid years are available.',true);return;}
  $('start-year').min=points[0].year;$('start-year').max=points.at(-1).year-2;$('end-year').min=points[0].year+2;$('end-year').max=points.at(-1).year;
  if(resetYears){$('start-year').value=points[0].year;$('end-year').value=points.at(-1).year;}
  analyze();
}
function render(){
  const {dataset,info,result,comparison,points,full}=current;
  const shortName=dataset.location?.name.split(',')[0]||dataset.label;
  setText('analysis-title',dataset.kind==='annual'?dataset.label:`${info.name} in ${shortName}`);
  setText('analysis-subtitle',`${info.annual} · ${result.startYear}–${result.endYear}`);
  setText('slope',`${signed(result.slopePerDecade)} ${info.unit==='%'?'pp':info.unit}`);
  setText('slope-description',`${info.rateUnit} per decade`);
  setText('ci',result.confidence95?`${signed(result.confidence95.slopePerDecade[0])} to ${signed(result.confidence95.slopePerDecade[1])}`:'Not defined');
  setText('significance',result.pValue===null?'Constant series':result.significant?'Detected · p < .05':'Not detected');
  setText('p-value',`p = ${pText(result.pValue)} · R² = ${result.rSquared===null?'not defined':fmt(result.rSquared,3)}`);
  setText('data-badge',dataset.kind==='annual'?'User-supplied annual data':dataset.id==='custom'?'NASA live API response':'NASA data snapshot');
  setText('coverage',`${result.n} annual points · ${dataset.kind==='annual'?'imported coverage not independently verified':'12 valid months per year'}`);
  document.querySelector('.chart-foot>span:last-child').textContent=dataset.kind==='annual'?'Source: user-supplied citation':'Source: NASA POWER / MERRA-2';
  const action=result.slopePerDecade>0?'increased':result.slopePerDecade<0?'decreased':'showed no fitted change';
  let finding=result.isConstant?`The selected series is constant over ${result.startYear}–${result.endYear}. A slope significance test is not defined.`:`${info.name} ${action} at a fitted rate of ${fmt(Math.abs(result.slopePerDecade))} ${info.rateUnit} per decade in this ${result.n}-year dataset. `+(result.significant?'The simple slope test detects a non-zero linear trend under its assumptions.':'The simple slope test does not detect a non-zero linear trend at the 0.05 threshold; this does not prove there is no change.');
  if(comparison)finding+=` In ${datasetName(comparison.dataset)}, the same analysis gives ${signed(comparison.result.slopePerDecade)} ${info.rateUnit} per decade (p = ${pText(comparison.result.pValue)}). This comparison does not test whether the two slopes differ significantly.`;
  setText('finding',finding);
  setText('legend-value',current.view==='deviation'?'Annual deviation':'Annual value');
  const diagnostic=current.diagnostics;
  setText('residual-check',diagnostic.correlation===null?'Residual correlation is not defined for this series.':`Adjacent-year residual correlation: ${signed(diagnostic.correlation,3)} across ${diagnostic.pairCount} consecutive-year pairs.`);
  setText('chart-view-description',current.view==='deviation'?`Each line is centered on its own mean over the selected period (${datasetName(dataset)}: ${fmt(result.meanValue)} ${info.unit}${comparison?`; ${datasetName(comparison.dataset)}: ${fmt(comparison.result.meanValue)} ${info.unit}`:''}). This changes the display only; statistics, table and CSV retain actual values.`:'Actual annual values are shown. Use “Deviation from period mean” to compare change patterns across places with different average levels.');
  if(dataset.location){
    const {latitude:lat,longitude:lon}=dataset.location;setText('coordinates',`${fmt(Math.abs(lat))}° ${lat>=0?'N':'S'} · ${fmt(Math.abs(lon))}° ${lon>=0?'E':'W'}`);
    $('locator').setAttribute('cx',180+lon/180*170);$('locator').setAttribute('cy',80-lat/90*68);$('locator').style.display='';
  }else{setText('coordinates','Region supplied in imported dataset');$('locator').style.display='none';}
  $('data-rows').replaceChildren(...points.map((point,i)=>{const row=document.createElement('tr');[point.year,`${fmt(point.value,3)} ${info.unit}`,fmt(result.fitted[i].value,3),point.count??'User supplied'].forEach(v=>{const cell=document.createElement('td');cell.textContent=v;row.append(cell);});return row;}));
  setText('table-caption',`${info.name} · ${datasetName(dataset)} · ${info.unit} · ${info.annual}`);
  renderChart();
  for(const id of ['accra','ahmedabad','manaus','longyearbyen']){
    const data=datasets.get(id);if(!data)continue;
    const variable=dataset.kind==='annual'?'T2M':current.variable,unit=VARIABLES[variable].unit;
    try{const fit=analyzeTrend(annualData(data,variable).points.filter(p=>p.year>=current.start&&p.year<=current.end));setText('card-'+id,`${signed(fit.slopePerDecade)} ${unit==='%'?'pp':unit} / decade`);}catch{setText('card-'+id,'Period not available');}
  }
}
function renderChart(){
  const {points:rawPoints,result,comparison,info,dataset,view}=current,svg=$('chart');svg.replaceChildren();
  const baseline=view==='deviation'?centerSeries(rawPoints).baseline:0;
  const comparisonBaseline=view==='deviation'&&comparison?centerSeries(comparison.points).baseline:0;
  const points=rawPoints.map(p=>({...p,value:p.value-baseline}));
  const comparisonPoints=comparison?.points.map(p=>({...p,value:p.value-comparisonBaseline}));
  const chartUnit=view==='deviation'&&info.unit==='%'?'pp':info.unit;
  svg.append(createSvg('title',{id:'svg-title'},`${info.name}: ${datasetName(dataset)}, ${result.startYear}–${result.endYear}`));
  svg.append(createSvg('desc',{id:'svg-desc'},`${result.n} annual values, displayed as ${view==='deviation'?'deviations from each series own period mean':'actual values'}. Linear slope ${signed(result.slopePerDecade)} ${info.rateUnit} per decade. p-value ${pText(result.pValue)}. Actual annual values are available in the table below.`));
  const narrow=matchMedia('(max-width:650px)').matches;
  const W=narrow?440:940,H=narrow?320:390,m={left:narrow?47:60,right:narrow?14:24,top:22,bottom:narrow?40:46},innerW=W-m.left-m.right,innerH=H-m.top-m.bottom;
  svg.setAttribute('viewBox',`0 0 ${W} ${H}`);
  const minX=result.startYear,maxX=result.endYear;
  const critical=studentTCritical(result.degreesOfFreedom),xx=result.points.reduce((sum,row)=>sum+(row.year-result.meanYear)**2,0);
  const band=points.map(p=>{const value=result.meanValue+result.slopePerYear*(p.year-result.meanYear)-baseline;const se=Math.sqrt(result.residualSumSquares/result.degreesOfFreedom)*Math.sqrt(1/result.n+(p.year-result.meanYear)**2/xx);const d=result.confidence95?critical*se:0;return {year:p.year,value,low:value-d,high:value+d};});
  const allY=[...points.map(p=>p.value),...band.flatMap(p=>[p.low,p.high]),...(comparisonPoints?.map(p=>p.value)||[])];
  const yLow=Math.min(...allY),yHigh=Math.max(...allY),padding=Math.max((yHigh-yLow)*.15,Math.abs(yHigh)*.005,.05);const minY=yLow-padding,maxY=yHigh+padding;
  const x=v=>m.left+(v-minX)/(maxX-minX)*innerW,y=v=>m.top+(maxY-v)/(maxY-minY)*innerH;
  for(let i=0;i<=5;i++){const value=minY+(maxY-minY)*i/5,yy=y(value);svg.append(createSvg('line',{x1:m.left,x2:W-m.right,y1:yy,y2:yy,stroke:'#e3e9df','stroke-width':1}));svg.append(createSvg('text',{x:m.left-12,y:yy+4,'text-anchor':'end',fill:'#72816e','font-size':11},fmt(value,info.unit==='mm'?0:1)));}
  const tickCount=Math.min(narrow?4:6,result.n-1),ticks=new Set();for(let i=0;i<=tickCount;i++)ticks.add(Math.round(minX+(maxX-minX)*i/tickCount));
  for(const value of ticks)svg.append(createSvg('text',{x:x(value),y:H-17,'text-anchor':'middle',fill:'#72816e','font-size':11},value));
  svg.append(createSvg('text',{x:m.left,y:12,fill:'#72816e','font-size':10},view==='deviation'?`Δ ${chartUnit}`:chartUnit));
  if(view==='deviation')svg.append(createSvg('line',{x1:m.left,x2:W-m.right,y1:y(0),y2:y(0),stroke:'#829478','stroke-width':1.2,'stroke-dasharray':'3 4'}));
  const linePath=rows=>rows.map((p,i)=>`${i?'L':'M'}${x(p.year).toFixed(2)},${y(p.value).toFixed(2)}`).join(' ');
  if(result.confidence95){const polygon=[...band.map(p=>`${x(p.year)},${y(p.high)}`),...band.slice().reverse().map(p=>`${x(p.year)},${y(p.low)}`)].join(' ');svg.append(createSvg('polygon',{points:polygon,fill:'#deebcf',opacity:.8}));}
  if(comparison){svg.append(createSvg('path',{d:linePath(comparisonPoints),fill:'none',stroke:'#bd783f','stroke-width':2,opacity:.75}));svg.append(createSvg('path',{d:linePath(comparison.result.fitted.map(p=>({...p,value:p.value-comparisonBaseline}))),fill:'none',stroke:'#bd783f','stroke-width':2,'stroke-dasharray':'6 6'}));$('compare-legend').hidden=false;setText('compare-legend',`${datasetName(comparison.dataset)} · orange`);}else $('compare-legend').hidden=true;
  svg.append(createSvg('path',{d:linePath(points),fill:'none',stroke:'#356947','stroke-width':2.3,'stroke-linejoin':'round'}));
  svg.append(createSvg('path',{d:linePath(result.fitted.map(p=>({...p,value:p.value-baseline}))),fill:'none',stroke:'#52704a','stroke-width':2,'stroke-dasharray':'6 6'}));
  points.forEach(p=>{const dot=createSvg('circle',{cx:x(p.year),cy:y(p.value),r:3.5,fill:'#fafff6',stroke:'#356947','stroke-width':1.8});dot.append(createSvg('title',{},`${p.year}: ${fmt(p.value,3)} ${chartUnit}${view==='deviation'?' deviation':''}`));svg.append(dot);});
  const overlay=createSvg('rect',{x:m.left,y:m.top,width:innerW,height:innerH,fill:'transparent'});overlay.addEventListener('pointermove',e=>{const rect=svg.getBoundingClientRect(),px=(e.clientX-rect.left)/rect.width*W;const targetYear=minX+(px-m.left)/innerW*(maxX-minX);const point=points.reduce((best,p)=>Math.abs(p.year-targetYear)<Math.abs(best.year-targetYear)?p:best,points[0]);$('chart-tooltip').hidden=false;setText('chart-tooltip',`${point.year} · ${fmt(point.value,3)} ${chartUnit}${view==='deviation'?` deviation (actual ${fmt(point.value+baseline,3)} ${info.unit})`:''}`);});overlay.addEventListener('pointerleave',()=>{$('chart-tooltip').hidden=true;});svg.append(overlay);
}
function safeCell(value){const text=String(value);return '"'+(typeof value!=='number'&&/^[=+\-@\t\r]/.test(text)?"'":'')+text.replaceAll('"','""')+'"';}
function download(text,name,type){const url=URL.createObjectURL(new Blob([text],{type}));const anchor=document.createElement('a');anchor.href=url;anchor.download=name;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1500);}
function rawEvidenceReport(){
  const {dataset,result,points,comparison,info,start,end}=current;
  return {project:'Earth Trends Observatory',createdAt:new Date().toISOString(),region:dataset.location||dataset.label,variable:info.name,unit:info.unit,period:{start,end},source:dataset.provenance||{citation:dataset.source},aggregation:info.annual,excludedYears:current.full.excludedYears,annualPoints:points,analysis:result,comparison:comparison?{region:comparison.dataset.location,source:comparison.dataset.provenance,analysis:comparison.result,annualPoints:comparison.points}:null,method:{name:'Ordinary least squares linear trend',significance:'Two-sided Student t slope test, alpha 0.05; equivalent single-predictor ANOVA F=t²',reference:'https://ntrs.nasa.gov/citations/20090042747',referenceUse:'Adapted regional time-series visualization, least-squares regression, R² and significance testing. NASA POWER data are not SeaWiFS data. Annual aggregation uses day weights rather than monthly anomalies.',assumptions:result.assumptions,limitations:['Exploratory, not an operational forecast or causal attribution.','No correction for serial correlation, multiple comparisons, model or measurement uncertainty.','NASA POWER represents a coarse reanalysis cell, not a local station.','Fitted-mean chart intervals are not prediction intervals.']},aiAssistance:{tool:'OpenAI Codex',use:'Assisted implementation, documentation and tests. Derived statistics are computed deterministically by disclosed formulas.',dataValues:'NASA source values are not AI-generated. Imported values supplied by user.'}};
}
function evidenceReport(){
  const report=rawEvidenceReport();
  report.view={mode:current.view,baselineDefinition:'Each series own selected-period arithmetic mean',primaryBaseline:current.view==='deviation'?current.result.meanValue:null,comparisonBaseline:current.view==='deviation'&&current.comparison?current.comparison.result.meanValue:null,statisticsAndAnnualData:'Actual values; centering affects the display only'};
  report.diagnostics={...current.diagnostics,method:'Descriptive Pearson correlation between consecutive-year OLS residual pairs',inferenceCorrected:false};
  return report;
}
async function fetchLocation(){
  const lat=Number($('latitude').value),lon=Number($('longitude').value),name=$('place-name').value.trim()||'Custom location';
  if(!$('latitude').value.trim()||!$('longitude').value.trim()||!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>89.5||Math.abs(lon)>180){status('Enter latitude −89.5 to 89.5 and longitude −180 to 180.',true);return;}
  const sequence=++runNumber,button=$('fetch-location');button.disabled=true;status('Fetching 45 years of monthly data from NASA POWER…');
  const sourceUrl=new URL('https://power.larc.nasa.gov/api/temporal/monthly/point');sourceUrl.search=new URLSearchParams({parameters:'T2M,PRECTOTCORR,RH2M',community:'AG',longitude:lon,latitude:lat,format:'JSON',start:1981,end:2025});
  try{
    const response=await fetch(sourceUrl,{signal:AbortSignal.timeout(60000)});if(!response.ok)throw new Error(`NASA returned HTTP ${response.status}.`);
    const raw=await response.json();if(sequence!==runNumber)return;
    for(const key of Object.keys(VARIABLES))if(!raw.properties?.parameter?.[key])throw new Error('NASA returned an incomplete dataset.');
    const locationInfo={name,latitude:lat,longitude:lon};const provenance={sourceUrl:sourceUrl.href,retrievedAt:new Date().toISOString(),dataType:'NASA POWER/MERRA-2 reanalysis',location:locationInfo,spatialResolution:'Approximately 0.5° latitude × 0.625° longitude; grid cell, not station'};
    datasets.set('custom',{id:'custom',kind:'power',raw,location:locationInfo,provenance});
    let option=$('region').querySelector('option[value=custom]');if(!option){option=new Option(name,'custom');$('region').add(option);}option.textContent=name;$('region').value='custom';configureDataset();
  }catch(error){status(`NASA data could not be loaded: ${error.name==='TimeoutError'?'request timed out':error.message} The four bundled snapshots remain available.`,true);}finally{button.disabled=false;}
}
async function chooseCsv(){
  const file=$('csv-file').files[0];csvFile=null;$('import-csv').disabled=true;
  try{
    if(!file)return;if(file.size>5*1024*1024)throw new Error('Choose a CSV smaller than 5 MB.');
    const text=await file.text();const lines=text.split(/\r?\n/);while(lines.length&&(lines[0].trim().startsWith('#')||!lines[0].trim()))lines.shift();
    const parsed=parseCsv(lines.join('\n'));if(parsed.headers.length<2||parsed.rows.length<3)throw new Error('Include at least two columns and three annual observations.');
    if(parsed.rows.length>10000)throw new Error('Use no more than 10,000 annual rows.');
    csvFile=parsed;csvFilename=file.name;
    for(const id of ['time-column','value-column']){$(id).replaceChildren(...parsed.headers.map(name=>new Option(name,name)));$(id).disabled=false;}
    const time=parsed.headers.find(h=>/^(year|date|time)$/i.test(h))||parsed.headers[0];$('time-column').value=time;$('value-column').value=parsed.headers.find(h=>h!==time)||parsed.headers[1];
    $('import-csv').disabled=false;setText('import-status',`${parsed.rows.length} rows loaded locally. Select columns and provide units and source.`);
  }catch(error){setText('import-status',error.message);}
}
function importCsv(){
  try{
    if(!csvFile)throw new Error('Choose a file first.');
    const timeColumn=$('time-column').value,valueColumn=$('value-column').value;if(timeColumn===valueColumn)throw new Error('Choose different time and value columns.');
    const label=$('csv-name').value.trim(),unit=$('csv-unit').value.trim(),source=$('csv-source').value.trim();if(!label||!unit||!source)throw new Error('Provide the dataset label, units and source before importing.');
    const rows=csvFile.rows.map(row=>{const text=String(row[timeColumn]).trim();const match=text.match(/^(\d{4})(?:-01-01(?:T00:00(?::00(?:\.000)?)?Z?)?)?$/);return {year:match?Number(match[1]):null,value:row[valueColumn]};});
    if(rows.some(row=>row.year===null))throw new Error('Use annual years (e.g. 2001) or January 1 ISO annual dates. Monthly/daily inputs must be aggregated before import.');
    const points=normalizeSeries(rows,{missingValues:[-999,-9999]});analyzeTrend(points);
    const missingRows=rows.length-points.length;datasets.set('imported',{id:'imported',kind:'annual',points,label,unit,source,missingRows,provenance:{sourceType:'User-supplied annual CSV',citation:source,filename:csvFilename,importedAt:new Date().toISOString(),timeColumn,valueColumn,missingRows,coverage:'Not independently verified'}});
    let option=$('region').querySelector('option[value=imported]');if(!option){option=new Option(label,'imported');$('region').add(option);}option.textContent=label;$('region').value='imported';configureDataset();setText('import-status',`${points.length} annual rows analyzed. ${missingRows} missing-value rows excluded. No data left your browser.`);$('workspace').scrollIntoView({behavior:'smooth'});
  }catch(error){setText('import-status',error.message);}
}
async function initialize(){
  try{
    const manifestResponse=await fetch('data/manifest.json');if(!manifestResponse.ok)throw new Error('Could not load the data manifest.');const manifest=await manifestResponse.json();
    const responses=await Promise.all(manifest.snapshots.map(async item=>{const response=await fetch('data/'+item.file);if(!response.ok)throw new Error('Snapshot missing: '+item.file);const raw=await response.json();return {id:item.location.id,kind:'power',raw,location:item.location,provenance:item};}));
    responses.forEach(dataset=>datasets.set(dataset.id,dataset));const params=new URLSearchParams(location.search);
    if(datasets.has(params.get('region')))$('region').value=params.get('region');if(VARIABLES[params.get('variable')])document.querySelector(`input[name=variable][value=${params.get('variable')}]`).checked=true;
    if(datasets.has(params.get('compare')))$('compare').value=params.get('compare');
    if(params.get('view')==='deviation')$('chart-view').value='deviation';
    if(/^\d{4}$/.test(params.get('start')||''))$('start-year').value=params.get('start');if(/^\d{4}$/.test(params.get('end')||''))$('end-year').value=params.get('end');
    configureDataset({resetYears:false});
    $('region').addEventListener('change',()=>configureDataset());document.querySelectorAll('input[name=variable]').forEach(input=>input.addEventListener('change',analyze));$('compare').addEventListener('change',analyze);$('chart-view').addEventListener('change',analyze);$('analyze').addEventListener('click',analyze);$('reset-period').addEventListener('click',()=>configureDataset());
    for(const id of ['start-year','end-year']){$(id).addEventListener('keydown',e=>{if(e.key==='Enter')analyze();});$(id).addEventListener('input',()=>{['export-csv','export-report','copy-link'].forEach(button=>{$(button).disabled=true;});setText('chart-description','Previous analysis shown; choose Analyze trend to apply the new period.');status('Period changed. Choose Analyze trend to update the result.');});}
    document.querySelectorAll('[data-region]').forEach(button=>button.addEventListener('click',()=>{$('region').value=button.dataset.region;configureDataset();$('workspace').scrollIntoView({behavior:'smooth'});}));
    $('copy-link').addEventListener('click',async()=>{if(current?.dataset.id==='custom'||current?.dataset.kind==='annual'){status('Custom and imported datasets are not stored in share links. Download an evidence report instead.');return;}try{await navigator.clipboard.writeText(location.href);status('View link copied. It reproduces the region, measurement, dates and comparison.');}catch{status('Copy the current address to share this view.');}});
    $('export-csv').addEventListener('click',()=>{if(!current)return;const rows=[['year',`${current.info.name} (${current.info.unit})`,'fitted_value','valid_months'],...current.points.map((p,i)=>[p.year,p.value,current.result.fitted[i].value,p.count??'user supplied'])];download(rows.map(row=>row.map(safeCell).join(',')).join('\r\n'),'earth-trends-annual-data.csv','text/csv;charset=utf-8');});
    $('export-report').addEventListener('click',()=>{if(current)download(JSON.stringify(evidenceReport(),null,2),'earth-trends-evidence.json','application/json');});
    $('fetch-location').addEventListener('click',fetchLocation);$('csv-file').addEventListener('change',chooseCsv);$('import-csv').addEventListener('click',importCsv);
    let resizeTimer;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{if(current)renderChart();},120);});
  }catch(error){status(`The bundled data could not load: ${error.message} Serve this folder over HTTP; opening index.html directly does not load ES modules.`,true);}
}
initialize();
