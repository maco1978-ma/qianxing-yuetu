'use strict';

/**
 * 黔行阅途研学 - 腾讯云SCF云函数
 * 
 * 功能：
 *   POST /api/signup    → 接收报名数据
 *   GET  /api/submissions → 查询报名列表（带筛选）
 *   GET  /api/stats     → 按线路/城市统计
 *   GET  /admin         → 管理后台页面
 * 
 * 数据存储：SCF临时目录 /tmp（重启后数据重置，建议正式使用时加COS备份）
 * 依赖：无（纯原生Node.js）
 */

const fs = require('fs');
const path = require('path');

const DATA_FILE = '/tmp/submissions.json';

// ─── 数据读写 ────────────────────────────────────────────

function readAll() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Read error:', e.message);
  }
  return [];
}

function writeAll(records) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(records, null, 2), 'utf-8');
}

// ─── 响应格式 ────────────────────────────────────────────

function respond(statusCode, body, isHtml = false) {
  const headers = {
    'Content-Type': isHtml ? 'text/html; charset=utf-8' : 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
  // 明确设置 Content-Disposition: inline 覆盖SCF网关默认加的 attachment
  headers['Content-Disposition'] = 'inline';
  // 移除 SCF 网关可能自动添加的第二个 Content-Type（返回数组在 SCF 中会合并，这里确保只有我们设置的一个）
  return {
    statusCode,
    headers,
    body: isHtml ? body : JSON.stringify(body)
  };
}

// ─── Admin页面 ────────────────────────────────────────────

function adminPage() {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>研学报名管理后台</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#f2f2f7;color:#1d1d1f;padding:20px}
    h1{font-size:24px;font-weight:700;margin-bottom:20px}
    .stats{display:flex;gap:12px;margin-bottom:20px}
    .stat-card{background:white;border-radius:12px;padding:16px 20px;flex:1;box-shadow:0 1px 3px rgba(0,0,0,0.08)}
    .stat-card .num{font-size:28px;font-weight:700;color:#007aff}
    .stat-card .label{font-size:13px;color:#8e8e93;margin-top:4px}
    .filters{display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap}
    .filters select,.filters input{padding:8px 12px;border:1px solid #d1d1d6;border-radius:8px;font-size:14px;background:white}
    .filters button{padding:8px 16px;border:none;border-radius:8px;background:#007aff;color:white;font-size:14px;cursor:pointer}
    .export-btn{padding:8px 16px;border:none;border-radius:8px;background:#34c759;color:white;font-size:14px;cursor:pointer}
    table{width:100%;background:white;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);border-collapse:collapse;font-size:14px}
    th,td{padding:12px 16px;text-align:left;border-bottom:0.5px solid #e5e5ea}
    th{background:#f7f7fa;font-weight:600;color:#6e6e73;font-size:12px;position:sticky;top:0}
    .badge{display:inline-block;padding:3px 8px;border-radius:6px;font-size:12px;font-weight:500}
    .badge-bj{background:#e8f2ff;color:#004fad}
    .badge-hnx{background:#e9f9ee;color:#1a8a3e}
    .badge-yga{background:#eee9fe;color:#5e5ce6}
    @media(max-width:640px){.stats{flex-direction:column}}
  </style>
</head>
<body>
  <h1>📋 研学报名管理</h1>
  <div class="stats">
    <div class="stat-card"><div class="num" id="statTotal">-</div><div class="label">总报名数</div></div>
    <div class="stat-card"><div class="num" id="statToday">-</div><div class="label">今日新增</div></div>
  </div>
  <div class="filters">
    <select id="filterRoute"><option value="">全部线路</option><option value="北京6天">北京6天</option><option value="沪宁锡7天">沪宁锡7天</option><option value="粤港澳6天">粤港澳6天</option></select>
    <select id="filterCity"><option value="">全部城市</option><option value="贵阳市">贵阳市</option><option value="遵义市">遵义市</option><option value="六盘水市">六盘水市</option><option value="安顺市">安顺市</option><option value="毕节市">毕节市</option><option value="铜仁市">铜仁市</option><option value="黔东南州">黔东南州</option><option value="黔南州">黔南州</option><option value="黔西南州">黔西南州</option></select>
    <input id="filterKeyword" placeholder="搜索姓名/电话" style="width:160px">
    <button onclick="loadData()">查询</button>
    <button class="export-btn" onclick="exportCSV()">导出CSV</button>
  </div>
  <div style="overflow-x:auto;border-radius:12px">
    <table><thead><tr><th>#</th><th>孩子</th><th>线路</th><th>家长</th><th>电话</th><th>门店</th><th>时间</th></tr></thead><tbody id="tableBody"></tbody></table>
  </div>
  <script>
    const badgeMap={'北京6天':'badge-bj','沪宁锡7天':'badge-hnx','粤港澳6天':'badge-yga'}
    async function loadData(){
      const r=document.getElementById('filterRoute').value,c=document.getElementById('filterCity').value,k=document.getElementById('filterKeyword').value.trim()
      const p=new URLSearchParams();if(r)p.set('route',r);if(c)p.set('city',c);if(k)p.set('keyword',k)
      const res=await fetch('/api/submissions?'+p).then(r=>r.json())
      if(!res.success)return
      const tbody=document.getElementById('tableBody')
      if(!res.data.length){tbody.innerHTML='<tr><td colspan="7" style="text-align:center;padding:32px;color:#8e8e93;">暂无报名数据</td></tr>';document.getElementById('statTotal').textContent='0';document.getElementById('statToday').textContent='0';return}
      document.getElementById('statTotal').textContent=res.data.length
      const today=new Date().toISOString().slice(0,10)
      document.getElementById('statToday').textContent=res.data.filter(d=>d.created_at&&d.created_at.startsWith(today)).length
      tbody.innerHTML=res.data.map((d,i)=>'<tr><td>'+(i+1)+'</td><td><strong>'+esc(d.child_name)+'</strong>'+(d.child_age?'<br><span style="font-size:12px;color:#8e8e93;">'+esc(d.child_age)+'岁</span>':'')+'</td><td><span class="badge '+(badgeMap[d.route]||'')+'">'+esc(d.route)+'</span></td><td>'+esc(d.parent_name)+'</td><td>'+esc(d.phone)+'</td><td>'+esc(d.city)+'<br><span style="font-size:12px;color:#8e8e93;">'+esc(d.store)+'</span></td><td style="font-size:13px;color:#6e6e73;">'+(d.created_at||'')+'</td></tr>').join('')
    }
    function exportCSV(){
      fetch('/api/submissions').then(r=>r.json()).then(res=>{
        if(!res.data)return
        const h=['ID','孩子姓名','年龄','意向线路','家长姓名','联系电话','所在城市','报名门店','备注','提交时间']
        const csv=h.join(',');const rows=res.data.map(r=>[r.id,csvEsc(r.child_name),csvEsc(r.child_age),csvEsc(r.route),csvEsc(r.parent_name),csvEsc(r.phone),csvEsc(r.city),csvEsc(r.store),csvEsc(r.remark),r.created_at||''].join(','))
        const blob=new Blob(['\\uFEFF'+csv+'\\n'+rows.join('\\n')],{type:'text/csv;charset=utf-8'})
        const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='研学报名_'+new Date().toISOString().slice(0,10)+'.csv';a.click()
      })
    }
    function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;')}
    function csvEsc(s){const v=String(s||'');return v.includes(',')||v.includes('"')?'"'+v.replace(/"/g,'""')+'"':v}
    loadData()
  </script>
</body>
</html>`;
}

// ─── 主入口 ────────────────────────────────────────────────

exports.main_handler = async (event) => {
  try {
    const path = (event.path || event.url || '/').toLowerCase();
    const method = (event.httpMethod || event.method || 'GET').toUpperCase();
    let body = {};

    if (event.body) {
      try {
        body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
      } catch { body = {}; }
    }

    // CORS预检
    if (method === 'OPTIONS') {
      return { statusCode: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' }, body: '' };
    }

    // ── POST /api/signup ──
    if (path === '/api/signup' && method === 'POST') {
      const { childName, childAge, route, parentName, phone, city, store, remark, source } = body;
      if (!childName || !route || !parentName || !phone || !city || !store) {
        return respond(200, { success: false, message: '请填写必填字段' });
      }

      const records = readAll();
      const record = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        child_name: childName,
        child_age: childAge || '',
        route,
        parent_name: parentName,
        phone,
        city,
        store,
        remark: remark || '',
        source: source || '',
        created_at: new Date().toISOString().replace('T', ' ').slice(0, 19)
      };
      records.push(record);
      writeAll(records);

      return respond(200, { success: true, message: '报名成功！工作人员将在24小时内与您联系。', id: record.id });
    }

    // ── GET /api/submissions ──
    if (path === '/api/submissions' && method === 'GET') {
      const query = event.queryString || event.query || {};
      let records = readAll().sort((a, b) => b.created_at.localeCompare(a.created_at));

      if (query.route) records = records.filter(r => r.route === query.route);
      if (query.city) records = records.filter(r => r.city === query.city);
      if (query.keyword) records = records.filter(r =>
        r.child_name.includes(query.keyword) || r.parent_name.includes(query.keyword) || r.phone.includes(query.keyword)
      );

      return respond(200, { success: true, data: records });
    }

    // ── GET /api/stats ──
    if (path === '/api/stats' && method === 'GET') {
      const records = readAll();
      const byRoute = {}, byCity = {};
      const todayStr = new Date().toISOString().slice(0, 10);
      let today = 0;

      records.forEach(r => {
        byRoute[r.route] = (byRoute[r.route] || 0) + 1;
        byCity[r.city] = (byCity[r.city] || 0) + 1;
        if (r.created_at && r.created_at.startsWith(todayStr)) today++;
      });

      return respond(200, {
        success: true,
        data: {
          total: records.length,
          today,
          byRoute: Object.entries(byRoute).map(([k, v]) => ({ route: k, count: v })),
          byCity: Object.entries(byCity).map(([k, v]) => ({ city: k, count: v }))
        }
      });
    }

    // ── GET /admin ──
    if (path === '/admin' || path === '/admin/') {
      return respond(200, adminPage(), true);
    }

    // ── 404 ──
    return respond(404, { success: false, message: 'Not Found' });

  } catch (err) {
    console.error('SCF Error:', err);
    return respond(500, { success: false, message: '服务器内部错误' });
  }
};
