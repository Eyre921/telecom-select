import {NextResponse} from 'next/server';
import bcrypt from 'bcrypt';
import prisma from '@/lib/prisma';
// We instantiate Prisma Client directly here to ensure it's self-contained
// and not affected by other files.


export async function POST(request: Request) {
    try {
        const body = await request.json();
        const {email, password} = body;

        // 1. Validate input
        if (!email || !password) {
            return new NextResponse(JSON.stringify({error: '缺少邮箱或密码'}), {status: 400});
        }

        // 2. Check if user already exists
        const existingUser = await prisma.user.findUnique({
            where: {
                email: email,
            },
        });

        if (existingUser) {
            return new NextResponse(JSON.stringify({error: '该邮箱已被注册'}), {status: 409});
        }

        // 3. Hash the password
        const hashedPassword = await bcrypt.hash(password, 12);

        // 4. Create the new user
        const user = await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                role: 'MARKETER', // Default role is MARKETER
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
