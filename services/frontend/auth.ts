/* eslint-disable @typescript-eslint/no-explicit-any */
import NextAuth, { type DefaultSession } from "next-auth";
import Keycloak from "next-auth/providers/keycloak";

declare module "next-auth" {
  interface Session extends DefaultSession {
    accessToken?: string;
    idToken?: string;
    refreshToken?: string;
    error?: string;
    user: {
      role?: string;
    } & DefaultSession["user"]
  }
}

async function refreshAccessToken(token: any) {
  try {
    const url = `${process.env.AUTH_KEYCLOAK_ISSUER}/protocol/openid-connect/token`
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.AUTH_KEYCLOAK_ID!,
        client_secret: process.env.AUTH_KEYCLOAK_SECRET!,
        grant_type: "refresh_token",
        refresh_token: token.refreshToken,
      }),
    })

    const refreshedTokens = await response.json()

    if (!response.ok) {
      throw refreshedTokens
    }

    return {
      ...token,
      accessToken: refreshedTokens.access_token,
      idToken: refreshedTokens.id_token,
      accessTokenExpires: Date.now() + refreshedTokens.expires_in * 1000,
      refreshToken: refreshedTokens.refresh_token ?? token.refreshToken, // Fallback to old refresh token
    }
  } catch (error) {
    console.error("RefreshAccessTokenError", error)
    return {
      ...token,
      error: "RefreshAccessTokenError",
    }
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
      // Initial sign in
      if (account && profile) {
        token.accessToken = account.access_token
        token.idToken = account.id_token
        token.refreshToken = account.refresh_token
        token.accessTokenExpires = account.expires_at ? account.expires_at * 1000 : Date.now() + (account.expires_in || 0) * 1000
        
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
        return token
      }

      // Return previous token if the access token has not expired yet
      if (Date.now() < (token.accessTokenExpires as number)) {
        return token
      }

      // Access token has expired, try to update it
      return refreshAccessToken(token)
    },
    async session({ session, token }: { session: any; token: any }) {
      if (session.user) {
        session.accessToken = token.accessToken
        session.idToken = token.idToken
        session.error = token.error
        session.user.role = token.role || 'user'
      }
      return session
    },
  },
  // Set trustHost to true for environments like OpenShift where the host header might be different
  trustHost: true,
  debug: process.env.NODE_ENV === 'development',
  events: {
    async signOut({ token }: { token: any }) {
      if (token.idToken) {
        try {
          const issuer = process.env.AUTH_KEYCLOAK_ISSUER
          const logOutUrl = new URL(`${issuer}/protocol/openid-connect/logout`)
          logOutUrl.searchParams.set("id_token_hint", token.idToken)
          // We don't return the URL here, but log it or prepare for it if needed.
          // In NextAuth v5, the standard signOut will just clear cookies. 
          // To truly logout of Keycloak, the frontend should ideally redirect to this URL.
        } catch (e) {
          console.error("Error creating logout URL", e)
        }
      }
    }
  }
})
