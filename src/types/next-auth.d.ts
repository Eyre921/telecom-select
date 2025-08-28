import { Role } from '@prisma/client';
import NextAuth from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      name: string;
      email?: string;
      phone: string;
      username?: string;
      role: Role;
    };
  }

  interface User {
    id: string;
    name: string;
    email?: string;
    phone: string;
    username?: string;
    role: Role;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role: Role;
    phone: string;
    username?: string;
  }
}
