import { AuthOptions } from 'next-auth';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcrypt';
import prisma from '@/lib/prisma';

export const authOptions: AuthOptions = {
    adapter: PrismaAdapter(prisma),
    providers: [
        CredentialsProvider({
            name: 'Credentials',
            credentials: {
                email: { label: 'Email', type: 'text' },
                password: { label: 'Password', type: 'password' },
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) {
                    throw new Error('请输入账号和密码');
                }
                const user = await prisma.user.findUnique({
                    where: { email: credentials.email },
                });
                if (!user || !user.password) {
                    throw new Error('无效的凭据');
                }
                const isCorrectPassword = await bcrypt.compare(
                    credentials.password,
                    user.password
                );
                if (!isCorrectPassword) {
                    throw new Error('无效的凭据');
                }
                return user;
            },
        }),
    ],
    // **关键修改**: 告诉 next-auth 使用我们的自定义登录页面
    pages: {
        signIn: '/signin',
    },
    debug: process.env.NODE_ENV === 'development',
    session: {
        strategy: 'jwt',
    },
    callbacks: {
        // redirect 回调可以被移除，因为跳转由自定义页面精确处理
        jwt: async ({ token, user }) => {
            if (user) {
                token.id = user.id;
                token.role = user.role;
            }
            return token;
        },
        session: async ({ session, token }) => {
            if (token && session.user) {
                session.user.id = token.id as string;
                session.user.role = token.role as 'ADMIN' | 'MARKETER';
            }
            return session;
        },
    },
    secret: process.env.NEXTAUTH_SECRET,
};
