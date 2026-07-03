import NextAuth, { type DefaultSession, type Session } from 'next-auth';
import Keycloak from 'next-auth/providers/keycloak';
import Credentials from 'next-auth/providers/credentials';
import type { JWT } from 'next-auth/jwt';

type KeycloakProfile = {
  sub?: string;
  name?: string;
  email?: string;
  preferred_username?: string;
  realm_access?: { roles?: string[] };
  resource_access?: Record<string, { roles?: string[] }>;
};

function getKeycloakIssuer() {
  return process.env.KEYCLOAK_ISSUER_URL ?? process.env.KEYCLOAK_ISSUER;
}

function getRoles(profile?: KeycloakProfile): string[] {
  const roles = new Set<string>();

  profile?.realm_access?.roles?.forEach((role) => roles.add(role));

  Object.values(profile?.resource_access ?? {}).forEach((resource) => {
    resource.roles?.forEach((role) => roles.add(role));
  });

  return [...roles];
}

const isBypass = process.env.NEXT_PUBLIC_BYPASS_AUTH === 'true';

const authProviders = isBypass
  ? [
      Credentials({
        id: 'credentials',
        name: 'Bypass Auth',
        credentials: {},
        async authorize() {
          return {
            id: 'bypass-user-id',
            name: 'Usuario Bypass',
            email: 'bypass@hcdn.gob.ar',
          };
        },
      }),
    ]
  : [
      Keycloak({
        clientId: process.env.KEYCLOAK_CLIENT_ID,
        clientSecret: process.env.KEYCLOAK_CLIENT_SECRET,
        issuer: getKeycloakIssuer(),
      }),
    ];

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  providers: authProviders,
  debug: process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_DEBUG_AUTH === 'true',
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async jwt({ token, account, profile, user }) {
      if (isBypass) {
        if (user) {
          token.user = {
            id: user.id,
            name: user.name,
            email: user.email,
          } satisfies DefaultSession['user'];
          token.roles = ['admin', 'user']; // Roles por defecto para bypass
        }
        return token;
      }

      const keycloakProfile = profile as KeycloakProfile | undefined;

      // ATENCIÓN: Evitamos guardar el access_token y el id_token enteros en el token de NextAuth.
      // Los tokens de Keycloak son muy grandes y causan que la cookie supere los 4KB.
      // Cuando esto pasa, los Proxies Reversos (Nginx/Ingress) en producción descartan la cookie silenciosamente,
      // lo que resulta en que /api/auth/session devuelva `null` después del login.
      if (account) {
        token.expiresAt = account.expires_at;
      }

      if (keycloakProfile) {
        token.user = {
          id: keycloakProfile.sub,
          name: keycloakProfile.name ?? keycloakProfile.preferred_username,
          email: keycloakProfile.email,
        } satisfies DefaultSession['user'];
        token.roles = getRoles(keycloakProfile);
      }

      return token;
    },
    async session({ session, token }: { session: Session; token: JWT }) {
      const tokenUser = token.user ?? {};

      session.user = {
        ...session.user,
        id: tokenUser.id,
        name: tokenUser.name ?? session.user?.name,
        email: tokenUser.email ?? session.user?.email,
        image: session.user?.image,
        roles: token.roles ?? [],
      };
      session.expiresAt = token.expiresAt;

      return session;
    },
    async redirect({ url, baseUrl }) {
      if (url.startsWith('/')) {
        return `${baseUrl}${url}`;
      }

      try {
        const targetUrl = new URL(url);

        if (targetUrl.origin === baseUrl) {
          return url;
        }
      } catch {
        return baseUrl;
      }

      return baseUrl;
    },
  },
});
