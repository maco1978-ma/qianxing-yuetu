# 黔行阅途研学 - 部署说明

## 在线体验
**https://517bf2dc22dd3b.lhr.life**
> 此地址通过临时隧道公开，正式部署后失效。

---

## 🚀 Zeabur 部署（推荐，免费）

**你需要：一个 GitHub 账号（免费注册），以及 5 分钟**

### 第 1 步：创建 GitHub 仓库

1. 打开 https://github.com 注册账号（已有就跳过）
2. 点右上角 "+" → **New repository**
3. 仓库名填 `qianxing-yuetu`，选 **Public**，其他默认
4. 创建后你会看到一个空仓库的页面

### 第 2 步：上传代码

```bash
# 在项目目录执行：
cd /Users/maco/Downloads/新华书店/08-黔行阅途研学/qianxing-yuetu-draft

# 链接到你的 GitHub 仓库
git remote add origin https://github.com/你的用户名/qianxing-yuetu.git

# 推送代码
git push -u origin main
```

> 推送时会提示输入 GitHub 用户名和密码（密码用 **token**，见下文）

#### 生成 GitHub Token（用于推送）
1. GitHub → 右上角头像 → Settings
2. 左下角 → Developer settings → Personal access tokens → Tokens (classic)
3. Generate new token → 勾选 `repo` 权限 → 生成
4. 复制 token，push 时密码贴这个

### 第 3 步：部署到 Zeabur

1. 打开 https://zeabur.com
2. 点 **Sign in** → 用 GitHub 登录
3. 点 **Create Project** → Import from GitHub
4. 授权 Zeabur 访问你的仓库 → 选 `qianxing-yuetu`
5. Zeabur 自动检测 Node.js → 自动部署
6. 部署完成会生成一个 `xxx.zeabur.app` 域名

**大功告成！** 二维码指向这个域名就行。

### 数据持久化（重要）

SQLite 数据库在 Zeabur 重启后会丢失。需要加一步配置：

在 Zeabur 项目设置里添加 **Persistent Volume**，挂载路径填 `server`，这样数据库文件会被持久化保存。

---

## 数据查看

- **在线查看**：`https://你的域名/admin`
- **导出CSV**：管理后台有"导出 Excel"按钮
- **原始数据**：`server/signups.db`（SQLite文件）
