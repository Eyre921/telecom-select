import NextAuth, { AuthOptions } from 'next-auth';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcrypt';

import prisma from '@/lib/prisma';

export const authOptions: AuthOptions = {
    // Use Prisma Adapter to connect Next-Auth with your database
    adapter: PrismaAdapter(prisma),

    // Configure one or more authentication providers
    providers: [
        CredentialsProvider({
            name: 'credentials',
            credentials: {
                email: { label: 'Email', type: 'text' },
                password: { label: 'Password', type: 'password' },
            },
            // This is where you define the logic to authorize a user
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) {
                    throw new Error('请输入邮箱和密码');
                }

                const user = await prisma.user.findUnique({
                    where: {
                        email: credentials.email,
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

                // If everything is correct, return the user object
                // The user object will be available in the JWT and session callbacks
                return user;
            },
        }),
    ],

    // Define debug mode for development
    debug: process.env.NODE_ENV === 'development',

    // Use JSON Web Tokens for session management
    session: {
        strategy: 'jwt',
    },

    // Callbacks are asynchronous functions you can use to control what happens when an action is performed.
    callbacks: {
        // This callback is called whenever a JSON Web Token is created or updated.
        jwt: async ({ token, user }) => {
            // On initial sign in, `user` object is available.
            // We are adding user's id and role to the token here.
            if (user) {
                token.id = user.id;
                token.role = user.role; // Assuming 'role' is a field on your User model
            }
            return token;
        },
        // This callback is called whenever a session is checked.
        session: async ({ session, token }) => {
            // We are adding the id and role from the token to the session object.
            // Now you can access these properties on the client-side using `useSession()`.
            if (token && session.user) {
                session.user.id = token.id as string;
                session.user.role = token.role as 'ADMIN' | 'MARKETER';
            }
            return session;
        },
    },

    // A secret to sign and encrypt JWTs, cookies, and other tokens.
    // You must set this in your .env.local file.
    secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
