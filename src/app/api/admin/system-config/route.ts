import { NextResponse, NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

// GET /api/admin/system-config - 获取系统配置（所有用户可访问）
export async function GET(request: NextRequest) {
  try {
    // 移除权限检查，允许所有用户获取系统默认收款码
    // const session = await getServerSession(authOptions);
    // if (!session?.user?.id) {
    //   return NextResponse.json({ error: '未登录' }, { status: 401 });
    // }

    // // 检查是否为超级管理员
    // const user = await prisma.user.findUnique({
    //   where: { id: session.user.id },
    //   select: { role: true }
    // });

    // if (user?.role !== 'SUPER_ADMIN') {
    //   return NextResponse.json({ error: '权限不足' }, { status: 403 });
    // }

    // 获取基础收款码配置
    const defaultQrConfig = await prisma.systemConfig.findUnique({
      where: { key: 'default_payment_qr' }
    });

    return NextResponse.json({ 
      defaultPaymentQr: defaultQrConfig?.value || null,
      description: defaultQrConfig?.description || null
    });
  } catch (error) {
    console.error('获取系统配置失败:', error);
    return NextResponse.json({ error: '获取系统配置失败' }, { status: 500 });
  }
}

// POST /api/admin/system-config - 更新系统配置（仅超级管理员）
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    // 检查是否为超级管理员
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    });

    if (user?.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }

    const contentType = request.headers.get('content-type');
    
    // 处理文件上传
    if (contentType?.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File;
      
      if (!file) {
        return NextResponse.json({ error: '未选择文件' }, { status: 400 });
      }

      // 验证文件类型
      if (!file.type.startsWith('image/')) {
        return NextResponse.json({ error: '只支持图片文件' }, { status: 400 });
      }

      // 验证文件大小（5MB）
      if (file.size > 5 * 1024 * 1024) {
        return NextResponse.json({ error: '文件大小不能超过5MB' }, { status: 400 });
      }

      // 创建上传目录
      const uploadDir = join(process.cwd(), 'public', 'uploads', 'system');
      if (!existsSync(uploadDir)) {
        await mkdir(uploadDir, { recursive: true });
      }

      // 生成文件名
      const timestamp = Date.now();
      const extension = file.name.split('.').pop();
      const filename = `default-qr-${timestamp}.${extension}`;
      const filepath = join(uploadDir, filename);

      // 保存文件
      const bytes = await file.arrayBuffer();
      await writeFile(filepath, Buffer.from(bytes));

      // 生成访问URL
      const fileUrl = `/uploads/system/${filename}`;

      // 更新数据库配置
      await prisma.systemConfig.upsert({
        where: { key: 'default_payment_qr' },
        update: { 
          value: fileUrl,
          description: '系统默认收款码（文件上传）'
        },
        create: {
          key: 'default_payment_qr',
          value: fileUrl,
          description: '系统默认收款码（文件上传）'
        }
      });

      return NextResponse.json({ 
        success: true, 
        url: fileUrl,
        message: '基础收款码上传成功' 
      });
    }
    
    // 处理URL保存
    else {
      const { url, description } = await request.json();
      
      if (!url) {
        return NextResponse.json({ error: '请提供收款码URL' }, { status: 400 });
      }

      // 验证URL格式
      try {
        new URL(url);
      } catch {
        return NextResponse.json({ error: '无效的URL格式' }, { status: 400 });
      }

      // 更新数据库配置
      await prisma.systemConfig.upsert({
        where: { key: 'default_payment_qr' },
        update: { 
          value: url,
          description: description || '系统默认收款码（链接）'
        },
        create: {
          key: 'default_payment_qr',
          value: url,
          description: description || '系统默认收款码（链接）'
        }
      });

      return NextResponse.json({ 
        success: true, 
        url,
        message: '基础收款码保存成功' 
      });
    }
  } catch (error) {
    console.error('更新系统配置失败:', error);
    return NextResponse.json({ error: '更新系统配置失败' }, { status: 500 });
  }
}

// DELETE /api/admin/system-config - 删除系统配置（仅超级管理员）
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    // 检查是否为超级管理员
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    });

    if (user?.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }

    // 删除基础收款码配置
    await prisma.systemConfig.deleteMany({
      where: { key: 'default_payment_qr' }
    });

    return NextResponse.json({ 
      success: true,
      message: '基础收款码删除成功' 
    });
  } catch (error) {
    console.error('删除系统配置失败:', error);
    return NextResponse.json({ error: '删除系统配置失败' }, { status: 500 });
  }
}