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
    if (!token.refreshToken) {
      console.warn("No refresh token available, skipping refresh.");
      return { ...token, error: "RefreshAccessTokenError" };
    }

    const issuer = process.env.AUTH_KEYCLOAK_ISSUER?.replace(/\/$/, "");
    const url = `${issuer}/protocol/openid-connect/token`;
    
    console.log("Refreshing access token using refresh token...");
    
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.AUTH_KEYCLOAK_ID!,
        client_secret: process.env.AUTH_KEYCLOAK_SECRET!,
        grant_type: "refresh_token",
        refresh_token: token.refreshToken,
        // Removed 'scope' from refresh request. Keycloak will automatically 
        // use scopes from the original token, allowing for smoother transitions.
      }),
    })

    const refreshedTokens = await response.json()

    if (!response.ok) {
      console.error("Keycloak token refresh failed:", refreshedTokens);
      throw refreshedTokens
    }

    console.log("Access token successfully refreshed.");

    return {
      ...token,
      accessToken: refreshedTokens.access_token,
      idToken: refreshedTokens.id_token ?? token.idToken,
      accessTokenExpires: Date.now() + (refreshedTokens.expires_in ?? 0) * 1000,
      refreshToken: refreshedTokens.refresh_token ?? token.refreshToken,
    }
  } catch (error) {
    console.error("RefreshAccessTokenError", error)
    return {
      ...token,
      error: "RefreshAccessTokenError",
    }
  }
}

const keycloakIssuer = process.env.AUTH_KEYCLOAK_ISSUER?.replace(/\/$/, "");

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Keycloak({
      clientId: process.env.AUTH_KEYCLOAK_ID,
      clientSecret: process.env.AUTH_KEYCLOAK_SECRET,
      issuer: keycloakIssuer,
      // Manually specifying the well-known endpoint helps when discovery handles trailing slashes inconsistently
      wellKnown: `${keycloakIssuer}/.well-known/openid-configuration`,
      checks: ['pkce', 'state'],
      authorization: {
        params: {
          scope: "openid profile email offline_access",
        },
      },
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
      // Add a 2-minute buffer to proactively refresh before it actually expires
      // This ensures we have a valid token even if the browser has clock drift or short lifespans
      if (Date.now() < (token.accessTokenExpires as number) - 2 * 60 * 1000) {
        return token
      }

      // Access token has expired (or is about to), try to update it
      console.log("Session nearing expiration or expired, attempting refresh...");
      return refreshAccessToken(token)
    },
    async session({ session, token }: { session: any; token: any }) {
      if (session.user) {
        session.accessToken = token.accessToken
        session.idToken = token.idToken
        session.error = token.error
        // Explicitly set role and ensure it's not swallowed
        session.user.role = token.role || session.user.role || 'user'
      }
      return session
    },
  },
  // Set trustHost to true for environments like OpenShift where the host header might be different
  trustHost: true,
  debug: process.env.NODE_ENV === 'development',
  events: {
    async signOut(message: any) {
      const token = "token" in message ? message.token : null
      if (token?.idToken) {
        try {
          const issuer = process.env.AUTH_KEYCLOAK_ISSUER
          const logOutUrl = new URL(`${issuer}/protocol/openid-connect/logout`)
          logOutUrl.searchParams.set("id_token_hint", token.idToken)
          // Note: In NextAuth v5, this event is informative. 
          // To truly logout of Keycloak, the client-side signOut should pass a redirect.
        } catch (e) {
          console.error("Error creating logout URL", e)
        }
      }
    }
  }
})
