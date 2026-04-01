/* eslint-disable @typescript-eslint/no-explicit-any */
import NextAuth, { type DefaultSession } from "next-auth";
import Keycloak from "next-auth/providers/keycloak";

const oidcClientId = process.env.AUTH_OIDC_ID;
const oidcClientSecret = process.env.AUTH_OIDC_SECRET;
const oidcIssuer = process.env.AUTH_OIDC_ISSUER?.replace(/\/$/, "");

declare module "next-auth" {
  interface Session extends DefaultSession {
    accessToken?: string;
    idToken?: string;
    error?: string;
    user: {
      id?: string;
      role?: string;
      authType?: string;
      canSubmitApps?: boolean;
    } & DefaultSession["user"]
  }
}

/**
 * Exchange an OIDC ID token for a long-lived backend-issued JWT.
 * This avoids relying on provider refresh token semantics:
 * the upstream token is only used ONCE at login time, then discarded.
 */
async function exchangeForBackendToken(oidcIdToken: string): Promise<{
  token: string;
  expiresAt: number;
  user: { id: string; email: string; username: string; role: string; authType: string; canSubmitApps: boolean };
} | null> {
  try {
    const apiUrl = process.env.INTERNAL_API_URL || "http://localhost:8080/api/v1";
    const response = await fetch(`${apiUrl}/auth/oidc/exchange`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id_token: oidcIdToken }),
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

const oidcProvider = {
  ...Keycloak({
    clientId: oidcClientId,
    clientSecret: oidcClientSecret,
    issuer: oidcIssuer,
    wellKnown: oidcIssuer ? `${oidcIssuer}/.well-known/openid-configuration` : undefined,
    checks: ["pkce", "state"],
    authorization: {
      params: {
        // No offline_access — we don't need upstream refresh tokens at all.
        scope: "openid profile email",
      },
    },
    client: {
      authorization_signed_response_alg: "RS256",
      id_token_signed_response_alg: "RS256",
    },
  }),
  id: "oidc",
  name: "OIDC",
};

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [oidcProvider],
  session: {
    strategy: "jwt",
    // The session cookie lasts 8 hours, matching the backend token lifetime
    maxAge: 8 * 60 * 60,
  },
  callbacks: {
    async jwt({ token, account, profile }) {
      // --- Initial sign-in: exchange the upstream OIDC token for a backend JWT ---
      if (account && profile) {
        const oidcIdToken = account.id_token;

        if (oidcIdToken) {
          console.log("OIDC login successful, exchanging for backend session token...");
          const exchangeResult = await exchangeForBackendToken(oidcIdToken);

          if (exchangeResult) {
            console.log("Backend token exchange successful, session valid for 8 hours.");
            token.accessToken = exchangeResult.token;
            token.backendTokenExpiresAt = exchangeResult.expiresAt * 1000; // ms
            token.role = exchangeResult.user.role;
            token.email = exchangeResult.user.email;
            token.name = exchangeResult.user.username;
            token.id = exchangeResult.user.id;
            token.authType = exchangeResult.user.authType;
            token.canSubmitApps = exchangeResult.user.canSubmitApps;
            // Do NOT store upstream provider tokens in the app session.
            return token;
          }

          // Exchange failed — force re-authentication instead of using the raw upstream token.
          // Using the raw OIDC token is unsafe: the user may not yet exist in the backend DB,
          // which would cause all write operations (create app, etc.) to silently fail with 401.
          console.error("Backend token exchange failed. Requesting re-authentication.");
          return { ...token, error: "ExchangeFailed" };
        }

        // No id_token available — force re-auth
        return { ...token, error: "ExchangeFailed" };
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
        session.user.id = token.id || session.user.id;
        session.user.authType = token.authType;
        session.user.canSubmitApps = token.canSubmitApps;
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
          const issuer = oidcIssuer;
          if (!issuer) {
            return;
          }
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
