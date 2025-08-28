import prisma from '@/lib/prisma';

export async function GET() {
  try {
    // 检查数据库连接
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({ 
      status: 'healthy', 
      timestamp: new Date().toISOString(),
      database: 'connected'
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return Response.json({ 
      status: 'unhealthy', 
      error: errorMessage 
    }, { status: 503 });
  }
}