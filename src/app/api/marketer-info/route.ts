import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const marketer = searchParams.get('marketer');
        
        if (!marketer) {
            return NextResponse.json({ error: 'marketer参数不能为空' }, { status: 400 });
        }
        
        // 查找marketer用户
        const marketerUser = await prisma.user.findFirst({
            where: {
                OR: [
                    { username: marketer },
                    { email: marketer },
                    { id: marketer },
                    { name: marketer }
                ]
            },
            select: {
                id: true,
                name: true,
                role: true,
                paymentQrCode: true, // 添加收款码字段
                organizations: {
                    include: {
                        organization: {
                            select: {
                                id: true,
                                name: true,
                                type: true
                            }
                        }
                    }
                }
            }
        });
        
        if (!marketerUser) {
            return NextResponse.json({ error: 'marketer不存在' }, { status: 404 });
        }
        
        // 提取学校信息
        const schools = marketerUser.organizations
            .filter(uo => uo.organization.type === 'SCHOOL')
            .map(uo => ({
                id: uo.organization.id,
                name: uo.organization.name
            }));
            
        // 提取院系信息
        const departments = marketerUser.organizations
            .filter(uo => uo.organization.type === 'DEPARTMENT')
            .map(uo => ({
                id: uo.organization.id,
                name: uo.organization.name
            }));
        
        return NextResponse.json({
            marketer: {
                id: marketerUser.id,
                name: marketerUser.name,
                role: marketerUser.role,
                paymentQrCode: marketerUser.paymentQrCode // 包含收款码信息
            },
            schools,
            departments
        });
        
    } catch (error) {
        console.error('获取marketer信息失败:', error);
        return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
    }
}