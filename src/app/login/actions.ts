"use server";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export type LoginBusinessesResult =
  | { status: "ok"; businesses: { id: string; name: string; role: string }[] }
  | { status: "invalid" }
  | { status: "unavailable" };

export async function getLoginBusinesses(emailInput: string, passwordInput: string): Promise<LoginBusinessesResult> {
  if (
    typeof emailInput !== "string" ||
    typeof passwordInput !== "string" ||
    emailInput.length > 254 ||
    passwordInput.length > 1024
  ) {
    return { status: "invalid" };
  }
  const email = emailInput.trim().toLowerCase();
  const password = passwordInput;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password) return { status: "invalid" };

  let user;
  try {
    user = await prisma.user.findUnique({
      where: { email },
      select: {
        passwordHash: true,
        memberships: {
          where: { active: true },
          select: {
            businessId: true,
            role: true,
            business: { select: { name: true } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });
  } catch (error) {
    if (error instanceof Error && error.name === "PrismaClientInitializationError") {
      return { status: "unavailable" };
    }
    throw error;
  }
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return { status: "invalid" };
  }

  return {
    status: "ok",
    businesses: user.memberships.map(({ businessId, business, role }) => ({
      id: businessId,
      name: business.name,
      role,
    })),
  };
}
