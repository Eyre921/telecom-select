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
                identifier: { label: '账号/手机号/邮箱', type: 'text' },
                password: { label: '密码', type: 'password' },
            },
            async authorize(credentials, req) {
                if (!credentials?.identifier || !credentials?.password) {
                    throw new Error('请输入账号和密码');
                }
                
                // 支持用户名、手机号、邮箱三种方式登录
                const user = await prisma.user.findFirst({
                    where: {
                        OR: [
                            { username: credentials.identifier },
                            { phone: credentials.identifier },
                            { email: credentials.identifier },
                        ],
                    },
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
                
                // 返回符合 NextAuth User 类型的对象
                return {
                    id: user.id,
                    name: user.name,
                    email: user.email || undefined, // 转换 null 为 undefined
                    phone: user.phone,
                    username: user.username || undefined,
                    role: user.role,
                };
            },
        }),
    ],
    pages: {
        signIn: '/signin',
    },
    debug: process.env.NODE_ENV === 'development',
    session: {
        strategy: 'jwt',
    },
    callbacks: {
        jwt: async ({ token, user }) => {
            if (user) {
                token.id = user.id;
                token.role = user.role;
                token.phone = user.phone;
                token.username = user.username;
            }
            return token;
        },
        session: async ({ session, token }) => {
            if (token && session.user) {
                session.user.id = token.id as string;
                session.user.role = token.role;
                session.user.phone = token.phone as string;
                session.user.username = token.username as string;
            }
            return session;
        },
    },
    secret: process.env.NEXTAUTH_SECRET,
};
