
# 校园卡在线选号系统 - 说明文档

> **项目仓库**: [https://github.com/Eyre921/telecom-select](https://github.com/Eyre921/telecom-select)

## 📋 目录

- [系统要求](#系统要求)
- [开发环境部署](#开发环境部署)
- [生产环境构建](#生产环境构建)
- [本地部署测试](#本地部署测试)
- [生产环境部署](#生产环境部署)
- [PM2 进程管理](#pm2-进程管理)
- [环境变量配置](#环境变量配置)
- [数据库管理](#数据库管理)
- [故障排除](#故障排除)

## 🔧 系统要求

### 基础要求
- **Node.js**: >= 18.17.0
- **npm**: >= 9.0.0 或 **pnpm**: >= 8.0.0
- **操作系统**: Windows 10/11, Linux, macOS

### 生产环境额外要求
- **内存**: 最低 1GB，推荐 2GB+
- **存储**: 最低 500MB 可用空间
- **PM2**: 用于进程管理

## 🚀 开发环境部署

### 1. 克隆项目

```bash
git clone https://github.com/Eyre921/telecom-select.git
cd telecom-select
```

### 2. 安装依赖

```bash
# 使用 npm
npm install

# 或使用 pnpm（推荐）
pnpm install
```

### 3. 环境变量配置

在项目根目录创建 `.env` 文件：

```env
# 数据库配置
DATABASE_URL="file:./prisma/dev.db"

# NextAuth 配置
NEXTAUTH_SECRET="your-super-secret-key-here"
NEXTAUTH_URL="http://localhost:3000"

# 环境配置
NODE_ENV="development"
PORT=3000
```

> **⚠️ 重要**: 请将 `NEXTAUTH_SECRET` 替换为一个强密码，可以使用 `openssl rand -base64 32` 生成。

### 4. 数据库初始化

```bash
# 生成 Prisma Client
npx prisma generate

# 运行数据库迁移
npx prisma migrate dev

# （可选）查看数据库
npx prisma studio
```

### 5. 启动开发服务器

```bash
npm run dev
# 或
pnpm dev
```

访问 [http://localhost:3000](http://localhost:3000) 查看应用。

## 🏗️ 生产环境构建

### 1. 构建应用

```bash
# 构建 Next.js 应用
npm run build
# 或
pnpm build
```

> **📝 说明**: 构建完成后会在 `.next` 目录下生成 `standalone` 文件夹，这是生产环境所需的完整应用。

### 2. 验证构建

```bash
# 本地测试构建结果
npm start
# 或
pnpm start
```

## 🧪 本地部署测试

### 1. 准备部署目录

```bash
# Windows
if exist deploy rmdir /s /q deploy
mkdir deploy
cd deploy

# Linux/macOS
rm -rf deploy
mkdir deploy
cd deploy
```

### 2. 复制必要文件

```bash
# Windows (推荐使用 cp 命令)
cp -r ../.next/standalone/* .
cp -r ../.next/static ./.next/static
cp -r ../public ./public
cp -r ../prisma ./prisma
cp ../prisma/dev.db ./prisma/dev.db 2>nul || echo "数据库文件不存在，将在迁移时创建"

# 如果 cp 命令不可用，可以使用 robocopy（Windows 内置）
# robocopy "../.next/standalone" "." /E
# robocopy "../.next/static" ".next/static" /E
# robocopy "../public" "public" /E
# robocopy "../prisma" "prisma" /E
# copy "../prisma/dev.db" "prisma/dev.db" 2>nul

# Linux/macOS
cp -r ../.next/standalone/* .
cp -r ../.next/static ./.next/static
cp -r ../public ./public
cp -r ../prisma ./prisma
cp ../prisma/dev.db ./prisma/dev.db 2>/dev/null || true
```

> **💡 重要提示**: `deploy` 目录包含了生产环境运行所需的所有文件，但**不包含** `node_modules`。这是因为 Next.js 的 `standalone` 模式已经将必要的依赖打包到了输出文件中。

### 3. 配置环境变量

在 `deploy` 目录创建 `.env` 文件：

```bash
# Windows
echo DATABASE_URL="file:./prisma/dev.db" > .env
echo NEXTAUTH_SECRET="your-secret-key" >> .env
echo NEXTAUTH_URL="http://localhost:3000" >> .env
echo NODE_ENV="production" >> .env
echo PORT=3000 >> .env

# Linux/macOS
cat > .env << EOF
DATABASE_URL="file:./prisma/dev.db"
NEXTAUTH_SECRET="your-secret-key"
NEXTAUTH_URL="http://localhost:3000"
NODE_ENV="production"
PORT=3000
EOF
```

### 4. 安装生产依赖

```bash
npm install --omit=dev
```

> **📝 说明**: 虽然 `standalone` 模式已经包含了运行时依赖，但仍需要安装 Prisma 等工具依赖用于数据库操作。

### 5. 初始化数据库

```bash
# 生成 Prisma Client
npx prisma generate

# 运行数据库迁移
npx prisma migrate deploy
```

### 6. 启动应用测试

```bash
node server.js
```

访问 [http://localhost:3000](http://localhost:3000) 验证部署是否成功。

## 🌐 生产环境部署

### 部署文件上传策略

#### 完整部署（首次部署或依赖更新）
将本地 `deploy` 目录的**所有文件**上传到服务器目标目录。

#### 增量部署（仅代码更新）
如果只是代码更新，没有依赖变化，可以选择性上传：

**需要上传的文件/目录：**
- `server.js` - 应用入口文件
- `.next/` - Next.js 构建产物
- `public/` - 静态资源文件
- `prisma/` - 数据库相关文件
- `.env` - 环境变量配置

**可以保留的文件/目录：**
- `node_modules/` - 如果依赖没有变化，可以保留服务器上现有的
- `package.json` 和 `package-lock.json` - 如果依赖没有变化

> **⚠️ 注意**: 如果 `package.json` 中的依赖发生了变化，必须重新上传这些文件并在服务器端重新安装依赖。

### 低配置服务器优化（可选）

如果服务器内存不足（< 2GB），建议先创建交换空间：

```bash
# 检查当前交换空间
swapon --show

# 创建 2GB 交换文件
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# 验证交换空间
free -h
```

### 1. 上传文件到服务器

根据部署策略，将相应文件上传到服务器目标目录（如 `/www/wwwroot/telecom/`）。

### 2. 服务器端配置

```bash
# 进入项目目录
cd /www/wwwroot/telecom/

# 设置内存限制（低配置服务器）
export NODE_OPTIONS="--max-old-space-size=800"

# 安装或更新生产依赖（仅在首次部署或依赖更新时需要）
npm install --omit=dev
# 或者使用内存限制
NODE_OPTIONS="--max-old-space-size=800" npm install --omit=dev --no-audit --no-fund

# 生成 Prisma Client
npx prisma generate

# 运行数据库迁移
npx prisma migrate deploy

# 设置执行权限
chmod +x server.js
```

> **💡 优化提示**: 
> - 对于增量部署，如果 `node_modules` 目录已存在且依赖未变化，可以跳过 `npm install` 步骤
> - 建议在部署脚本中添加依赖检查逻辑，只在必要时重新安装依赖

### 3. 配置生产环境变量

编辑 `.env` 文件，更新为生产环境配置：

```env
DATABASE_URL="file:./prisma/dev.db"
NEXTAUTH_SECRET="your-production-secret-key"
NEXTAUTH_URL="https://yourdomain.com"
NODE_ENV="production"
PORT=3000
```

> **🔒 安全提示**: 生产环境的 `NEXTAUTH_SECRET` 必须是强密码，且与开发环境不同。

### 4. 部署脚本示例（可选）

创建 `deploy.sh` 脚本来自动化部署过程：

```bash
#!/bin/bash

# 部署脚本
APP_DIR="/www/wwwroot/telecom"
APP_NAME="telecom-app"

echo "开始部署..."

# 停止应用
pm2 stop $APP_NAME 2>/dev/null || true

# 进入应用目录
cd $APP_DIR

# 检查是否需要重新安装依赖
if [ ! -d "node_modules" ] || [ "package.json" -nt "node_modules/.package-lock.json" ]; then
    echo "检测到依赖变化，重新安装依赖..."
    NODE_OPTIONS="--max-old-space-size=800" npm install --omit=dev --no-audit --no-fund
else
    echo "依赖未变化，跳过安装步骤"
fi

# 生成 Prisma Client
npx prisma generate

# 运行数据库迁移
npx prisma migrate deploy

# 重启应用
pm2 start server.js --name $APP_NAME 2>/dev/null || pm2 restart $APP_NAME

echo "部署完成！"
```

## 📊 PM2 进程管理

### 1. 安装 PM2

```bash
# 全局安装 PM2
npm install -g pm2
```

### 2. 启动应用

```bash
# 启动应用
pm2 start server.js --name "telecom-app"

# 查看应用状态
pm2 status

# 查看应用日志
pm2 logs telecom-app
```

### 3. PM2 常用命令

```bash
# 重启应用
pm2 restart telecom-app

# 停止应用
pm2 stop telecom-app

# 删除应用
pm2 delete telecom-app

# 查看详细信息
pm2 show telecom-app

# 监控应用
pm2 monit

# 保存 PM2 配置
pm2 save

# 设置开机自启
pm2 startup
```

### 4. PM2 配置文件（可选）

创建 `ecosystem.config.js` 文件：

```javascript
module.exports = {
  apps: [{
    name: 'telecom-app',
    script: 'server.js',
    cwd: '/www/wwwroot/telecom/',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    max_memory_restart: '500M'
  }]
};
```

使用配置文件启动：

```bash
pm2 start ecosystem.config.js
```

## ⚙️ 环境变量配置

### 必需的环境变量

| 变量名 | 说明 | 示例值 |
|--------|------|--------|
| `DATABASE_URL` | 数据库连接字符串 | `file:./prisma/dev.db` |
| `NEXTAUTH_SECRET` | NextAuth 密钥 | `your-secret-key` |
| `NEXTAUTH_URL` | 应用访问地址 | `https://yourdomain.com` |
| `NODE_ENV` | 运行环境 | `production` |
| `PORT` | 应用端口 | `3000` |

### 环境变量设置方法

#### 方法1: 使用 .env 文件（推荐）
在项目根目录创建 `.env` 文件，PM2 会自动加载。

#### 方法2: PM2 环境变量
```bash
pm2 set pm2:env.DATABASE_URL "file:./prisma/dev.db"
pm2 set pm2:env.NEXTAUTH_SECRET "your-secret-key"
pm2 set pm2:env.NEXTAUTH_URL "https://yourdomain.com"
pm2 set pm2:env.NODE_ENV "production"
pm2 set pm2:env.PORT "3000"
```

## 🗄️ 数据库管理

### 数据库迁移

```bash
# 创建新迁移
npx prisma migrate dev --name migration_name

# 部署迁移到生产环境
npx prisma migrate deploy

# 重置数据库（谨慎使用）
npx prisma migrate reset
```

### 数据库备份

```bash
# 备份 SQLite 数据库
cp prisma/dev.db prisma/dev.db.backup.$(date +%Y%m%d_%H%M%S)

# 恢复数据库
cp prisma/dev.db.backup.20240101_120000 prisma/dev.db
```

### 数据库管理工具

```bash
# 启动 Prisma Studio
npx prisma studio
```

访问 [http://localhost:5555](http://localhost:5555) 管理数据库。

## 🔧 故障排除

### 常见问题

#### 1. 数据库连接错误
```
Error code 14: Unable to open the database file
```

**解决方案**:
- 检查 `DATABASE_URL` 环境变量是否正确
- 确保数据库文件路径存在且有读写权限
- 运行 `npx prisma generate` 重新生成客户端

#### 2. NextAuth 配置错误
```
[next-auth][error][CLIENT_FETCH_ERROR]
```

**解决方案**:
- 检查 `NEXTAUTH_URL` 是否与实际访问地址一致
- 确保 `NEXTAUTH_SECRET` 已设置且不为空

#### 3. 端口占用
```
Error: listen EADDRINUSE: address already in use :::3000
```

**解决方案**:
```bash
# 查找占用端口的进程
netstat -ano | findstr :3000  # Windows
lsof -i :3000                 # Linux/macOS

# 杀死进程或更改端口
set PORT=3001  # Windows
export PORT=3001  # Linux/macOS
```

#### 4. 内存不足
```
JavaScript heap out of memory
```

**解决方案**:
```bash
# 设置内存限制
set NODE_OPTIONS=--max-old-space-size=800  # Windows
export NODE_OPTIONS="--max-old-space-size=800"  # Linux/macOS
```

### 日志查看

```bash
# PM2 日志
pm2 logs telecom-app
pm2 logs telecom-app --lines 50

# 实时日志
pm2 logs telecom-app -f

# 错误日志
pm2 logs telecom-app --err
```

### 性能监控

```bash
# PM2 监控
pm2 monit

# 系统资源监控
top        # Linux/macOS
tasklist   # Windows
```

## 📚 相关链接

- [项目仓库](https://github.com/Eyre921/telecom-select)
- [Next.js 文档](https://nextjs.org/docs)
- [Prisma 文档](https://www.prisma.io/docs)
- [PM2 文档](https://pm2.keymetrics.io/docs)
- [NextAuth.js 文档](https://next-auth.js.org)

---

**📝 最后更新**: 2025年8月
**🔧 维护者**: Eyre921

---

### **关于Nginx反向代理页面内容未更新问题的排查与解决报告**

**报告日期:** 2025年8月25日 **问题状态:** 已解决

---

#### **1. 问题描述**

- **涉及服务:** 域名 `https://blog.nfeyre.top/` 的Nginx反向代理服务。
    
- **故障现象:** 访问通过Nginx反向代理的域名 `https://blog.nfeyre.top/` 时，显示的网页内容为旧版本。而直接通过源服务器地址 `http://115.120.219.70:3000/` 访问时，显示的是经过修改的最新内容。
    
- **业务影响:** 网站更新无法实时展示给用户，导致信息滞后。
    

#### **2. 故障排查过程**

1. **初步诊断:** 根据“代理访问是旧页面，源站访问是新页面”的典型现象，初步判定问题根源为Nginx服务端的缓存机制导致。
    
2. **尝试方案一 (失败):**
    
    - **操作:** 尝试在宝塔面板的【反向代理】->【配置文件】->【自定义配置文件】中，通过添加一个新的 `location / { ... }` 配置块来覆盖原有配置，并加入禁用缓存的HTTP头指令。
        
    - **结果:** 保存配置文件时，Nginx服务返回严重错误（`[emerg]`）：`duplicate location "/"`。
        
    - **分析:** 此错误表明Nginx配置文件中出现了两个 `location /` 定义，这是不允许的。根本原因在于，宝塔面板的自定义配置功能是将代码“添加”到`server`块中，而非“覆盖”已有的`location`块，从而导致了语法冲突。
        
3. **根本原因分析:**
    
    - 通过检查主配置文件，发现存在 `proxy_cache_path` 指令，明确了该反向代理服务**开启了代理缓存功能**，这是导致页面不更新的直接原因。
        
    - 首次修复尝试失败的原因在于对面板配置文件加载机制的理解有误，试图重复定义 `location` 块。
        

#### **3. 最终解决方案**

- **操作:** 清空【自定义配置文件】中的错误代码，不再定义`location`块，而是直接在`server`配置域（`server` block）下添加控制缓存行为的指令。具体添加的代码如下：
    
    Nginx
    
    ```
    # 添加以下代码来禁用并绕过缓存
    proxy_cache_bypass 1;
    proxy_no_cache 1;
    
    # 添加响应头，强制浏览器不缓存
    add_header Cache-Control 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0';
    expires off;
    ```
    
- **原理:** `proxy_cache_bypass` 和 `proxy_no_cache` 指令可以直接用于`server`上下文，它们的作用会被其下的`location`块继承。`1`代表条件始终为真，即强制Nginx对每一次请求都：
    
    1. `proxy_cache_bypass 1;`: 绕过缓存，直接请求源站。
        
    2. `proxy_no_cache 1;`: 不将新获取的内容存入缓存。 同时，通过 `add_header` 指令强制客户端浏览器也不进行缓存，实现了端到端的缓存禁用。
        
- **结果:** 配置保存成功，Nginx服务正常重载。刷新后，网站内容立即更新为最新版本。问题得到圆满解决。
    

#### **4. 总结与建议**

- 在使用类似宝塔面板的管理工具时，其“自定义配置”功能通常是在现有配置基础上做**追加**而非**覆盖**，在添加配置时需特别注意上下文，避免产生语法冲突。
    
- 对于面板已开启的模块化功能（如代理缓存），应优先查找图形化界面（GUI）中的开关进行关闭，这通常是更安全、更推荐的操作方式。
    
- 当必须手动修改配置以禁用某项功能时，应准确理解相关指令的作用域（可在`http`, `server`, `location`中的哪个层级使用），以实现“精确打击”。