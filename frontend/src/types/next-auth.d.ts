import type { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id?: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      roles: string[];
      given_name?: string | null;
      family_name?: string | null;
      preferred_username?: string | null;
    } & DefaultSession['user'];
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    roles?: string[];
    given_name?: string | null;
    family_name?: string | null;
    preferred_username?: string | null;
  }
}
