const root = document.documentElement;
const app = document.querySelector('#app');
const names = { 'a-share': 'A 股', 'hong-kong': '港股', us: '美股', crypto: '加密资产' };
const metricNames = { revenue: '营收', net_income: '净利润', operating_cash_flow: '经营现金流' };
const sectorNames = { 'Consumer Staples': '日常消费', Energy: '能源', 'Digital Assets': '数字资产', 'Layer 1': '公链生态' };
let data = null;
let loadError = false;
let activeChart = 'btc';
let assetFilter = 'all';
let assetQuery = '';
let eventFilter = 'all';

function esc(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }
function safeUrl(value) { try { const u = new URL(value); return u.protocol === 'https:' ? u.href : ''; } catch { return ''; } }
function date(value) { if (!value) return '—'; const d = new Date(value.length === 10 ? `${value}T12:00:00Z` : value); return Number.isNaN(d.valueOf()) ? '—' : new Intl.DateTimeFormat('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'UTC' }).format(d); }
function stamp(value) { if (!value) return '—'; const d = new Date(value); return Number.isNaN(d.valueOf()) ? '—' : new Intl.DateTimeFormat('zh-TW', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Taipei' }).format(d); }
function num(value, places = 1) { return Number.isFinite(Number(value)) ? new Intl.NumberFormat('zh-TW', { maximumFractionDigits: places, minimumFractionDigits: places }).format(Number(value)) : '—'; }
function usd(value) { return Number.isFinite(Number(value)) ? `${num(Number(value) / 1e8, 1)} 亿美元` : '—'; }
function price(value) { return Number.isFinite(Number(value)) ? `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(Number(value))} USDT` : '—'; }
function change(current, previous) { if (!Number.isFinite(current) || !Number.isFinite(previous) || !previous) return ''; const pct = (current / previous - 1) * 100; return `<span class="delta ${pct >= 0 ? 'up' : 'down'}">${pct >= 0 ? '+' : ''}${num(pct, 1)}%</span>`; }
function title(kicker, heading, description, aside = '') { return `<div class="page-title"><div><div class="eyebrow">${esc(kicker)}</div><h1>${esc(heading)}</h1><p>${description}</p></div><div class="date-mark">${aside}</div></div>`; }
function section(heading, note = '', link = '') { return `<div class="section-title"><h2>${esc(heading)}</h2>${link ? `<a href="${esc(link)}">${esc(note)}</a>` : `<small>${esc(note)}</small>`}</div>`; }
function empty(heading, detail) { return `<div class="empty"><strong>${esc(heading)}</strong>${esc(detail)}</div>`; }
function asset(id) { return data.assets.find(a => a.id === id); }
function latestRun(sourceId) { return data.runs.find(r => r.source_id === sourceId); }
function status(assetRow) {
  const run = latestRun(assetRow.sourceId);
  if (!run) return { label: '等待首次采集', kind: 'warn' };
  if (run.status === 'failed') return { label: '采集失败', kind: 'warn' };
  if (run.status === 'running') return { label: '采集中', kind: '' };
  if (!latestMetric(assetRow)) return { label: '读数缺失', kind: 'warn' };
  const finished = Date.parse(run.finished_at);
  if (!Number.isFinite(finished) || Date.now() - finished > 48 * 60 * 60 * 1000) return { label: '采集延迟', kind: 'warn' };
  return { label: '已核查', kind: 'good' };
}
function facts(assetId, metric, type = 'annual') {
  const selected = data.facts.filter(f => f.asset_id === assetId && f.metric === metric && f.period_type === type);
  const byPeriod = new Map();
  for (const f of selected) {
    const current = byPeriod.get(f.period_end);
    if (!current || `${f.filed_at}:${f.accession}` > `${current.filed_at}:${current.accession}`) byPeriod.set(f.period_end, f);
  }
  return [...byPeriod.values()].sort((a, b) => a.period_end.localeCompare(b.period_end));
}
function bars(assetId) { return data.bars.filter(b => b.asset_id === assetId).sort((a,b) => a.day.localeCompare(b.day)); }
function latestMetric(a) { const series = a.kind === 'equity' ? facts(a.id, 'revenue') : bars(a.id); return series.at(-1); }
function assetValue(a) { const entry = latestMetric(a); return a.kind === 'equity' ? usd(entry?.value) : price(entry?.close); }
function assetAsOf(a) { const entry = latestMetric(a); return entry?.period_end || entry?.day || null; }
function metricLabel(a) { return a.kind === 'equity' ? '年度营收' : '现货日线收盘'; }

function lineChart(points, valueKey, unitLabel, axisFormatter, zero = false) {
  if (!points || points.length < 2) return empty('暂无可绘制的时间序列', '完成首次采集后，图表会显示带来源的历史数据。');
  const values = points.map(p => Number(p[valueKey]));
  const min = zero ? 0 : Math.min(...values) * 0.96;
  const maxRaw = Math.max(...values);
  const max = maxRaw === min ? maxRaw + 1 : maxRaw * 1.04;
  const left = 56, right = 8, top = 12, bottom = 32, width = 660, height = 205;
  const pw = width - left - right, ph = height - top - bottom;
  const xy = values.map((v, i) => [left + i / (values.length - 1) * pw, top + (max - v) / (max - min) * ph]);
  const path = xy.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const area = `${path} L${xy.at(-1)[0].toFixed(1)},${(top+ph).toFixed(1)} L${left},${(top+ph).toFixed(1)} Z`;
  const grid = [0, .5, 1].map(t => { const y = top + t * ph; const v = max - t * (max - min); return `<line class="grid" x1="${left}" x2="${width-right}" y1="${y}" y2="${y}"/><text x="${left-8}" y="${y+4}" text-anchor="end">${esc(axisFormatter(v))}</text>`; }).join('');
  const labels = [0, Math.floor((points.length - 1) / 2), points.length - 1].map(i => `<text x="${xy[i][0]}" y="${height-8}" text-anchor="${i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'}">${esc((points[i].day || points[i].period_end || '').slice(0,7))}</text>`).join('');
  const dots = points.length <= 12 ? xy.map((p, i) => `<circle class="dot" cx="${p[0]}" cy="${p[1]}" r="3.5"><title>${esc(points[i].day || points[i].period_end)} · ${esc(axisFormatter(values[i]))} ${esc(unitLabel)}</title></circle>`).join('') : `<circle class="dot" cx="${xy.at(-1)[0]}" cy="${xy.at(-1)[1]}" r="4"><title>${esc(points.at(-1).day || points.at(-1).period_end)} · ${esc(axisFormatter(values.at(-1)))} ${esc(unitLabel)}</title></circle>`;
  return `<div class="chart" role="img" aria-label="${esc(unitLabel)}历史走势，${points.length}个数据点"><svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">${grid}<path class="area" d="${area}"/><path class="path" d="${path}"/>${dots}${labels}</svg></div>`;
}

function chartFor(a) {
  if (!a) return empty('请选择标的', '');
  if (a.kind === 'token') {
    const series = bars(a.id); const last = series.at(-1), previous = series.at(-2);
    return `<div class="panel panel-pad"><div class="panel-top"><div><div class="panel-kicker">EXCHANGE DAILY CLOSE</div><h3>${esc(a.name)} · ${esc(a.symbol)}</h3><div class="panel-sub">Binance 现货交易对；已完成日 K，不代表全市场价格</div></div><span class="tag">USDT 报价</span></div><div class="big-number">${price(last?.close)}${change(last?.close, previous?.close)}</div>${lineChart(series,'close','USDT',v => num(v,0))}<div class="chart-caption"><span>${series.length ? `${date(series[0].day)} — ${date(last?.day)} · ${series.length} 个日点` : '尚无时间序列'}</span><a href="${esc(safeUrl(last?.source_url))}" target="_blank" rel="noopener noreferrer">源数据</a></div></div>`;
  }
  const series = facts(a.id, 'revenue'); const last = series.at(-1), previous = series.at(-2);
  return `<div class="panel panel-pad"><div class="panel-top"><div><div class="panel-kicker">ANNUAL REVENUE</div><h3>${esc(a.name)} · ${esc(a.symbol)}</h3><div class="panel-sub">SEC XBRL 年度营收，原值按 1 亿美元显示</div></div><span class="tag">年度</span></div><div class="big-number">${usd(last?.value)}${change(last?.value, previous?.value)}</div>${lineChart(series,'value','亿美元',v => num(v/1e8,0),true)}<div class="chart-caption"><span>${series.length ? `${date(series[0].period_end)} — ${date(last?.period_end)} · ${series.length} 个财年` : '尚无时间序列'}</span>${last?.source_url ? `<a href="${esc(safeUrl(last.source_url))}" target="_blank" rel="noopener noreferrer">SEC 原始申报</a>` : '<span>来源未接入</span>'}</div></div>`;
}

function marketStrip() { return `<div class="status-strip">${data.markets.map(m => {
  const count = data.assets.filter(a => a.market === m.id && latestMetric(a)).length;
  const label = m.status === 'pilot' ? '试点采集' : m.status === 'restricted' ? '授权限制' : '未接入';
  return `<div class="status-cell"><div class="label">${esc(m.name)}<span class="status-label ${esc(m.status)}">${label}</span></div><strong>${m.status === 'pilot' ? `${count} / ${data.assets.filter(a=>a.market===m.id).length} 标的` : '—'}</strong><small>${esc(m.note)}</small></div>`;
}).join('')}</div>`; }

function recentEvents(limit = 4) {
  const rows = data.events.slice(0, limit);
  if (!rows.length) return empty('暂无披露线索', 'SEC 披露索引采集完成后在这里出现。');
  return `<div class="event-stack">${rows.map(e => `<a class="event-mini" href="${esc(safeUrl(e.source_url))}" target="_blank" rel="noopener noreferrer"><div class="meta"><span>${esc(asset(e.asset_id)?.symbol || e.asset_id)} <em>${esc(e.form)}</em></span><span>${date(e.filed_at)}</span></div><strong>${esc(e.title)}</strong></a>`).join('')}</div>`;
}

function reportRows(limit = 4) {
  if (!data.reports.length) return empty('报告库尚未发布', '报告将保留发表版本、数据时点和来源。');
  return `<div class="report-list">${data.reports.slice(0,limit).map(r => `<a class="report-row" href="/reports/${encodeURIComponent(r.id)}"><div class="date">${date(r.published_at)} · ${esc(r.source_count)} 个来源</div><strong>${esc(r.title)}</strong><small>${esc(r.description)}</small></a>`).join('')}</div>`;
}

function assetTable(rows) {
  if (!rows.length) return empty('这个范围还没有标的', '试点暂只覆盖部分美股和加密资产，其他市场在核对数据许可。');
  const desktop = `<div class="table-wrap asset-table"><table class="data-table"><thead><tr><th>标的</th><th>市场 / 分类</th><th class="num">最近可用读数</th><th class="num">时点</th><th class="num">来源状态</th></tr></thead><tbody>${rows.map(a => { const s = status(a); return `<tr><td><a class="text-link ticker" href="#asset/${esc(a.id)}">${esc(a.symbol)}</a><span class="company">${esc(a.name)}</span></td><td>${esc(names[a.market])}<span class="company">${esc(sectorNames[a.sector] || a.sector)} · 试点标签</span></td><td class="num">${esc(assetValue(a))}<span class="company">${metricLabel(a)}</span></td><td class="num">${date(assetAsOf(a))}</td><td class="num"><span class="tag ${s.kind}">${s.label}</span></td></tr>`; }).join('')}</tbody></table></div>`;
  const mobile = `<div class="asset-mobile-list">${rows.map(a => { const s = status(a); return `<a class="asset-mobile-row" href="#asset/${esc(a.id)}"><span class="asset-mobile-head"><strong>${esc(a.symbol)}</strong><span class="tag ${s.kind}">${s.label}</span></span><small>${esc(a.name)} · ${esc(names[a.market])} / ${esc(sectorNames[a.sector] || a.sector)}</small><span class="asset-mobile-reading"><strong>${esc(assetValue(a))}</strong><small>${metricLabel(a)} · ${date(assetAsOf(a))}</small></span></a>`; }).join('')}</div>`;
  return desktop + mobile;
}

function overview() {
  const chartAsset = asset(activeChart) || asset('btc');
  return title('DAILY READOUT','今日概览','已接入来源的最新读数与披露线索；试点范围不代表四市场全貌。',date(data.generatedAt)) + marketStrip() +
    `<div class="overview-grid"><section>${section('走势观察','切换试点标的')}${chartFor(chartAsset)}<div class="segmented">${['btc','eth','ko','wmt','xom'].map(id=>`<button type="button" data-chart="${id}" class="${activeChart===id?'active':''}">${esc(asset(id)?.symbol||id)}</button>`).join('')}</div></section><section>${section('最新披露线索','查看全部','#events')}<div class="panel panel-pad"><div class="panel-kicker">SEC FILINGS</div>${recentEvents()}<div class="source-note">这里是申报索引，不是新闻分析或重要性评级。点击进入 SEC 原始文件核验。</div></div></section></div>` +
    `<div class="two-col"><section>${section('标的观察','全部标的','#assets')}<div class="panel">${assetTable(data.assets)}</div></section><section>${section('近期研究','报告库','#reports')}<div class="panel panel-pad">${reportRows(3)}</div></section></div>` +
    `<div class="light-callout">数据边界：美股试点只含 SEC 报表与披露，没有股票报价；加密试点只含 Binance 的 BTC/USDT、ETH/USDT 日线。A 股、港股及新闻正文尚未自动接入。每个读数的时间与来源在标的页可查。</div>`;
}

function assetsPage() {
  const shown = data.assets.filter(a => (assetFilter==='all' || a.market===assetFilter) && `${a.symbol} ${a.name} ${sectorNames[a.sector]||a.sector}`.toLowerCase().includes(assetQuery.toLowerCase()));
  const groups = Object.entries(sectorNames).map(([name, label]) => { const members = data.assets.filter(a=>a.sector===name); return `<div class="source-row"><div><strong>${esc(label)}</strong><small>${esc(name)} · 自定义试点主题</small></div><span class="mono">${members.length} 标的</span></div>`; }).join('');
  return title('INSTRUMENTS & THEMES','标的与主题','先看数据覆盖与来源，再进入公司或交易对的历史读数。') + `<div class="filterbar"><div class="tabs">${[['all','全部'],['us','美股'],['crypto','加密'],['a-share','A 股'],['hong-kong','港股']].map(([id,label])=>`<button type="button" data-asset-filter="${id}" class="${assetFilter===id?'active':''}">${label}</button>`).join('')}</div><input class="search" id="asset-search" type="search" placeholder="搜索代码、名称或主题" value="${esc(assetQuery)}" aria-label="搜索标的"></div><div class="asset-grid"><section>${section('标的目录',`${shown.length} / ${data.assets.length} 个试点标的`)}<div class="panel">${assetTable(shown)}</div></section><section>${section('主题观察','试点标签，不等于官方行业分类')}<div class="panel panel-pad"><div class="source-list">${groups}</div><div class="source-note">A 股与港股板块表现尚无合法、稳定的数据源。Web3 使用跨股票、协议、代币的主题关系，待来源验证后扩展。</div></div></section></div>`;
}

function assetPage(id) {
  const a = asset(id); if (!a) return title('INSTRUMENT','标的不存在','请从标的目录重新选择。') + `<a class="text-link" href="#assets">返回标的目录</a>`;
  const s = status(a), last = latestMetric(a);
  const annual = a.kind==='equity' ? ['revenue','net_income','operating_cash_flow'].map(metric=>({metric,rows:facts(a.id,metric)})) : [];
  const recentFilings = data.events.filter(e=>e.asset_id===a.id).slice(0,5);
  const b = bars(a.id); const recent = b.at(-1);
  return title('INSTRUMENT / '+a.market.toUpperCase(),a.name,`${esc(a.symbol)} · ${esc(names[a.market])} · ${esc(sectorNames[a.sector]||a.sector)} · <span class="tag ${s.kind}">${s.label}</span>`, `<a class="text-link" href="#assets">返回目录</a>`) +
    `<div class="overview-grid"><section>${section('历史读数',a.kind==='equity'?'SEC 年度事实':'Binance 已完成日 K')}${chartFor(a)}</section><section>${section('读数说明','透明口径')}<div class="panel panel-pad"><div class="panel-kicker">SOURCE & FRESHNESS</div><h3>${a.kind==='equity'?'SEC CompanyFacts':'Binance Spot Market Data'}</h3><div class="fact-list"><div><small>最新观测</small><strong>${date(assetAsOf(a))}</strong></div><div><small>采集状态</small><strong>${s.label}</strong></div><div><small>读数类别</small><strong>${metricLabel(a)}</strong></div><div><small>采集完成</small><strong>${stamp(latestRun(a.sourceId)?.finished_at)}</strong></div></div><div class="source-note">${a.kind==='equity'?'报表数值按原始申报记录存档，历史更正不覆盖旧版本。此处尚无股价和估值。':'价格来自单一交易所的 USDT 现货交易对；当前未做跨交易所聚合。'}</div></div></section></div>` +
    (a.kind==='equity' ? `<div class="two-col"><section>${section('财务指标','最新年度，亿美元')}<div class="panel"><div class="table-wrap"><table class="data-table"><thead><tr><th>指标</th><th class="num">本期</th><th class="num">上期</th><th class="num">报告期</th><th>原始申报</th></tr></thead><tbody>${annual.map(({metric,rows})=>{const current=rows.at(-1),previous=rows.at(-2);return `<tr><td>${metricNames[metric]}</td><td class="num">${usd(current?.value)}</td><td class="num">${usd(previous?.value)}</td><td class="num">${date(current?.period_end)}</td><td>${current?.source_url?`<a class="text-link" href="${esc(safeUrl(current.source_url))}" target="_blank" rel="noopener noreferrer">SEC</a>`:'—'}</td></tr>`;}).join('')}</tbody></table></div></div></section><section>${section('披露线索','原始申报')}<div class="panel panel-pad">${recentFilings.length?`<div class="event-stack">${recentFilings.map(e=>`<a class="event-mini" href="${esc(safeUrl(e.source_url))}" target="_blank" rel="noopener noreferrer"><div class="meta"><span>${esc(e.form)}</span><span>${date(e.filed_at)}</span></div><strong>${esc(e.title)}</strong></a>`).join('')}</div>`:empty('暂无记录','等待首次 SEC 采集。')}</div></section></div>` : `<div class="two-col"><section>${section('最新日 K','USDT 交易对')}<div class="panel"><div class="table-wrap"><table class="data-table"><thead><tr><th>交易日</th><th class="num">开盘</th><th class="num">最高</th><th class="num">最低</th><th class="num">收盘</th><th class="num">成交量</th></tr></thead><tbody>${b.slice(-7).reverse().map(row=>`<tr><td>${date(row.day)}</td><td class="num">${num(row.open,2)}</td><td class="num">${num(row.high,2)}</td><td class="num">${num(row.low,2)}</td><td class="num">${num(row.close,2)}</td><td class="num">${num(row.volume,0)}</td></tr>`).join('')}</tbody></table></div></div></section><section>${section('市场与事件','覆盖说明')}<div class="panel panel-pad"><p class="hint">${esc(a.name)} 的日线可用于观察价格走势。链上数据、协议收入、TVL、监管和新闻事件尚未接入，不能从这条价格线推断其原因。</p>${recent?`<div class="source-note">最近已完成的日 K：${date(recent.day)}。价格单位 USDT，成交量单位 ${esc(a.id.toUpperCase())}。</div>`:''}</div></section></div>`);
}

function eventSummary() {
  const total = data.events.length;
  const formCounts = ['8-K', '10-Q', '10-K'].map(form => ({ form, count: data.events.filter(e => e.form === form).length }));
  const companyRows = data.assets.filter(a => a.kind === 'equity').map(a => {
    const rows = data.events.filter(e => e.asset_id === a.id);
    return `<div class="event-company"><a class="text-link" href="#asset/${esc(a.id)}">${esc(a.symbol)}</a><span>${rows.length} 份</span><span>${date(rows[0]?.filed_at)}</span></div>`;
  }).join('');
  return `<div class="event-analysis-grid"><div class="panel panel-pad"><div class="panel-kicker">FILING MIX / CURRENT SAMPLE</div><div class="event-total">${total}<small>份 SEC 申报索引</small></div><div class="form-mix">${formCounts.map(({form,count}) => `<div class="mix-row"><span>${form}</span><progress max="${Math.max(total, 1)}" value="${count}" aria-label="${form} ${count} 份"></progress><strong>${count}</strong></div>`).join('')}</div><div class="source-note">按已采集的最近申报计数；这不是事件重要性、股价影响或完整市场发生率。</div></div><div class="panel panel-pad"><div class="panel-kicker">COMPANY COVERAGE</div><h3>试点公司披露覆盖</h3><div class="event-company-head"><span>公司</span><span>索引数</span><span>最近披露</span></div>${companyRows}<div class="source-note">每家公司最多取最近 30 份选定类型申报。点代码查看财务与原始文件。</div></div></div>`;
}

function eventsPage() {
  const rows = data.events.filter(e=>eventFilter==='all'||e.form===eventFilter);
  return title('EVENT EVIDENCE','事件证据','从正式披露开始追踪。当前是 SEC 申报索引，尚未进行新闻聚类或影响判断。') + eventSummary() + `<div class="filterbar"><div class="tabs">${[['all','全部'],['8-K','8-K'],['10-Q','10-Q'],['10-K','10-K']].map(([id,label])=>`<button type="button" data-event-filter="${id}" class="${eventFilter===id?'active':''}">${label}</button>`).join('')}</div><span class="muted">${rows.length} 条 · 试点公司</span></div><div class="panel">${rows.length?`<div class="table-wrap"><table class="data-table"><thead><tr><th>披露日</th><th>标的</th><th>类型</th><th>原始文件描述</th><th>来源</th></tr></thead><tbody>${rows.map(e=>`<tr><td>${date(e.filed_at)}</td><td><a class="text-link" href="#asset/${esc(e.asset_id)}">${esc(asset(e.asset_id)?.symbol||e.asset_id)}</a></td><td><span class="tag">${esc(e.form)}</span></td><td>${esc(e.title)}</td><td><a class="text-link" href="${esc(safeUrl(e.source_url))}" target="_blank" rel="noopener noreferrer">SEC 文件</a></td></tr>`).join('')}</tbody></table></div>`:empty('尚无披露记录','采集完成后可在这里按申报类型核查。')}</div><div class="source-note">重要事件分析将增加多来源证据、确认状态、影响路径和反证。当前任何一条申报均未自动标为「利好」或「利空」。</div>`;
}

function reportsPage() {
  return title('RESEARCH LIBRARY','研究报告','保留发表版本、来源和数据时点；后续主题研究可从同一入口阅读。') + (data.reports.length ? `<div class="report-cards">${data.reports.map(r=>`<a class="report-card" href="/reports/${encodeURIComponent(r.id)}"><div class="category">RESEARCH NOTE · ${date(r.published_at)}</div><h2>${esc(r.title)}</h2><p>${esc(r.description)}</p><div class="footer"><span>${esc(r.source_count)} 个来源 · 截至 ${date(r.as_of)}</span><span>阅读全文 →</span></div></a>`).join('')}</div>` : `<div class="panel">${empty('报告库待发布','第一批报告准备好后会显示在这里。')}</div>`) + `<div class="light-callout reports-callout">研究报告与实时看板承担不同任务：报告的结论和图表固定在发表时的数据版本，工作台显示最新可用读数。历史复盘时可以并排比较两者。</div>`;
}

function runsPage() {
  const sourceRows = data.assets.map(a=>{const run=latestRun(a.sourceId);const s=status(a);return `<div class="source-row"><div><strong>${esc(a.sourceId)}</strong><small>${esc(a.name)} · ${a.kind==='equity'?'SEC CompanyFacts + submissions':'Binance 日线'}</small></div><div class="right"><span class="tag ${s.kind}">${s.label}</span><small>${stamp(run?.finished_at)}</small></div></div>`;}).join('');
  return title('OPERATIONS','运行中心','看得到程序处理过程；失败和数据空白会保留状态，不会伪装成 0。') + `<div class="ops-grid"><section>${section('最近运行',`${data.runs.length} 条记录`)}<div class="panel panel-pad"><div class="run-list">${data.runs.length?data.runs.map(r=>`<div class="run-row"><span class="source mono">${esc(r.source_id)}</span><span class="${r.status==='failed'?'error':'muted'}">${r.status==='failed'?esc(r.error||'源失败'):r.status==='running'?'正在处理':'完成'}</span><span class="time">${stamp(r.finished_at||r.started_at)}</span><span class="count">${r.status==='ok'?`${Number(r.checked_count)||0} 条`:'—'}</span></div>`).join(''):empty('尚未开始自动采集','部署与首次回填后显示每个来源的核查记录。')}</div></div></section><section>${section('来源健康','当前试点')}<div class="panel panel-pad"><div class="source-list">${sourceRows}</div><div class="source-note">定时任务按市场时段增量核查。这里的「条」是本次检查的记录数，不等于新增记录数。</div></div></section></div>`;
}

function render() {
  if (!data) return;
  const route = decodeURIComponent(location.hash.slice(1)) || 'overview';
  const [page, id] = route.split('/');
  const pages = { overview: overview, assets: assetsPage, events: eventsPage, reports: reportsPage, runs: runsPage };
  app.innerHTML = page === 'asset' ? assetPage(id) : (pages[page] || overview)();
  document.querySelectorAll('[data-nav]').forEach(link => link.setAttribute('aria-current', (page==='asset'?'assets':page)===link.dataset.nav?'page':'false'));
  document.querySelector('#page-crumb').textContent = ({overview:'今日概览',assets:'标的与主题',asset:'标的详情',events:'事件证据',reports:'研究报告',runs:'运行中心'})[page]||'今日概览';
  document.querySelectorAll('[data-chart]').forEach(button=>button.addEventListener('click',()=>{ activeChart=button.dataset.chart; render(); }));
  document.querySelectorAll('[data-asset-filter]').forEach(button=>button.addEventListener('click',()=>{ assetFilter=button.dataset.assetFilter; render(); }));
  const search = document.querySelector('#asset-search');
  if (search) search.addEventListener('input',()=>{ assetQuery=search.value; const start=search.selectionStart; render(); const newSearch=document.querySelector('#asset-search'); newSearch?.focus(); newSearch?.setSelectionRange(start,start); });
  document.querySelectorAll('[data-event-filter]').forEach(button=>button.addEventListener('click',()=>{ eventFilter=button.dataset.eventFilter; render(); }));
}

async function load() {
  document.querySelector('#refresh-button').disabled = true;
  try {
    const response = await fetch('/api/state', { cache:'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    data = await response.json();
    loadError = false;
    document.querySelector('#updated-at').textContent = `读取 ${stamp(data.generatedAt)}`;
    render();
  } catch {
    loadError = true;
    app.innerHTML = title('DATA STATUS','数据暂不可读','无法读取研究台数据，请稍后刷新。') + `<div class="panel">${empty('连接失败','站点仍在线，数据接口暂时不可用。')}</div>`;
    document.querySelector('#updated-at').textContent = '数据暂不可用';
  } finally { document.querySelector('#refresh-button').disabled = false; }
}

const savedTheme = localStorage.getItem('research-desk-theme');
if (savedTheme === 'dark') root.dataset.theme = 'dark';
document.querySelector('#theme-button').textContent = root.dataset.theme==='dark'?'浅色':'深色';
document.querySelector('#theme-button').addEventListener('click',()=>{ root.dataset.theme = root.dataset.theme==='dark'?'light':'dark';localStorage.setItem('research-desk-theme',root.dataset.theme);document.querySelector('#theme-button').textContent=root.dataset.theme==='dark'?'浅色':'深色'; });
document.querySelector('#refresh-button').addEventListener('click',load);
window.addEventListener('hashchange',()=>{ if(data) {render(); window.scrollTo({top:0,behavior:'instant'});app.focus({preventScroll:true});} });
load();
