"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { Currency } from "@prisma/client";
import { readFormText } from "@/lib/form-data";

function slugify(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function uniqueSlug(name: string) {
  const base = slugify(name) || "business";
  let slug = base;
  let n = 1;
  while (await prisma.business.findUnique({ where: { slug } })) {
    n += 1;
    slug = `${base}-${n}`;
  }
  return slug;
}

const TRIAL_DAYS = 30;

export async function signUp(formData: FormData) {
  const businessName = readFormText(formData, "businessName", "Business name", { required: true, maxLength: 120 });
  const ownerName = readFormText(formData, "ownerName", "Owner name", { required: true, maxLength: 120 });
  const email = readFormText(formData, "email", "Email", { required: true, maxLength: 254 }).toLowerCase();
  const password = formData.get("password");
  if (typeof password !== "string" || password.length < 8 || password.length > 1024) {
    throw new Error("Password must be between 8 and 1024 characters");
  }
  const currencyValue = readFormText(formData, "baseCurrency", "Base currency") || "USD";
  if (!Object.values(Currency).includes(currencyValue as Currency)) {
    throw new Error("Choose a valid base currency");
  }
  const baseCurrency = currencyValue as Currency;

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid email address");

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new Error("An account with that email already exists. Try logging in instead.");
  }

  const slug = await uniqueSlug(businessName);
  const passwordHash = await bcrypt.hash(password, 10);
  const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000);

  await prisma.business.create({
    data: {
      name: businessName,
      slug,
      baseCurrency,
      trialEndsAt,
      financialAccounts: {
        create: {
          name: "Cash",
          type: "CASH",
          openingBalance: 0,
          openingDate: new Date("1970-01-01T00:00:00.000Z"),
        },
      },
      memberships: {
        create: {
          role: "OWNER",
          user: {
            create: { name: ownerName, email, passwordHash },
          },
        },
      },
    },
  });

  redirect("/login?registered=1");
}
