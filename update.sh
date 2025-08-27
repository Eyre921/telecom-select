#!/bin/bash

# 电信选号系统部署脚本
# 作者: 自动生成
# 日期: $(date)

# 检查参数
if [ $# -eq 0 ]; then
    echo "错误: 请提供更新包文件名"
    echo "用法: $0 <更新包文件名.zip>"
    exit 1
fi

UPDATE_PACKAGE="$1"
TEMP_DIR="temp_update_$(date +%s)"
BACKUP_DIR="backup_$(date +%Y%m%d_%H%M%S)"

# 检查更新包是否存在
if [ ! -f "$UPDATE_PACKAGE" ]; then
    echo "错误: 更新包文件 '$UPDATE_PACKAGE' 不存在"
    exit 1
fi

# 检查unzip命令是否可用
if ! command -v unzip &> /dev/null; then
    echo "错误: unzip 命令未找到，请安装 unzip"
    exit 1
fi

echo "开始刷新电信选号系统..."
echo "使用更新包: $UPDATE_PACKAGE"

# 停止应用
echo "停止应用..."
pm2 stop telecom-app
if [ $? -ne 0 ]; then
    echo "警告: 停止应用失败，继续执行..."
fi

# 创建临时目录
echo "创建临时目录..."
mkdir -p "$TEMP_DIR"
if [ $? -ne 0 ]; then
    echo "错误: 无法创建临时目录"
    exit 1
fi

# 解压到临时目录
echo "解压更新包到临时目录..."
unzip -q -o "$UPDATE_PACKAGE" -d "$TEMP_DIR"
if [ $? -ne 0 ]; then
    echo "❌ 解压失败"
    rm -rf "$TEMP_DIR"
    exit 1
fi
echo "✓ 更新包解压完成"

# 验证解压内容
if [ ! -d "$TEMP_DIR/.next" ] && [ ! -d "$TEMP_DIR/public" ]; then
    echo "警告: 解压内容中未找到 .next 或 public 目录"
fi

# 创建备份目录（可选，用于回滚）
echo "创建备份..."
mkdir -p "$BACKUP_DIR"
if [ -d ".next" ]; then
    cp -r .next "$BACKUP_DIR/" 2>/dev/null
fi
if [ -d "public" ]; then
    cp -r public "$BACKUP_DIR/" 2>/dev/null
fi
echo "✓ 备份完成"

# 删除旧的.next和public文件夹
echo "删除旧的.next和public文件夹..."
if [ -d ".next" ]; then
    rm -rf .next
    echo "✓ .next文件夹已删除"
fi

if [ -d "public" ]; then
    rm -rf public
    echo "✓ public文件夹已删除"
fi

# 移动解压的文件到当前目录
echo "应用更新文件..."
if [ -d "$TEMP_DIR/.next" ]; then
    mv "$TEMP_DIR/.next" ./
    echo "✓ .next 文件夹已更新"
fi

if [ -d "$TEMP_DIR/public" ]; then
    mv "$TEMP_DIR/public" ./
    echo "✓ public 文件夹已更新"
fi

# 移动其他文件（如果有的话）
find "$TEMP_DIR" -maxdepth 1 -type f -exec mv {} ./ \;

# 清理临时目录
echo "清理临时文件..."
rm -rf "$TEMP_DIR"

# 设置正确的文件权限
echo "设置文件权限..."
chmod -R 755 .next 2>/dev/null || true
chmod -R 755 public 2>/dev/null || true

# 生成 Prisma 客户端
echo "生成 Prisma 客户端..."
npx prisma generate
if [ $? -ne 0 ]; then
    echo "警告: Prisma 客户端生成失败"
fi

# 运行数据库迁移
echo "运行数据库迁移..."
npx prisma migrate deploy
if [ $? -ne 0 ]; then
    echo "警告: 数据库迁移失败"
fi

# 重启应用
echo "重启应用..."
pm2 restart telecom-app
if [ $? -eq 0 ]; then
    echo "✓ 应用重启成功"
else
    echo "❌ 应用重启失败，请手动检查"
fi

echo ""
echo "🎉 部署完成！"
echo "更新包 '$UPDATE_PACKAGE' 已成功应用"
echo "备份保存在: $BACKUP_DIR"
echo ""
echo "如果出现问题，可以使用以下命令回滚："
echo "  rm -rf .next public"
echo "  mv $BACKUP_DIR/.next $BACKUP_DIR/public ./"
echo "  pm2 restart telecom-app"
