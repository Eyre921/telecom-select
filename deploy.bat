# 删除现有的 depoly 文件夹
rm -rf depoly

# 创建新的部署文件夹
mkdir deploy
cd deploy

# 复制 standalone 构建输出
cp -r ../.next/standalone/* .

# 复制静态文件
cp -r ../.next/static ./.next/static
cp -r ../public ./public

# 复制 Prisma 相关文件
cp -r ../prisma ./prisma

# 复制数据库文件（如果存在）
cp ../prisma/dev.db ./prisma/dev.db

# 在 deploy 文件夹中创建 .env.local
echo 'DATABASE_URL="file:./prisma/dev.db"' > .env.local
echo 'NEXTAUTH_SECRET="your-secret-key"' >> .env.local
echo 'NEXTAUTH_URL="https://xh.nfeyre.top"' >> .env.local
echo 'NODE_ENV="production"' >> .env.local
echo 'PORT=3000' >> .env.local


# 安装生产依赖（如果需要）
npm install --omit=dev

# 生成 Prisma Client
npx prisma generate

# 运行数据库迁移
npx prisma migrate deploy

# 启动应用
node server.js

---
# 检查当前交换空间
swapon --show

# 创建 2GB 交换文件
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile



# 验证交换空间
free -h



cd /www/wwwroot/telecom/
# 临时设置内存限制
NODE_OPTIONS="--max-old-space-size=800" npm install --omit=dev
# 或者永久设置
npm config set node-options "--max-old-space-size=800"
npm install --omit=dev

sudo swapoff /swapfile

# 生成 Prisma Client
NODE_OPTIONS="--max-old-space-size=800" npx prisma generate
NODE_OPTIONS="--max-old-space-size=800" npx prisma migrate deploy

# 设置执行权限
chmod +x server.js

# 启动应用
node server.js

# 启动应用
pm2 start server.js --name "telecom-app"

---

# 服务器上的 .env.local
DATABASE_URL="file:./prisma/dev.db"
NEXTAUTH_URL="http://your-domain.com"
NEXTAUTH_SECRET="your-secret-key"

NODE_OPTIONS="--max-old-space-size=760" npm install --omit=dev --no-audit --no-fund