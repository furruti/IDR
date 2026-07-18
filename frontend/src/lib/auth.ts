import NextAuth, { type DefaultSession, type Session } from 'next-auth';
import Keycloak from 'next-auth/providers/keycloak';
import Credentials from 'next-auth/providers/credentials';
import type { JWT } from 'next-auth/jwt';

type KeycloakProfile = {
  sub?: string;
  name?: string;
  given_name?: string;
  family_name?: string;
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
        profile(profile: KeycloakProfile) {
          const fullName = [profile.given_name, profile.family_name].filter(Boolean).join(' ') ||
                           profile.name ||
                           profile.preferred_username ||
                           'Usuario';
          return {
            id: profile.sub ?? '',
            name: fullName,
            email: profile.email ?? '',
            image: null,
            given_name: profile.given_name,
            family_name: profile.family_name,
            preferred_username: profile.preferred_username,
          };
        }
      }),
    ];

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  providers: authProviders,
  debug: process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_DEBUG_AUTH === 'true',
  session: {
    strategy: 'jwt',
    maxAge: 12 * 60 * 60, // 12 horas
  },
  callbacks: {
    async jwt({ token, account, profile, user }) {
      if (isBypass) {
        if (user) {
          token.name = user.name;
          token.email = user.email;
          token.roles = ['admin', 'user']; // Roles por defecto para bypass
        }
        return token;
      }

      const keycloakProfile = profile as KeycloakProfile | undefined;

      if (user) {
        token.name = user.name;
        token.email = user.email;
        token.given_name = (user as any).given_name;
        token.family_name = (user as any).family_name;
        token.preferred_username = (user as any).preferred_username;
      } else if (keycloakProfile) {
        const fullName = [keycloakProfile.given_name, keycloakProfile.family_name].filter(Boolean).join(' ') ||
                         keycloakProfile.name ||
                         keycloakProfile.preferred_username ||
                         'Usuario';
        token.name = fullName;
        token.email = keycloakProfile.email;
        token.given_name = keycloakProfile.given_name;
        token.family_name = keycloakProfile.family_name;
        token.preferred_username = keycloakProfile.preferred_username;
      }

      if (keycloakProfile) {
        token.roles = getRoles(keycloakProfile);
      }

      return token;
    },
    async session({ session, token }: { session: Session; token: JWT }) {
      session.user = {
        ...session.user,
        id: token.sub,
        name: token.name ?? session.user?.name,
        email: token.email ?? session.user?.email,
        image: session.user?.image,
        roles: token.roles ?? [],
        given_name: token.given_name,
        family_name: token.family_name,
        preferred_username: token.preferred_username,
      };

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
