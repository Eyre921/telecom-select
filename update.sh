#!/bin/bash

# 电信选号系统部署脚本
# 作者: 自动生成
# 日期: $(date)

echo "开始刷新电信选号系统..."

# 停止应用
echo "停止应用..."
pm2 stop telecom-app

# 生成 Prisma 客户端
echo "生成 Prisma 客户端..."
npx prisma generate

# 运行数据库迁移
echo "运行数据库迁移..."
npx prisma migrate deploy

# 重启应用
echo "重启应用..."
pm2 restart telecom-app

echo "部署完成！"