import {NextResponse} from 'next/server';
import bcrypt from 'bcrypt';
import prisma from '@/lib/prisma';
// We instantiate Prisma Client directly here to ensure it's self-contained
// and not affected by other files.


export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { email, password, name, phone } = body;  // 添加 name 和 phone

        // 1. Validate input
        if (!email || !password || !name || !phone) {  // 添加 name 和 phone 验证
            return new NextResponse(JSON.stringify({error: '缺少必填字段：邮箱、密码、姓名或手机号'}), {status: 400});
        }

        // 手机号格式验证
        const phoneRegex = /^1[3-9]\d{9}$/;
        if (!phoneRegex.test(phone)) {
            return new NextResponse(JSON.stringify({error: '手机号格式不正确'}), {status: 400});
        }

        // 2. Check if user already exists
        const existingUser = await prisma.user.findFirst({
            where: {
                OR: [
                    { email: email },
                    { phone: phone }  // 检查手机号是否已存在
                ]
            },
        });

        if (existingUser) {
            return new NextResponse(JSON.stringify({error: '该邮箱或手机号已被注册'}), {status: 409});
        }

        // 3. Hash the password
        const hashedPassword = await bcrypt.hash(password, 12);

        // 4. Create the new user
        const user = await prisma.user.create({
            data: {
                email,
                name,     // 添加 name
                phone,    // 添加 phone
                password: hashedPassword,
                role: 'MARKETER',
            },
        });

        // 5. Return a success response (without the password)
        const {password: userPassword, ...userWithoutPassword} = user;
        return NextResponse.json(userWithoutPassword, {status: 201});
    } catch (error) {
        console.error('[REGISTER_API_ERROR]', error);
        // Return a proper JSON error response
        return new NextResponse(JSON.stringify({error: '服务器内部错误'}), {status: 500});
    }
}
