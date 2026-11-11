import { PrismaClient, Role, Currency } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to seed demo data in production.");
  }

  const seedPassword = process.env.SEED_OWNER_PASSWORD;
  if (!seedPassword) {
    throw new Error("Set SEED_OWNER_PASSWORD before running the demo seed.");
  }

  const passwordHash = await bcrypt.hash(seedPassword, 10);

  const business = await prisma.business.create({
    data: {
      name: "Example Hardware",
      slug: "example-hardware",
      baseCurrency: Currency.USD,
    },
  });

  const owner = await prisma.user.create({
    data: {
      email: "owner@example.test",
      name: "Demo Owner",
      passwordHash,
      memberships: {
        create: {
          businessId: business.id,
          role: Role.OWNER,
        },
      },
    },
  });

  const category = await prisma.productCategory.create({
    data: { businessId: business.id, name: "Electronics" },
  });

  await prisma.product.createMany({
    data: [
      {
        businessId: business.id,
        categoryId: category.id,
        name: "Android Smartphone",
        sku: "DEMO-PHONE-01",
        costPrice: 380,
        sellingPrice: 450,
        quantityOnHand: 18,
        reorderLevel: 5,
      },
      {
        businessId: business.id,
        categoryId: category.id,
        name: "Printer Toner",
        sku: "DEMO-TONER-01",
        costPrice: 40,
        sellingPrice: 65,
        quantityOnHand: 3,
        reorderLevel: 5,
      },
    ],
  });

  await prisma.customer.create({
    data: {
      businessId: business.id,
      name: "Demo Customer",
    },
  });

  console.log(`Seeded business "${business.name}" with owner login: ${owner.email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
