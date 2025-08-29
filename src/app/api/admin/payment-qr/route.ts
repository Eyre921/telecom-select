import { NextResponse, NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

// GET /api/admin/payment-qr - 获取当前用户的收款码
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, paymentQrCode: true, role: true }
    });

    if (!user) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 });
    }

    // 只返回用户自己的收款码，不回退到系统默认收款码
    return NextResponse.json({ qrCode: user.paymentQrCode });
  } catch (error) {
    console.error('获取收款码失败:', error);
    return NextResponse.json({ error: '获取收款码失败' }, { status: 500 });
  }
}

// POST /api/admin/payment-qr - 上传收款码
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, role: true }
    });

    if (!user) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 });
    }

    const contentType = request.headers.get('content-type');
    
    if (contentType?.includes('multipart/form-data')) {
      // 处理图片上传
      const formData = await request.formData();
      const file = formData.get('file') as File;
      
      if (!file) {
        return NextResponse.json({ error: '请选择文件' }, { status: 400 });
      }

      // 验证文件类型
      if (!file.type.startsWith('image/')) {
        return NextResponse.json({ error: '只支持图片文件' }, { status: 400 });
      }

      // 验证文件大小 (5MB)
      if (file.size > 5 * 1024 * 1024) {
        return NextResponse.json({ error: '文件大小不能超过5MB' }, { status: 400 });
      }

      // 创建上传目录
      const uploadDir = join(process.cwd(), 'public', 'uploads', 'payment-qr');
      if (!existsSync(uploadDir)) {
        await mkdir(uploadDir, { recursive: true });
      }

      // 生成文件名
      const timestamp = Date.now();
      const extension = file.name.split('.').pop();
      const filename = `${user.id}-${timestamp}.${extension}`;
      const filepath = join(uploadDir, filename);

      // 保存文件
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      await writeFile(filepath, buffer);

      // 生成访问URL
      const fileUrl = `/uploads/payment-qr/${filename}`;

      // 更新数据库
      await prisma.user.update({
        where: { id: user.id },
        data: { paymentQrCode: fileUrl }
      });

      return NextResponse.json({ 
        success: true, 
        qrCode: fileUrl,
        message: '收款码上传成功' 
      });

    } else {
      // 处理直链保存
      const body = await request.json();
      const { url } = body;

      if (!url) {
        return NextResponse.json({ error: '请提供收款码链接' }, { status: 400 });
      }

      // 简单的URL验证
      try {
        new URL(url);
      } catch {
        return NextResponse.json({ error: '请提供有效的URL' }, { status: 400 });
      }

      // 更新数据库
      await prisma.user.update({
        where: { id: user.id },
        data: { paymentQrCode: url }
      });

      return NextResponse.json({ 
        success: true, 
        qrCode: url,
        message: '收款码链接保存成功' 
      });
    }

  } catch (error) {
    console.error('上传收款码失败:', error);
    return NextResponse.json({ error: '上传收款码失败' }, { status: 500 });
  }
}

// DELETE /api/admin/payment-qr - 删除收款码
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: { paymentQrCode: null }
    });

    return NextResponse.json({ 
      success: true,
      message: '收款码删除成功' 
    });
  } catch (error) {
    console.error('删除收款码失败:', error);
    return NextResponse.json({ error: '删除收款码失败' }, { status: 500 });
  }
}