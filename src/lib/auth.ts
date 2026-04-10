import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

import { query } from "@/lib/db";
import type { Member } from "@/lib/types";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      role: string | null;
      memberId: number;
    };
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email =
          typeof credentials?.email === "string" ? credentials.email.trim().toLowerCase() : "";
        const password =
          typeof credentials?.password === "string" ? credentials.password : "";

        if (!email || !password) return null;

        const r = await query<Member>(
          `SELECT * FROM hei_work_members
           WHERE type='human' AND is_active=true AND LOWER(email)=$1
           LIMIT 1`,
          [email],
        );
        const member = r.rows[0];
        if (!member || !member.password_hash) return null;

        const ok = await bcrypt.compare(password, member.password_hash);
        if (!ok) return null;

        return {
          id: String(member.id),
          email: member.email,
          name: member.name,
          role: member.role,
          memberId: member.id,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const u = user as { memberId?: number; role?: string | null };
        if (typeof u.memberId === "number") token.memberId = u.memberId;
        if (typeof u.role !== "undefined") token.role = u.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = String(token.memberId ?? token.sub ?? "");
        session.user.memberId = (token.memberId as number) ?? 0;
        session.user.role = (token.role as string | null) ?? null;
      }
      return session;
    },
  },
});
