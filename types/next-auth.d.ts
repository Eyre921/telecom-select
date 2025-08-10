import NextAuth, { DefaultSession, DefaultUser } from 'next-auth';
import { JWT, DefaultJWT } from 'next-auth/jwt';
import { Role } from '@prisma/client'; // Import the Role enum from your generated Prisma client

// Extend the built-in session and user types
declare module 'next-auth' {
    /**
     * Returned by `useSession`, `getSession` and received as a prop on the `SessionProvider` React Context
     */
    interface Session {
        user: {
            /** The user's id. */
            id: string;
            /** The user's role. */
            role: Role;
        } & DefaultSession['user']; // Keep the default properties
    }

    /**
     * The shape of the user object returned in the OAuth providers' `profile` callback,
     * or the second parameter of the `session` callback, when using a database.
     */
    interface User extends DefaultUser {
        role: Role;
    }
}

// Extend the built-in JWT type
declare module 'next-auth/jwt' {
    /** Returned by the `jwt` callback and `getToken`, when using JWT sessions */
    interface JWT extends DefaultJWT {
        /** The user's role. */
        role: Role;
        id: string;
    }
}
