const express = require('express');
const cors = require('cors');
const path = require('path');
const Database = require('better-sqlite3');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Database ────────────────────────────────────────────────
const db = new Database(path.join(__dirname, 'signups.db'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS signups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    child_name TEXT NOT NULL,
    child_age TEXT DEFAULT '',
    route TEXT NOT NULL,
    parent_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    city TEXT NOT NULL,
    store TEXT NOT NULL,
    remark TEXT DEFAULT '',
    source TEXT DEFAULT '',
    created_at DATETIME DEFAULT (datetime('now', '+8 hours'))
  )
`);

// ─── Middleware ───────────────────────────────────────────────
app.use(cors());

// 托管前端静态文件（让前端和后端同域，扫码直接打开）
app.use(express.static(path.join(__dirname, '..')));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── API Routes ──────────────────────────────────────────────

// 提交报名
app.post('/api/signup', (req, res) => {
  const { childName, childAge, route, parentName, phone, city, store, remark, source } = req.body;

  // 基础校验
  if (!childName || !route || !parentName || !phone || !city || !store) {
    return res.json({ success: false, message: '请填写必填字段' });
  }

  try {
    const stmt = db.prepare(`
      INSERT INTO signups (child_name, child_age, route, parent_name, phone, city, store, remark, source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(childName, childAge || '', route, parentName, phone, city, store, remark || '', source || '');

    res.json({
      success: true,
      message: '报名成功！工作人员将在24小时内与您联系。',
      id: result.lastInsertRowid
    });
  } catch (err) {
    console.error('DB insert error:', err);
    res.json({ success: false, message: '提交失败，请稍后重试' });
  }
});

// 查询报名列表（管理用）
app.get('/api/submissions', (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  const offset = (page - 1) * limit;
  const route = req.query.route || '';
  const city = req.query.city || '';
  const store = req.query.store || '';
  const keyword = req.query.keyword || '';

  let where = 'WHERE 1=1';
  const params = [];

  if (route) { where += ' AND route = ?'; params.push(route); }
  if (city) { where += ' AND city = ?'; params.push(city); }
  if (store) { where += ' AND store = ?'; params.push(store); }
  if (keyword) { where += ' AND (child_name LIKE ? OR parent_name LIKE ? OR phone LIKE ?)'; params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`); }

  const countRow = db.prepare(`SELECT COUNT(*) as total FROM signups ${where}`).get(...params);
  const rows = db.prepare(`SELECT * FROM signups ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...params, limit, offset);

  res.json({
    success: true,
    data: rows,
    total: countRow.total,
    page,
    limit,
    totalPages: Math.ceil(countRow.total / limit)
  });
});

// 统计汇总
app.get('/api/stats', (req, res) => {
  const total = db.prepare('SELECT COUNT(*) as count FROM signups').get().count;
  const byRoute = db.prepare('SELECT route, COUNT(*) as count FROM signups GROUP BY route ORDER BY count DESC').all();
  const byCity = db.prepare('SELECT city, COUNT(*) as count FROM signups GROUP BY city ORDER BY count DESC').all();
  const today = db.prepare("SELECT COUNT(*) as count FROM signups WHERE date(created_at) = date('now', '+8 hours')").get().count;

  res.json({
    success: true,
    data: { total, today, byRoute, byCity }
  });
});

// ─── 管理后台页面 ────────────────────────────────────────────
app.get('/admin', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>研学报名管理后台</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', sans-serif; background: #f2f2f7; color: #1d1d1f; padding: 20px; }
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
    h1 { font-size: 24px; font-weight: 700; }
    .stats { display: flex; gap: 12px; margin-bottom: 20px; }
    .stat-card { background: white; border-radius: 12px; padding: 16px 20px; flex: 1; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
    .stat-card .num { font-size: 28px; font-weight: 700; color: #007aff; }
    .stat-card .label { font-size: 13px; color: #8e8e93; margin-top: 4px; }
    .filters { display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; }
    .filters select, .filters input { padding: 8px 12px; border: 1px solid #d1d1d6; border-radius: 8px; font-size: 14px; background: white; }
    .filters button { padding: 8px 16px; border: none; border-radius: 8px; background: #007aff; color: white; font-size: 14px; cursor: pointer; }
    .table-wrap { background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    th, td { padding: 12px 16px; text-align: left; border-bottom: 0.5px solid #e5e5ea; }
    th { background: #f7f7fa; font-weight: 600; color: #6e6e73; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; position: sticky; top: 0; }
    tr:hover { background: #f7f7fa; }
    .badge { display: inline-block; padding: 3px 8px; border-radius: 6px; font-size: 12px; font-weight: 500; }
    .badge-beijing { background: #e8f2ff; color: #004fad; }
    .badge-huningxi { background: #e9f9ee; color: #1a8a3e; }
    .badge-yuegangao { background: #eee9fe; color: #5e5ce6; }
    .pagination { display: flex; justify-content: center; align-items: center; gap: 12px; padding: 16px; }
    .pagination button { padding: 6px 14px; border: 1px solid #d1d1d6; border-radius: 8px; background: white; cursor: pointer; font-size: 14px; }
    .pagination button:disabled { opacity: 0.4; cursor: default; }
    .pagination span { font-size: 14px; color: #6e6e73; }
    .export-btn { padding: 8px 16px; border: none; border-radius: 8px; background: #34c759; color: white; font-size: 14px; cursor: pointer; }
    .detail-wrap { display: none; background: white; border-radius: 12px; padding: 20px; margin-bottom: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
    .detail-wrap.show { display: block; }
    .detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .detail-item label { font-size: 12px; color: #8e8e93; display: block; margin-bottom: 2px; }
    .detail-item .value { font-size: 16px; color: #1d1d1f; }
    @media (max-width: 640px) { .stats { flex-direction: column; } .detail-grid { grid-template-columns: 1fr; } }
    .tab-bar { display: flex; gap: 0; margin-bottom: 16px; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
    .tab { flex: 1; padding: 12px; text-align: center; cursor: pointer; font-size: 14px; border: none; background: transparent; transition: all 0.2s; }
    .tab.active { background: #007aff; color: white; font-weight: 600; }
    .tab:not(.active):hover { background: #f7f7fa; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>📋 研学报名管理</h1>
      <div style="font-size:13px; color:#8e8e93; margin-top:4px;" id="dbTime"></div>
    </div>
    <div style="display:flex; gap:8px;">
      <button class="export-btn" onclick="exportCSV()">导出 Excel</button>
    </div>
  </div>

  <div class="stats">
    <div class="stat-card"><div class="num" id="statTotal">-</div><div class="label">总报名数</div></div>
    <div class="stat-card"><div class="num" id="statToday">-</div><div class="label">今日新增</div></div>
  </div>

  <div class="tab-bar">
    <button class="tab active" onclick="switchTab('list')">报名列表</button>
    <button class="tab" onclick="switchTab('chart')">线路统计</button>
    <button class="tab" onclick="switchTab('city')">城市统计</button>
  </div>

  <div class="filters">
    <select id="filterRoute"><option value="">全部线路</option><option value="北京6天">北京6天</option><option value="沪宁锡7天">沪宁锡7天</option><option value="粤港澳6天">粤港澳6天</option></select>
    <select id="filterCity"><option value="">全部城市</option><option value="贵阳市">贵阳市</option><option value="遵义市">遵义市</option><option value="六盘水市">六盘水市</option><option value="安顺市">安顺市</option><option value="毕节市">毕节市</option><option value="铜仁市">铜仁市</option><option value="黔东南州">黔东南州</option><option value="黔南州">黔南州</option><option value="黔西南州">黔西南州</option></select>
    <input id="filterKeyword" placeholder="搜索姓名/电话" style="width:160px;">
    <button onclick="loadData(1)">查询</button>
  </div>

  <div id="chartView" style="display:none; background:white; border-radius:12px; padding:20px; box-shadow:0 1px 3px rgba(0,0,0,0.08); margin-bottom:16px;">
    <canvas id="routeChart" height="200"></canvas>
  </div>
  <div id="cityView" style="display:none; background:white; border-radius:12px; padding:20px; box-shadow:0 1px 3px rgba(0,0,0,0.08); margin-bottom:16px;">
    <canvas id="cityChart" height="200"></canvas>
  </div>

  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th style="width:40px">#</th>
          <th>孩子</th>
          <th>线路</th>
          <th>家长</th>
          <th>电话</th>
          <th>门店</th>
          <th style="width:140px">提交时间</th>
          <th style="width:60px">操作</th>
        </tr>
      </thead>
      <tbody id="tableBody"></tbody>
    </table>
    <div class="pagination">
      <button id="prevBtn" onclick="changePage(-1)" disabled>上一页</button>
      <span id="pageInfo">第 1 页</span>
      <button id="nextBtn" onclick="changePage(1)" disabled>下一页</button>
    </div>
  </div>

  <div class="detail-wrap" id="detailPanel">
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
      <h2 style="font-size:18px;">报名详情</h2>
      <button onclick="closeDetail()" style="background:none; border:none; font-size:20px; cursor:pointer;">×</button>
    </div>
    <div class="detail-grid" id="detailContent"></div>
  </div>

  <script>
    let currentPage = 1;
    let totalPages = 1;

    function loadData(page) {
      currentPage = page;
      const route = document.getElementById('filterRoute').value;
      const city = document.getElementById('filterCity').value;
      const keyword = document.getElementById('filterKeyword').value.trim();
      const params = new URLSearchParams({ page, limit: 50 });
      if (route) params.set('route', route);
      if (city) params.set('city', city);
      if (keyword) params.set('keyword', keyword);

      fetch('/api/submissions?' + params.toString())
        .then(r => r.json())
        .then(res => {
          if (!res.success) return;
          totalPages = res.totalPages;
          renderTable(res.data);
          document.getElementById('pageInfo').textContent = '第 ' + page + '/' + totalPages + ' 页';
          document.getElementById('prevBtn').disabled = page <= 1;
          document.getElementById('nextBtn').disabled = page >= totalPages;
        });
    }

    function renderTable(rows) {
      const tbody = document.getElementById('tableBody');
      if (!rows.length) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:32px; color:#8e8e93;">暂无报名数据</td></tr>';
        return;
      }
      const badgeMap = {
        '北京6天': 'badge-beijing',
        '沪宁锡7天': 'badge-huningxi',
        '粤港澳6天': 'badge-yuegangao'
      };
      tbody.innerHTML = rows.map(r => '<tr>' +
        '<td>' + r.id + '</td>' +
        '<td><strong>' + esc(r.child_name) + '</strong>' + (r.child_age ? '<br><span style="font-size:12px;color:#8e8e93;">' + esc(r.child_age) + '岁</span>' : '') + '</td>' +
        '<td><span class="badge ' + (badgeMap[r.route] || '') + '">' + esc(r.route) + '</span></td>' +
        '<td>' + esc(r.parent_name) + '</td>' +
        '<td>' + esc(r.phone) + '</td>' +
        '<td>' + esc(r.city) + '<br><span style="font-size:12px;color:#8e8e93;">' + esc(r.store) + '</span></td>' +
        '<td style="font-size:13px;color:#6e6e73;">' + r.created_at + '</td>' +
        '<td><button onclick="showDetail(' + r.id + ')" style="padding:4px 10px;border:1px solid #d1d1d6;border-radius:6px;background:white;cursor:pointer;font-size:12px;">详情</button></td>' +
        '</tr>').join('');
    }

    function showDetail(id) {
      fetch('/api/submissions?limit=1&keyword=' + id)
        .then(r => r.json())
        .then(res => {
          if (!res.data || !res.data.length) return;
          const d = res.data[0];
          document.getElementById('detailContent').innerHTML =
            '<div class="detail-item"><label>孩子姓名</label><div class="value">' + esc(d.child_name) + '</div></div>' +
            '<div class="detail-item"><label>年龄</label><div class="value">' + (d.child_age || '-') + '</div></div>' +
            '<div class="detail-item"><label>意向线路</label><div class="value">' + esc(d.route) + '</div></div>' +
            '<div class="detail-item"><label>家长姓名</label><div class="value">' + esc(d.parent_name) + '</div></div>' +
            '<div class="detail-item"><label>联系电话</label><div class="value">' + esc(d.phone) + '</div></div>' +
            '<div class="detail-item"><label>所在城市</label><div class="value">' + esc(d.city) + '</div></div>' +
            '<div class="detail-item"><label>报名门店</label><div class="value">' + esc(d.store) + '</div></div>' +
            '<div class="detail-item"><label>备注</label><div class="value">' + (d.remark || '-') + '</div></div>' +
            '<div class="detail-item"><label>提交时间</label><div class="value">' + d.created_at + '</div></div>';
          document.getElementById('detailPanel').classList.add('show');
        });
    }

    function closeDetail() { document.getElementById('detailPanel').classList.remove('show'); }

    function changePage(delta) {
      const newPage = currentPage + delta;
      if (newPage >= 1 && newPage <= totalPages) loadData(newPage);
    }

    function exportCSV() {
      fetch('/api/submissions?limit=99999')
        .then(r => r.json())
        .then(res => {
          if (!res.data) return;
          const rows = res.data;
          const headers = ['ID','孩子姓名','年龄','意向线路','家长姓名','联系电话','所在城市','报名门店','备注','提交时间'];
          const csv = [headers.join(',')];
          rows.forEach(r => {
            csv.push([
              r.id, csvEsc(r.child_name), csvEsc(r.child_age), csvEsc(r.route),
              csvEsc(r.parent_name), csvEsc(r.phone), csvEsc(r.city),
              csvEsc(r.store), csvEsc(r.remark), r.created_at
            ].join(','));
          });
          const blob = new Blob(['\\uFEFF' + csv.join('\\n')], { type: 'text/csv;charset=utf-8;' });
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = '研学报名_' + new Date().toISOString().slice(0,10) + '.csv';
          a.click();
        });
    }

    function loadStats() {
      fetch('/api/stats').then(r => r.json()).then(res => {
        if (!res.success) return;
        document.getElementById('statTotal').textContent = res.data.total;
        document.getElementById('statToday').textContent = res.data.today;
      });
    }

    let routeChart, cityChart;
    function switchTab(tab) {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelector('.tab[onclick*="' + tab + '"]').classList.add('active');
      document.getElementById('chartView').style.display = tab === 'chart' ? 'block' : 'none';
      document.getElementById('cityView').style.display = tab === 'city' ? 'block' : 'none';

      fetch('/api/stats').then(r => r.json()).then(res => {
        if (!res.success) return;
        if (tab === 'chart') renderChart(res.data.byRoute);
        if (tab === 'city') renderCityChart(res.data.byCity);
      });
    }

    function renderChart(data) {
      const total = data.reduce((s, d) => s + d.count, 0) || 1;
      const colors = { '北京6天':'#007aff', '沪宁锡7天':'#34c759', '粤港澳6天':'#5e5ce6' };
      document.getElementById('chartView').innerHTML = '<div style="display:flex;flex-direction:column;gap:12px;">' +
        data.map(d => '<div><div style="display:flex;justify-content:space-between;font-size:14px;margin-bottom:4px;"><span>' + esc(d.route) + '</span><span>' + d.count + '人 (' + (d.count/total*100).toFixed(1) + '%)</span></div><div style="height:24px;background:#f2f2f7;border-radius:8px;overflow:hidden;"><div style="height:100%;width:' + (d.count/total*100) + '%;background:' + (colors[d.route] || '#007aff') + ';border-radius:8px;"></div></div></div>').join('') +
        '</div>';
    }

    function renderCityChart(data) {
      const total = data.reduce((s, d) => s + d.count, 0) || 1;
      document.getElementById('cityView').innerHTML = '<div style="display:flex;flex-direction:column;gap:12px;">' +
        data.map(d => '<div><div style="display:flex;justify-content:space-between;font-size:14px;margin-bottom:4px;"><span>' + esc(d.city) + '</span><span>' + d.count + '人 (' + (d.count/total*100).toFixed(1) + '%)</span></div><div style="height:24px;background:#f2f2f7;border-radius:8px;overflow:hidden;"><div style="height:100%;width:' + (d.count/total*100) + '%;background:#007aff;border-radius:8px;"></div></div></div>').join('') +
        '</div>';
    }

    function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
    function csvEsc(s) { const v = String(s); return v.includes(',') || v.includes('"') ? '"' + v.replace(/"/g,'""') + '"' : v; }

    document.getElementById('filterKeyword').addEventListener('keydown', function(e) { if (e.key === 'Enter') loadData(1); });

    loadData(1);
    loadStats();
  </script>
</body>
</html>
  `);
});

// ─── 静态文件（CORS 跨域支持前端直接调用）─────────────
app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// ─── 首页重定向 ──────────────────────────────────────────────
app.get('/', (req, res) => {
  res.redirect('/pages/app.html');
});

// ─── 启动 ────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ 研学报名后端已启动: http://localhost:${PORT}`);
  console.log(`📋 管理后台: http://localhost:${PORT}/admin`);
  console.log(`📮 提交接口: POST http://localhost:${PORT}/api/signup`);
});
