/* eslint-disable @typescript-eslint/no-explicit-any */
import NextAuth, { type DefaultSession } from "next-auth";
import Keycloak from "next-auth/providers/keycloak";

declare module "next-auth" {
  interface Session extends DefaultSession {
    accessToken?: string;
    idToken?: string;
    error?: string;
    user: {
      role?: string;
    } & DefaultSession["user"]
  }
}

/**
 * Exchange a Keycloak ID token for a long-lived backend-issued JWT.
 * This is the key to avoiding Keycloak refresh token issues:
 * the Keycloak token is only used ONCE at login time, then discarded.
 */
async function exchangeForBackendToken(keycloakIdToken: string): Promise<{
  token: string;
  expiresAt: number;
  user: { email: string; username: string; role: string };
} | null> {
  try {
    const apiUrl = process.env.INTERNAL_API_URL || "http://localhost:8080/api/v1";
    const response = await fetch(`${apiUrl}/auth/oidc/exchange`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id_token: keycloakIdToken }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("Backend token exchange failed:", response.status, errorBody);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error("Backend token exchange error:", error);
    return null;
  }
}

const keycloakIssuer = process.env.AUTH_KEYCLOAK_ISSUER?.replace(/\/$/, "");

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Keycloak({
      clientId: process.env.AUTH_KEYCLOAK_ID,
      clientSecret: process.env.AUTH_KEYCLOAK_SECRET,
      issuer: keycloakIssuer,
      wellKnown: `${keycloakIssuer}/.well-known/openid-configuration`,
      checks: ["pkce", "state"],
      authorization: {
        params: {
          // No offline_access — we don't need Keycloak refresh tokens at all
          scope: "openid profile email",
        },
      },
      client: {
        authorization_signed_response_alg: "RS256",
        id_token_signed_response_alg: "RS256",
      },
    }),
  ],
  session: {
    strategy: "jwt",
    // The session cookie lasts 8 hours, matching the backend token lifetime
    maxAge: 8 * 60 * 60,
  },
  callbacks: {
    async jwt({ token, account, profile }) {
      // --- Initial sign-in: exchange Keycloak token for a backend JWT ---
      if (account && profile) {
        const keycloakIdToken = account.id_token;

        if (keycloakIdToken) {
          console.log("OIDC login successful, exchanging for backend session token...");
          const exchangeResult = await exchangeForBackendToken(keycloakIdToken);

          if (exchangeResult) {
            console.log("Backend token exchange successful, session valid for 8 hours.");
            token.accessToken = exchangeResult.token;
            token.backendTokenExpiresAt = exchangeResult.expiresAt * 1000; // ms
            token.role = exchangeResult.user.role;
            token.email = exchangeResult.user.email;
            token.name = exchangeResult.user.username;
            // Do NOT store idToken, refreshToken, or any Keycloak tokens
            return token;
          }

          // Exchange failed — fall back to using Keycloak claims directly
          console.warn("Backend token exchange failed, using Keycloak claims as fallback.");
          token.accessToken = keycloakIdToken;
          token.backendTokenExpiresAt = Date.now() + 8 * 60 * 60 * 1000;
        }

        // Extract role from Keycloak profile
        const profileAny = profile as any;
        const permissions = [
          ...(profileAny.realm_access?.roles || []),
          ...(profileAny.groups || []),
          ...Object.values(profileAny.resource_access || {}).flatMap(
            (c: any) => c.roles || []
          ),
        ].map((p) => String(p).toLowerCase());

        const adminGroup = (
          process.env.AUTH_ADMIN_GROUP || "admin"
        ).toLowerCase();
        const isAdmin = permissions.some(
          (p) =>
            p === adminGroup || p === `/${adminGroup}` || p === "admin"
        );

        token.role = isAdmin ? "admin" : "user";
        return token;
      }

      // --- Subsequent requests: check if backend token is still valid ---
      if (
        token.backendTokenExpiresAt &&
        Date.now() > (token.backendTokenExpiresAt as number)
      ) {
        console.warn("Backend session token expired (8h limit reached).");
        // Return error to trigger re-authentication
        return { ...token, error: "SessionExpired" };
      }

      // Token is still valid — no refresh needed
      return token;
    },

    async session({ session, token }: { session: any; token: any }) {
      if (session.user) {
        session.accessToken = token.accessToken;
        session.error = token.error;
        session.user.role = token.role || session.user.role || "user";
      }
      return session;
    },
  },
  trustHost: true,
  debug: process.env.NODE_ENV === "development",
  events: {
    async signOut(message: any) {
      const token = "token" in message ? message.token : null;
      if (token?.idToken) {
        try {
          const issuer = process.env.AUTH_KEYCLOAK_ISSUER;
          const logOutUrl = new URL(
            `${issuer}/protocol/openid-connect/logout`
          );
          logOutUrl.searchParams.set("id_token_hint", token.idToken);
        } catch (e) {
          console.error("Error creating logout URL", e);
        }
      }
    },
  },
});
