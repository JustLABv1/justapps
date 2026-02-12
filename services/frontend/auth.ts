import NextAuth, { type DefaultSession } from "next-auth";
import Keycloak from "next-auth/providers/keycloak";

declare module "next-auth" {
  interface Session extends DefaultSession {
    accessToken?: string;
    idToken?: string;
    user: {
      role?: string;
    } & DefaultSession["user"]
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Keycloak({
      clientId: process.env.AUTH_KEYCLOAK_ID,
      clientSecret: process.env.AUTH_KEYCLOAK_SECRET,
      issuer: process.env.AUTH_KEYCLOAK_ISSUER,
      // Manually specifying the well-known endpoint can help when discovery fails with "unexpected HTTP status code"
      wellKnown: `${process.env.AUTH_KEYCLOAK_ISSUER}/.well-known/openid-configuration`,
      checks: ['pkce', 'state'],
      client: {
        authorization_signed_response_alg: 'RS256',
        id_token_signed_response_alg: 'RS256',
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account) {
        token.accessToken = account.access_token
        token.idToken = account.id_token
      }
      if (profile) {
        const profileAny = profile as any
        
        // Comprehensive check across realm roles, groups, and client roles
        const permissions = [
          ...(profileAny.realm_access?.roles || []),
          ...(profileAny.groups || []),
          ...Object.values(profileAny.resource_access || {}).flatMap((c: any) => c.roles || [])
        ].map(p => String(p).toLowerCase())
        
        const adminGroup = (process.env.AUTH_ADMIN_GROUP || 'admin').toLowerCase()
        const isAdmin = permissions.some(p => 
          p === adminGroup || 
          p === `/${adminGroup}` || 
          p === 'admin'
        )
        
        token.role = isAdmin ? 'admin' : 'user'
      }
      return token
    },
    async session({ session, token }: { session: any; token: any }) {
      if (session.user) {
        session.accessToken = token.accessToken
        session.idToken = token.idToken
        session.user.role = token.role || 'user'
      }
      return session
    },
  },
  // Set trustHost to true for environments like OpenShift where the host header might be different
  trustHost: true,
  debug: process.env.NODE_ENV === 'development',
})
