import type { NextAuthConfig } from "next-auth";

type Role = "ADMIN" | "SENIOR_MANAGER" | "MANAGER" | "EMPLOYEE";

const ADMIN_LIKE: Role[] = ["ADMIN", "SENIOR_MANAGER"];

const ADMIN_PREFIXES = [
  "/employees",
  "/reports",
  "/sales",
  "/billing",
  "/settings",
];

const STAFF_PREFIXES = ["/projects", "/closed", "/team", "/hours"];
const EMPLOYEE_PREFIXES = ["/my-projects", "/my-tasks", "/my-hours"];

function startsWithAny(path: string, prefixes: string[]) {
  return prefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

export const authConfig = {
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 24 * 7,
  },
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const path = request.nextUrl.pathname;
      const isLoggedIn = Boolean(auth?.user);
      const role = (auth?.user as { role?: Role } | undefined)?.role;

      if (path.startsWith("/login")) {
        if (isLoggedIn) {
          return Response.redirect(new URL("/dashboard", request.nextUrl));
        }
        return true;
      }

      if (!isLoggedIn) return false;

      if (startsWithAny(path, ADMIN_PREFIXES) && (!role || !ADMIN_LIKE.includes(role))) {
        return Response.redirect(new URL("/dashboard", request.nextUrl));
      }

      if (
        (path === "/projects/new" || path.startsWith("/projects/new/")) &&
        (!role || !ADMIN_LIKE.includes(role))
      ) {
        return Response.redirect(new URL("/projects", request.nextUrl));
      }

      if (startsWithAny(path, STAFF_PREFIXES) && role === "EMPLOYEE") {
        return Response.redirect(new URL("/dashboard", request.nextUrl));
      }

      if (startsWithAny(path, EMPLOYEE_PREFIXES) && role === "EMPLOYEE") {
        return true;
      }

      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role: Role }).role;
        token.name = user.name;
        token.email = user.email;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as Role;
        session.user.name = (token.name as string) ?? session.user.name;
        session.user.email = (token.email as string) ?? session.user.email;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
