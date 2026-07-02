# 黔行阅途研学 - 部署说明

## 上线地址（测试隧道）
**https://517bf2dc22dd3b.lhr.life**

> 此地址通过 SSH 隧道临时公开，仅供演示测试。
> **正式部署请参考下方"正式部署"部分。**

---

## 功能验证

| 功能 | 说明 |
|------|------|
| 🔗 首页 | `https://517bf2dc22dd3b.lhr.life` → 自动跳转首页 |
| 🗺️ 3条线路详情 | 北京、沪宁锡、粤港澳，含行程/费用/行前准备 |
| 📝 在线报名 | 选择门店 → 填写信息 → 提交 |
| 📊 管理后台 | `https://517bf2dc22dd3b.lhr.life/admin` |
| 📈 数据统计 | 按线路/城市汇总，支持导出CSV |

---

## 正式部署（到服务器）

### 方式一：直接用 Node.js 运行（推荐）

```bash
# 1. 把整个项目上传到服务器
# 2. 安装依赖
cd server
npm install

# 3. 启动（长期运行用 pm2）
npm start

# 或用 pm2 守护进程
npm install -g pm2
pm2 start index.js --name "qianxing-yuetu"

# 4. Nginx 反向代理（可选）
# server {
#     listen 80;
#     server_name your-domain.com;
#     location / {
#         proxy_pass http://127.0.0.1:3000;
#         proxy_set_header Host $host;
#     }
# }
```

### 方式二：Docker（如有）

```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY server/ ./server/
RUN cd server && npm install
EXPOSE 3000
CMD ["node", "server/index.js"]
```

---

## 二维码

宣传海报上的二维码指向：`https://517bf2dc22dd3b.lhr.life`

正式部署后用正式域名替换即可。

## 数据查看

- **在线查看**：`http://你的域名/admin`
- **导出CSV**：管理后台有"导出 Excel"按钮
- **原始数据**：`server/signups.db`（SQLite文件，可用SQLite工具打开）
