# 黔行阅途研学 - 腾讯云 COS + SCF 部署指南

## 架构

```
用户扫码 → COS静态网站（前端页面 + 图片）
                    ↓
              用户提交报名
                    ↓
           API网关 → SCF云函数（处理数据）
                    ↓
             /tmp 存储报名记录
                    ↓
           管理后台 /admin 查看数据
```

---

## 第一步：开通服务

登录 [腾讯云控制台](https://console.cloud.tencent.com)：

1. **COS 对象存储** → 开通（免费）
2. **SCF 云函数** → 开通（免费）

---

## 第二步：配置 COS 静态网站

### 2.1 创建存储桶

1. 打开 [COS 控制台](https://console.cloud.tencent.com/cos5)
2. 点 **创建存储桶**
   - 名称：`qianxing-yuetu`（或你喜欢的名字）
   - 地域：选 **广州**（离贵州近）
   - 访问权限：**公有读私有写**
3. 创建完成

### 2.2 上传文件

```bash
# 安装 COS 命令行工具
pip install coscmd

# 配置（用你的腾讯云API密钥）
coscmd config -a <SECRET_ID> -s <SECRET_KEY> -b qianxing-yuetu -r ap-guangzhou

# 上传前端页面
coscmd upload ./pages/ /pages/
coscmd upload ./assets/ /assets/

# 设置静态网站
```

### 2.3 开启静态网站

1. 在存储桶详情页 → **基础配置** → **静态网站**
2. 开启静态网站
3. 索引文档：`pages/app.html`
4. 保存后拿到 **访问域名**，如：`https://qianxing-yuetu-xxxxxxxx.cos.ap-guangzhou.myqcloud.com`

---

## 第三步：创建 SCF 云函数

### 3.1 获取 API 密钥

1. 打开 [API 密钥管理](https://console.cloud.tencent.com/cam/capi)
2. 点 **新建密钥**，拿到 `SecretId` 和 `SecretKey`

### 3.2 创建函数

1. 打开 [SCF 控制台](https://console.cloud.tencent.com/scf)
2. 点 **新建**
   - 函数名称：`qianxing-yuetu-api`
   - 运行环境：Node.js 18+
   - 创建方式：**从头开始**（空白函数）
3. 点 **下一步**

### 3.3 上传代码

1. 在本地打包函数代码：

```bash
cd tencent-cloud/scf
zip -r ../scf-code.zip index.js package.json
```

2. 在 SCF 控制台上传这个 zip 包
3. 入口文件：`index.main_handler`

### 3.4 配置触发器

1. 点 **触发器管理** → **创建触发器**
2. 触发器类型：**API 网关触发器**
3. 勾选 **启用集成响应**
4. 创建完成，拿到访问地址，如：
   `https://service-xxxxx-xx.ap-guangzhou.apigw.tencentcs.com/release/`

### 3.5 配置环境变量（可选）

在函数配置中设置环境变量（持久化数据需要）：

| 变量 | 说明 |
|------|------|
| BUCKET | COS存储桶名称 |
| REGION | COS地域 |
| SECRET_ID | API密钥ID |
| SECRET_KEY | API密钥Key |

### 3.6 增加 COS 权限（可选，用于数据持久化）

在函数配置 → 函数配置 → 高级配置 → 角色中，给函数添加 COS 全读写权限。

---

## 第四步：修改前端配置

### 4.1 修改 API 地址

打开 `pages/app.html` 和 `pages/signup.html`，找到：

```javascript
var API_BASE = '';  // 改这里
```

改成你的 API 网关地址：

```javascript
var API_BASE = 'https://service-xxxxx-xx.ap-guangzhou.apigw.tencentcs.com/release';
```

### 4.2 重新上传到 COS

```bash
coscmd upload ./pages/ /pages/
```

---

## 第五步：上线

1. **二维码**：扫 `https://qianxing-yuetu-xxxxxxxx.cos.ap-guangzhou.myqcloud.com/pages/app.html`
2. **管理后台**：`https://service-xxxxx-xx.ap-guangzhou.apigw.tencentcs.com/release/admin`
3. **数据导出**：管理后台有"导出CSV"按钮

---

## 费用预估

| 服务 | 免费额度 | 预估月费 |
|------|---------|:-------:|
| COS 存储 | 50GB | 免费 |
| COS 流量 | 10GB/月 | 免费 |
| SCF 调用 | 100万次/月 | 免费 |
| SCF 资源 | 40万GBs/月 | 免费 |
| **总计** | | **¥0** |

---

## 数据说明

SCF 函数的 `/tmp` 目录在函数冷启动时会重置。如需数据持久化，请配置 COS 环境变量（见3.5），函数会自动备份数据到 COS。
