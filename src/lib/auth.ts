import { type AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

// Each logged-in user can belong to more than one Business (see Membership model).
// The active business is chosen at login/switch time and stored in the JWT so every
// server action and API route can scope its Prisma queries by businessId.
export const authOptions: AuthOptions = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        businessId: { label: "Business", type: "text" },
      },
      async authorize(credentials) {
        if (
          !credentials?.email ||
          !credentials?.password ||
          !credentials?.businessId ||
          typeof credentials.email !== "string" ||
          typeof credentials.password !== "string" ||
          typeof credentials.businessId !== "string"
        ) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email.trim().toLowerCase() },
          include: {
            memberships: {
              where: { active: true, businessId: credentials.businessId },
              include: { business: true },
            },
          },
        });
        if (!user) return null;

        const valid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!valid) return null;

        const membership = user.memberships[0];
        if (!membership) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          businessId: membership.businessId,
          businessName: membership.business.name,
          role: membership.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.businessId = (user as any).businessId;
        token.businessName = (user as any).businessName;
        token.role = (user as any).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.sub;
        (session.user as any).businessId = token.businessId;
        (session.user as any).businessName = token.businessName;
        (session.user as any).role = token.role;
      }
      return session;
    },
  },
};
