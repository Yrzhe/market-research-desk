const names = { 'a-share': 'A 股', 'hong-kong': '港股', us: '美股', crypto: '加密资产' };
const statusNames = { ok: '已更新', unconfigured: '未接入', missing: '字段缺失', failed: '采集失败', stale: '数据过期' };
const app = document.querySelector('#app');
const detailLayer = document.querySelector('#detail-layer');
let state;
let marketFilter = 'all';
let severityFilter = 'all';
let lastFocus = null;

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function safeUrl(value) {
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? escapeHtml(url.href) : null; }
  catch { return null; }
}
function dateTime(value) {
  if (!value || Number.isNaN(Date.parse(value))) return '—';
  return new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }).format(new Date(value));
}
function fullTime(value) {
  if (!value || Number.isNaN(Date.parse(value))) return '—';
  return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', timeZoneName: 'short' }).format(new Date(value));
}
function number(value, unit = '') {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  const digits = unit === '%' ? 2 : Math.abs(value) >= 1000 ? 0 : 2;
  return `${new Intl.NumberFormat('en-US', { maximumFractionDigits: digits }).format(value)}${unit === '%' ? '%' : unit ? ` ${escapeHtml(unit)}` : ''}`;
}
function signed(value, unit = '') {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return `${value > 0 ? '+' : ''}${number(value, unit)}`;
}
function displayMeasure(value, unit = '') {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  const digits = unit === '%' ? 2 : Math.abs(value) >= 1000 ? 0 : 2;
  const amount = new Intl.NumberFormat('en-US', { maximumFractionDigits: digits }).format(value);
  return `<span class="figure-amount">${amount}</span>${unit ? `<span class="figure-unit">${escapeHtml(unit)}</span>` : ''}`;
}
function escAttr(value) { return escapeHtml(value); }
function nav() { return ['overview', 'alerts', 'decisions', 'runs', 'about'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'overview'; }
function pageHead(title, subtitle) {
  return `<header class="page-head"><div><p class="eyebrow">四市场研究 ${new URLSearchParams(location.search).has('sample') ? '<span class="sample-flag">合成示例数据</span>' : ''}</p><h1 class="page-title">${title}</h1><p class="page-subtitle">${subtitle}</p></div><div class="head-meta"><span>数据读取于</span><strong>${fullTime(state.generatedAt)}</strong></div></header>`;
}
function sectionHead(title, note, link = '') {
  return `<div class="section-head"><div><h2 class="section-title">${title}</h2><p class="section-note">${note}</p></div>${link}</div>`;
}
function empty(title, text) { return `<div class="empty-state"><strong>${title}</strong><p>${text}</p></div>`; }

function overview() {
  const marketEntries = Object.entries(state.markets);
  const covered = marketEntries.filter(([, data]) => data.status === 'ok' && data.observations.length).length;
  const rail = marketEntries.map(([id, data]) => {
    const current = data.observations[0];
    const observation = data.observation;
    const stale = !current && observation;
    return `<button class="market-cell ${current ? '' : 'market-cell-empty'}" type="button" data-market="${escAttr(id)}" aria-label="查看${names[id]}证据">
      <span class="market-top"><span class="market-label">${names[id]}</span><span class="market-state"><span class="status-mark ${escAttr(data.status)}"></span>${statusNames[data.status] || '无数据'}</span></span>
      <span class="market-value ${current ? '' : 'empty'}">${current ? displayMeasure(current.value, current.unit) : '—'}</span>
      <span class="market-caption">${current ? escapeHtml(current.label) : data.status === 'unconfigured' ? '尚未接入指标' : statusNames[data.status] || '无数据'}${stale ? ' · 上次有效值仅供历史查阅' : ''}</span>
      <span class="market-time">${current ? dateTime(current.asOf) : stale ? `上次 ${dateTime(observation.asOf)}` : '尚无有效观察'}</span>
    </button>`;
  }).join('');
  const alerts = state.alerts.slice(0, 4);
  const alertRows = alerts.map(a => `<li><button class="data-row" type="button" data-alert="${escAttr(a.id)}"><span><span class="row-title">${escapeHtml(a.label)}</span><span class="row-sub">${names[a.market] || escapeHtml(a.market)} · 待核验 · ${escapeHtml(a.sourceId)}</span></span><span class="row-right"><span class="delta ${a.difference < 0 ? 'negative' : 'positive'}">${signed(a.percent, '%')}</span><span class="row-date">${dateTime(a.asOf)}</span></span></button></li>`).join('');
  const primaryAlert = alerts[0];
  const contextPoints = primaryAlert ? state.runs.map(r => r.observations?.find(o => o.sourceId === primaryAlert.sourceId && o.metricId === primaryAlert.metricId && o.unit === primaryAlert.unit && o.quality !== 'stale')).filter(Boolean).reverse() : [];
  const alertContext = contextPoints.length >= 2 ? `<div class="trend-snippet"><div class="trend-caption"><div><span class="trend-overline">本轮变化 · ${names[primaryAlert.market] || escapeHtml(primaryAlert.market)}</span><strong>${escapeHtml(primaryAlert.label)}</strong><span class="trend-current">${escapeHtml(primaryAlert.sourceId)} · ${dateTime(primaryAlert.asOf)}</span></div><strong class="trend-change ${primaryAlert.difference < 0 ? 'negative' : 'positive'}">${signed(primaryAlert.percent, '%')}</strong></div><div class="trend-measures"><div><span>前次有效读数</span><strong>${number(primaryAlert.before, primaryAlert.unit)}</strong></div><div><span>本次读数</span><strong>${number(primaryAlert.after, primaryAlert.unit)}</strong></div><div><span>变化量</span><strong class="${primaryAlert.difference < 0 ? 'negative' : 'positive'}">${signed(primaryAlert.difference, primaryAlert.unit)}</strong></div></div><div class="trend-context">最近 ${contextPoints.length} 次可比观察</div>${trendSvg(contextPoints, primaryAlert.unit)}<div class="trend-footer"><span>同一来源与指标的归档值</span><button class="text-button" type="button" data-alert="${escAttr(primaryAlert.id)}">查看计算与来源</button></div></div>` : '';
  const sourceRows = state.latest?.sources?.map(s => `<div class="health-item"><span class="source-name">${names[s.market] || escapeHtml(s.market)} <span class="row-sub">${escapeHtml(s.id)}</span></span><span class="source-state ${escAttr(s.status)}">${statusNames[s.status] || escapeHtml(s.status)}</span></div>`).join('') || '';
  const due = (state.decisions || []).filter(d => d.reviewAt && !d.verifiedAt && Date.parse(d.reviewAt) <= Date.parse(state.generatedAt));
  const dueRows = due.slice(0, 3).map(d => `<li><button class="data-row" type="button" data-decision="${escAttr(d.id)}"><span><span class="row-title">${escapeHtml(d.asset)}</span><span class="row-sub">${names[d.market]} · ${escapeHtml(d.verdict)} · 到期复核</span></span><span class="row-right"><span class="row-date">${dateTime(d.reviewAt)}</span></span></button></li>`).join('');
  const dueSection = `<section class="due-section">${sectionHead('到期复盘', due.length ? `${due.length} 条待复核` : '当前无待复核', '<a class="section-link" href="#decisions">判断台账</a>')}<div class="due-content">${dueRows ? `<ul class="row-list">${dueRows}</ul>` : empty('目前没有到期判断', '新研究判断导入后，在此显示复核日期。')}</div></section>`;
  const matrix = marketEntries.map(([id, data]) => {
    const o = data.observations[0];
    return `<tr><td class="market-name">${names[id]}</td><td class="muted">${o ? escapeHtml(o.label) : statusNames[data.status] || '无数据'}</td><td class="number">${o ? number(o.value, o.unit) : '—'}</td><td class="muted">${o ? dateTime(o.asOf) : '—'}</td><td class="view-cell"><button class="text-button" type="button" data-market="${escAttr(id)}">查看证据</button></td></tr>`;
  }).join('');
  return pageHead('市场监测', '四市场事实快照、变化证据与研究复盘。') +
    `<section class="panel coverage-panel" aria-label="四市场覆盖"><div class="coverage-intro"><strong>四市场快照</strong><span class="coverage-count">本轮有效覆盖 ${covered} / 4</span></div><div class="coverage-grid">${rail}</div></section>` +
    `<div class="work-grid panel"><section class="investigation"><div class="investigation-head">${sectionHead('需要核验', '达到阈值的事实变化', '<a class="section-link" href="#alerts">查看全部</a>')}</div><div class="signal-panel">${alerts.length ? `${alertContext}<div class="signal-list-head"><strong>变化队列</strong><span>${alerts.length} 条待核验</span></div><ul class="row-list">${alertRows}</ul>` : empty('没有待核验提醒', '新的可比变化会出现在这里。')}</div></section>` +
    `<aside class="work-side"><section class="operation-section">${sectionHead('自动运行', '本轮来源状态', '<a class="section-link" href="#runs">运行档案</a>')}${sourceRows ? `<div class="run-caption">${dateTime(state.latest.startedAt)} · 运行 ${escapeHtml(state.latest.runId.slice(-6))}</div><div class="health-list">${sourceRows}</div>` : empty('等待首次运行', '接入来源后运行监控。')}</section>${dueSection}</aside></div>` +
    `<section>${sectionHead('市场截面', '数值、单位与观察时间来自最近一轮有效记录')}<div class="panel matrix-panel"><div class="table-wrap"><table class="matrix"><thead><tr><th>市场</th><th>观察指标</th><th>最新值</th><th>观察时间</th><th></th></tr></thead><tbody>${matrix}</tbody></table></div></div><div class="below-note"><span><i class="line-mark"></i> 有效覆盖</span><span>失效来源不沿用旧值触发提醒</span><span>点击市场查看历史与来源</span></div></section>`;
}

function decisionsPage() {
  const items = state.decisions || [];
  const due = items.filter(d => d.reviewAt && !d.verifiedAt && Date.parse(d.reviewAt) <= Date.parse(state.generatedAt));
  const selected = due[0] || items[0];
  const rows = items.map(d => `<li><button class="data-row" type="button" data-decision="${escAttr(d.id)}"><span><span class="row-title">${escapeHtml(d.asset)}</span><span class="row-sub">${names[d.market]} · ${escapeHtml(d.verdict)}</span></span><span class="row-right"><span class="delta ${d.reviewAt && !d.verifiedAt && Date.parse(d.reviewAt) <= Date.parse(state.generatedAt) ? 'negative' : ''}">${d.verifiedAt ? '已复核' : d.reviewAt ? '待复核' : '未设复核日'}</span><span class="row-date">${d.reviewAt ? dateTime(d.reviewAt) : '—'}</span></span></button></li>`).join('');
  const preview = selected ? `<div class="decision-preview"><div class="decision-preview-top"><span>${names[selected.market]} · ${dateTime(selected.asOf)}</span><strong>${escapeHtml(selected.verdict)}</strong></div><h3>${escapeHtml(selected.asset)}</h3><div class="decision-fact"><span>核心依据</span><p>${escapeHtml(selected.thesis || '未提供')}</p></div><div class="decision-fact"><span>最强反证</span><p>${escapeHtml(selected.counterEvidence || '未提供')}</p></div><div class="decision-preview-foot"><span>复核 ${selected.reviewAt ? dateTime(selected.reviewAt) : '未设定'}</span><button class="text-button" type="button" data-decision="${escAttr(selected.id)}">查看完整判断</button></div></div>`
    : empty('等待研究流程接入', '把监控提醒交给研究流程核对，再由私有台账导出有依据、有反证和复核日的判断。');
  return pageHead('判断台账', '按日期回看判断、反证与复核。') +
    `<section class="panel wide-panel decision-summary"><div class="summary-strip"><div><strong>${items.length}</strong><span>已导入判断</span></div><div><strong>${due.length}</strong><span>到期复核</span></div><div><strong>${items.filter(d => d.verifiedAt).length}</strong><span>已复核</span></div></div>${state.decisionError ? '<div class="error-notice">部分判断记录格式无效，请检查私有导出文件。</div>' : ''}</section>` +
    `<section class="panel decision-workspace ${items.length <= 1 ? 'decision-single' : ''}">${items.length > 1 ? `<div class="decision-list-pane"><div class="panel-head"><div><h2 class="section-title">研究记录</h2><p class="section-note">按最近复核日期</p></div></div><ul class="row-list">${rows}</ul></div>` : ''}<div class="decision-preview-pane"><div class="panel-head"><div><h2 class="section-title">${selected ? '当前判断' : '研究记录'}</h2><p class="section-note">${selected ? '依据与反证' : '等待研究材料'}</p></div></div>${preview}</div></section>`;
}

function alertsPage() {
  const visible = state.alerts.filter(a => (marketFilter === 'all' || a.market === marketFilter) && (severityFilter === 'all' || a.severity === severityFilter));
  const rows = visible.map(a => `<li><button class="data-row" type="button" data-alert="${escAttr(a.id)}"><span><span class="row-title">${escapeHtml(a.label)}</span><span class="row-sub">${names[a.market] || escapeHtml(a.market)} · ${escapeHtml(a.sourceId)} · ${escapeHtml(a.status)}</span></span><span class="delta ${a.difference < 0 ? 'negative' : 'positive'}">${signed(a.difference, a.unit)}</span><span class="row-date">${dateTime(a.asOf)}</span></button></li>`).join('');
  return pageHead('待核验', '逐条查看可比变化、计算与来源。') +
    `<section>${sectionHead('观察队列', `${visible.length} 条符合筛选条件`, `<div class="filters"><label><span class="sr-only">市场</span><select id="market-filter" class="filter-select"><option value="all">全部市场</option>${Object.entries(names).map(([id,name]) => `<option value="${id}" ${marketFilter === id ? 'selected' : ''}>${name}</option>`).join('')}</select></label><label><span class="sr-only">严重度</span><select id="severity-filter" class="filter-select"><option value="all">全部状态</option><option value="review" ${severityFilter === 'review' ? 'selected' : ''}>待核验</option></select></label></div>`)}</section>` +
    `<div class="panel wide-panel"><div class="list-heading"><span>事件与来源</span><span>变化量</span><span>观察时间</span></div>${rows ? `<ul class="row-list alert-list">${rows}</ul>` : empty('没有符合条件的提醒', '可调整筛选，或等待配置的监控规则捕获新的可比变化。')}</div>`;
}

function runsPage() {
  const totalObs = state.runs.reduce((sum, r) => sum + r.observationCount, 0);
  const rows = state.runs.map(r => `<li><button class="data-row" type="button" data-run="${escAttr(r.runId)}"><span><span class="row-title">监控运行 · ${dateTime(r.startedAt)}</span><span class="row-sub">ID ${escapeHtml(r.runId.slice(-6))} · ${r.observationCount} 条观察 · ${r.alertCount} 条提醒 · ${r.sources.filter(s => s.status === 'failed').length} 个来源失败</span></span><span class="row-date">查看证据</span></button></li>`).join('');
  return pageHead('运行档案', '每轮采集的读数、来源与失败记录。') +
    `<section class="panel wide-panel"><div class="summary-strip"><div><strong>${state.runs.length}</strong><span>最近归档轮次</span></div><div><strong>${totalObs}</strong><span>其中观察值</span></div><div><strong>${state.alerts.length}</strong><span>其中待核验事件</span></div></div>${rows ? `<ul class="row-list run-list">${rows}</ul>` : empty('尚无运行档案', '在服务器执行 npm run monitor，即可产生第一份带时间的事实记录。')}</section>`;
}

function aboutPage() {
  return pageHead('配置说明', '数据源、通知与研究档案由部署者私下配置。') +
    `<div class="about-grid"><section class="panel about-card"><h2>接入来源</h2><p>复制示例配置到私有的 <code>config/local.json</code>，按市场添加 HTTPS JSON API 或本地脚本。每个指标指定 JSON 字段、单位、观察时间及可选变化阈值。</p><ul><li>API 地址由环境变量提供</li><li>授权信息写进环境变量，不进仓库</li><li>脚本只从 <code>scripts/monitors/</code> 执行</li></ul></section><section class="panel about-card"><h2>自动运行</h2><p>在 VPS 使用系统定时器调用同一个监控命令。加密资产可按 UTC 时点采样；股票应安排在各自市场完整收盘之后。</p><p>Telegram 和 webhook 为可选的出站提醒，未配置时不会发送。</p></section><section class="panel about-card"><h2>证据与判断</h2><p>本程序负责采集、比较与提醒。是否值得持有，需要另行核对披露、估值、反证和期限，并通过独立研究流程记录。</p><p>页面只读；没有下单、自动买卖或网页执行脚本的入口。</p></section><section class="panel about-card"><h2>访问边界</h2><p>网页默认只监听本机。要通过 Cloudflare Tunnel 访问，先为域名设置 Access 身份验证，并保持服务只监听 <code>127.0.0.1</code>。</p><p>公开仓库不包含任何真实运行包或个人账户信息。</p></section></div>`;
}

function openDetail(html) {
  if (detailLayer.hidden) lastFocus = document.activeElement;
  detailLayer.innerHTML = `<div class="detail-panel" role="dialog" aria-modal="true" aria-label="证据详情">${html}</div>`;
  detailLayer.hidden = false;
  document.body.classList.add('has-detail');
  detailLayer.querySelector('.close-button')?.focus();
}
function closeDetail() {
  detailLayer.hidden = true;
  detailLayer.innerHTML = '';
  document.body.classList.remove('has-detail');
  lastFocus?.focus();
}
function detailHead(kicker, title) {
  return `<div class="detail-head"><div><div class="detail-kicker">${escapeHtml(kicker)}</div><h2>${escapeHtml(title)}</h2></div><button class="close-button" type="button" data-close aria-label="关闭详情">×</button></div>`;
}
function alertDetail(id) {
  const a = state.alerts.find(item => item.id === id);
  if (!a) return;
  const source = state.runs.find(r => r.runId === a.runId)?.sources.find(s => s.id === a.sourceId);
  const link = safeUrl(source?.sourceUrl);
  const thresholds = [a.thresholds?.absolute != null ? `绝对变化 ≥ ${number(a.thresholds.absolute, a.unit)}` : '',
    a.thresholds?.percent != null ? `相对变化 ≥ ${number(a.thresholds.percent, '%')}` : ''].filter(Boolean).join('；') || '见本轮规则定义';
  openDetail(detailHead(`${names[a.market] || a.market} · 待核验`, a.label) +
    `<div class="detail-measure"><div><span>前次有效读数</span><strong>${number(a.before, a.unit)}</strong></div><div><span>本次读数</span><strong>${number(a.after, a.unit)}</strong></div></div>` +
    `<section class="detail-section"><h3>变化计算</h3><dl class="fact-list"><dt>绝对变化</dt><dd>${signed(a.difference, a.unit)}</dd><dt>相对变化</dt><dd>${signed(a.percent, '%')}</dd><dt>触发阈值</dt><dd>${thresholds}</dd><dt>公式</dt><dd>${escapeHtml(a.formula)}</dd><dt>前次时点</dt><dd>${fullTime(a.beforeAsOf)}</dd><dt>本次时点</dt><dd>${fullTime(a.asOf)}</dd></dl></section>` +
    `<section class="detail-section"><h3>证据定位</h3><dl class="fact-list"><dt>运行 ID</dt><dd class="inline-code">${escapeHtml(a.runId)}</dd><dt>提醒 ID</dt><dd class="inline-code">${escapeHtml(a.id)}</dd><dt>来源</dt><dd>${escapeHtml(a.sourceId)}</dd><dt>来源网址</dt><dd>${link ? `<a href="${link}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.sourceUrl)}</a>` : '未提供公开网址'}</dd><dt>研究状态</dt><dd>待核验；尚无投资结论</dd></dl></section>`);
}
function runDetail(id) {
  const r = state.runs.find(item => item.runId === id);
  if (!r) return;
  const sourceRows = r.sources.map(s => `<div class="health-item"><span class="source-name">${escapeHtml(s.id)} · ${names[s.market] || escapeHtml(s.market)}</span><span class="source-state ${escAttr(s.status)}">${statusNames[s.status] || escapeHtml(s.status)}</span></div>`).join('');
  const observationRows = r.observations?.map(o => `<div class="health-item"><span class="source-name">${escapeHtml(o.label)} <span class="row-sub">${dateTime(o.asOf)}</span></span><span class="source-state">${number(o.value, o.unit)}</span></div>`).join('') || '';
  openDetail(detailHead('运行档案', r.runId) +
    `<section class="detail-section"><dl class="fact-list"><dt>开始时间</dt><dd>${fullTime(r.startedAt)}</dd><dt>结束时间</dt><dd>${fullTime(r.finishedAt)}</dd><dt>观察值</dt><dd>${r.observationCount}</dd><dt>提醒</dt><dd>${r.alertCount}</dd></dl></section>` +
    `<section class="detail-section"><h3>来源状态</h3><div>${sourceRows}</div></section>` +
    `<section class="detail-section"><h3>本轮观察</h3>${observationRows || '<p class="section-note">此轮无有效观察，或详细记录已超过看板索引范围。</p>'}</section>`);
}
function trendSvg(points, unit = '') {
  if (points.length < 2) return '<p class="section-note">至少两次可比观察后显示趋势。</p>';
  const values = points.map(p => p.value), min = Math.min(...values), max = Math.max(...values);
  const span = max - min || Math.max(Math.abs(max) * .02, 1);
  const upper = max + span * .16, lower = min - span * .16;
  const draw = (width, left, bottom, compact) => {
    const right = width - 16, top = 20;
    const y = value => bottom - (value - lower) / (upper - lower) * (bottom - top);
    const x = i => i / (points.length - 1) * (right - left) + left;
    const plot = points.map((p, i) => `${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
    const ticks = [upper, (upper + lower) / 2, lower].map(value => `<line class="gridline" x1="${left}" x2="${right}" y1="${y(value).toFixed(1)}" y2="${y(value).toFixed(1)}"/><text class="axis-label" x="2" y="${(y(value) + 4).toFixed(1)}">${compact ? number(value) : number(value, unit)}</text>`).join('');
    const dateLabel = value => compact ? new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit' }).format(new Date(value)) : dateTime(value);
    const dates = [0, points.length - 1].map(i => `<text class="axis-date" x="${x(i).toFixed(1)}" y="${bottom + 27}" text-anchor="${i === 0 ? 'start' : 'end'}">${escapeHtml(dateLabel(points[i].asOf))}</text>`).join('');
    const last = points.length - 1;
    return `<svg class="chart ${compact ? 'chart-mobile' : 'chart-desktop'}" viewBox="0 0 ${width} ${bottom + 40}" role="img" aria-label="${points.length} 次观察的趋势图，范围 ${number(min, unit)} 至 ${number(max, unit)}">${ticks}<line class="current-guide" x1="${x(last).toFixed(1)}" x2="${x(last).toFixed(1)}" y1="${y(points[last].value).toFixed(1)}" y2="${bottom}"/><polyline class="series" points="${plot}"/><circle class="chart-dot" cx="${x(last).toFixed(1)}" cy="${y(points[last].value).toFixed(1)}" r="4"/>${dates}</svg>`;
  };
  return draw(620, 72, 170, false) + draw(340, 48, 150, true);
}
function marketDetail(id) {
  const data = state.markets[id];
  if (!data) return;
  const current = data.observations[0];
  const source = state.latest?.sources?.find(s => s.id === current?.sourceId) || state.latest?.sources?.find(s => s.market === id);
  const metricId = current?.metricId;
  const points = state.runs.map(r => r.observations?.find(o => o.market === id && o.metricId === metricId && o.sourceId === current?.sourceId && o.unit === current?.unit && o.quality !== 'stale')).filter(Boolean).reverse();
  const link = safeUrl(source?.sourceUrl);
  openDetail(detailHead(names[id], '市场证据') +
    `<div class="detail-measure"><div><span>本轮状态</span><strong class="status-value">${statusNames[data.status] || '无数据'}</strong></div><div><span>最新有效值</span><strong>${current ? number(current.value, current.unit) : '—'}</strong></div></div>` +
    `<section class="detail-section"><h3>指标趋势</h3>${trendSvg(points, current?.unit || '')}<p class="section-note">同一来源、同一指标的已归档观察；无可比记录时不绘制趋势。</p></section>` +
    `<section class="detail-section"><h3>来源与时间</h3><dl class="fact-list"><dt>指标</dt><dd>${current ? escapeHtml(current.label) : '未接入或本轮无有效值'}</dd><dt>观察时间</dt><dd>${current ? fullTime(current.asOf) : '—'}</dd><dt>采集时间</dt><dd>${current ? fullTime(current.fetchedAt) : '—'}</dd><dt>来源</dt><dd>${source ? escapeHtml(source.id) : '—'}</dd><dt>来源网址</dt><dd>${link ? `<a href="${link}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.sourceUrl)}</a>` : '未提供公开网址'}</dd></dl></section>`);
}

function decisionDetail(id) {
  const d = (state.decisions || []).find(item => item.id === id);
  if (!d) return;
  const evidence = Array.isArray(d.evidenceRunIds) ? d.evidenceRunIds.map(runId => state.runs.some(r => r.runId === runId)
    ? `<button class="text-button evidence-link" type="button" data-run="${escAttr(runId)}">${escapeHtml(runId)}</button>`
    : `<span class="inline-code">${escapeHtml(runId)} · 不在最近索引中</span>`).join('') : '';
  openDetail(detailHead(`${names[d.market]} · 研究判断`, d.asset) +
    `<div class="detail-measure"><div><span>本轮结论</span><strong class="status-value">${escapeHtml(d.verdict)}</strong></div><div><span>适用价格</span><strong>${number(d.price, d.currency || '')}</strong></div></div>` +
    `<section class="detail-section"><h3>判断范围</h3><dl class="fact-list"><dt>研究时间</dt><dd>${fullTime(d.asOf)}</dd><dt>研究期限</dt><dd>${escapeHtml(d.horizon || '未注明')}</dd><dt>复核日期</dt><dd>${d.reviewAt ? fullTime(d.reviewAt) : '未设定'}</dd><dt>复核状态</dt><dd>${d.verifiedAt ? `已复核 · ${fullTime(d.verifiedAt)}` : '待复核'}</dd></dl></section>` +
    `<section class="detail-section"><h3>依据与反证</h3><dl class="fact-list"><dt>核心依据</dt><dd>${escapeHtml(d.thesis || '未提供')}</dd><dt>最强反证</dt><dd>${escapeHtml(d.counterEvidence || '未提供')}</dd><dt>证伪条件</dt><dd>${escapeHtml(d.invalidatedBy || '未提供')}</dd></dl></section>` +
    `<section class="detail-section"><h3>证据关联</h3><dl class="fact-list"><dt>判断 ID</dt><dd class="inline-code">${escapeHtml(d.id)}</dd><dt>运行档案</dt><dd>${evidence || '未关联运行'}</dd></dl></section>`);
}

function render() {
  if (!state) return;
  const section = nav();
  document.querySelectorAll('[data-nav]').forEach(a => a.setAttribute('aria-current', a.dataset.nav === section ? 'page' : 'false'));
  app.innerHTML = ({ overview, alerts: alertsPage, decisions: decisionsPage, runs: runsPage, about: aboutPage })[section]();
}
async function load() {
  try {
    const sample = new URLSearchParams(location.search).has('sample');
    const response = await fetch(sample ? '/sample.json' : '/api/state', { cache: 'no-store' });
    if (!response.ok) throw new Error('Load failed');
    state = await response.json();
    render();
  } catch { app.innerHTML = '<div class="error-notice">暂时无法读取运行档案。请检查本机服务和数据目录。</div>'; }
}
document.addEventListener('click', event => {
  const target = event.target.closest('[data-alert],[data-run],[data-market],[data-decision],[data-close]');
  if (!target) return;
  if (target.dataset.close !== undefined) closeDetail();
  else if (target.dataset.alert) alertDetail(target.dataset.alert);
  else if (target.dataset.run) runDetail(target.dataset.run);
  else if (target.dataset.market) marketDetail(target.dataset.market);
  else if (target.dataset.decision) decisionDetail(target.dataset.decision);
});
detailLayer.addEventListener('click', event => { if (event.target === detailLayer) closeDetail(); });
document.addEventListener('keydown', event => {
  if (detailLayer.hidden) return;
  if (event.key === 'Escape') { closeDetail(); return; }
  if (event.key === 'Tab') {
    const focusables = [...detailLayer.querySelectorAll('button,a[href],select,[tabindex]:not([tabindex="-1"])')];
    const first = focusables[0], last = focusables.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }
});
document.addEventListener('change', event => {
  if (event.target.id === 'market-filter') marketFilter = event.target.value;
  if (event.target.id === 'severity-filter') severityFilter = event.target.value;
  if (event.target.id === 'market-filter' || event.target.id === 'severity-filter') render();
});
document.querySelector('#theme-toggle').addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem('theme', next); } catch {}
});
document.querySelector('#refresh-button').addEventListener('click', load);
window.addEventListener('hashchange', () => { closeDetail(); render(); });
try { if (localStorage.getItem('theme') === 'dark') document.documentElement.dataset.theme = 'dark'; } catch {}
load();
