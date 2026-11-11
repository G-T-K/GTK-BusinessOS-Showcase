"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";
import { logAction } from "@/lib/audit";
import { requirePermission } from "@/lib/permissions";
import { readFormText } from "@/lib/form-data";

function readRole(formData: FormData) {
  const value = readFormText(formData, "role", "Role", { required: true });
  if (!Object.values(Role).includes(value as Role)) throw new Error("Choose a valid user role");
  return value as Role;
}

async function requireOwner() {
  const { businessId, userId: actingUserId } = await requirePermission("settings");
  return { businessId, actingUserId };
}

// Adds a user to the business. If the email doesn't exist yet, creates the
// account with the given password; if it does, just adds a membership (so one
// person can belong to more than one business, e.g. a shared bookkeeper).
export async function addUser(formData: FormData) {
  const { businessId, actingUserId } = await requireOwner();

  const name = readFormText(formData, "name", "Name", { maxLength: 120 });
  const email = readFormText(formData, "email", "Email", { required: true, maxLength: 254 }).toLowerCase();
  const passwordValue = formData.get("password");
  if (passwordValue !== null && typeof passwordValue !== "string") throw new Error("Enter a valid password");
  const password = typeof passwordValue === "string" ? passwordValue : "";
  if (password.length > 1024) throw new Error("Enter a valid password");
  const role = readRole(formData);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid email address");

  let user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    if (!name || !password || password.length < 8) {
      throw new Error("Name and an 8+ character password are required for a new user");
    }
    const passwordHash = await bcrypt.hash(password, 10);
    user = await prisma.user.create({ data: { name, email, passwordHash } });
  }

  const membership = await prisma.membership.upsert({
    where: { userId_businessId: { userId: user.id, businessId } },
    update: { role, active: true },
    create: { userId: user.id, businessId, role },
  });

  await logAction({
    businessId,
    userId: actingUserId,
    action: "user.added",
    entityType: "Membership",
    entityId: membership.id,
    metadata: { email, role },
  });

  revalidatePath("/settings/users");
  redirect("/settings/users");
}

export async function updateUserRole(formData: FormData) {
  const { businessId, actingUserId } = await requireOwner();
  const membershipId = readFormText(formData, "membershipId", "Membership", { required: true, maxLength: 64 });
  const role = readRole(formData);

  const membership = await prisma.membership.findFirst({ where: { id: membershipId, businessId } });
  if (!membership) throw new Error("Membership not found");

  await prisma.membership.update({ where: { id: membershipId }, data: { role } });

  await logAction({
    businessId,
    userId: actingUserId,
    action: "user.role_changed",
    entityType: "Membership",
    entityId: membershipId,
    metadata: { from: membership.role, to: role },
  });

  revalidatePath("/settings/users");
}

export async function removeUser(formData: FormData) {
  const { businessId, actingUserId } = await requireOwner();
  const membershipId = readFormText(formData, "membershipId", "Membership", { required: true, maxLength: 64 });

  const membership = await prisma.membership.findFirst({ where: { id: membershipId, businessId } });
  if (!membership) throw new Error("Membership not found");
  if (membership.role === "OWNER") throw new Error("Cannot remove the Owner");

  await prisma.membership.update({ where: { id: membershipId }, data: { active: false } });

  await logAction({
    businessId,
    userId: actingUserId,
    action: "user.removed",
    entityType: "Membership",
    entityId: membershipId,
  });

  revalidatePath("/settings/users");
}
