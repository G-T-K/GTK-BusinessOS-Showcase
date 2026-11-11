"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { readFormNumber, readFormText } from "@/lib/form-data";

async function requireBusinessId() {
  return (await requirePermission("inventory")).businessId;
}

export async function createProduct(formData: FormData) {
  const businessId = await requireBusinessId();

  const name = readFormText(formData, "name", "Product name", { required: true, maxLength: 120 });
  const sku = readFormText(formData, "sku", "SKU", { maxLength: 80 }) || null;
  const costPrice = readFormNumber(formData, "costPrice", "Cost price", { min: 0, max: 9_000_000_000_000_000, decimalPlaces: 2 });
  const sellingPrice = readFormNumber(formData, "sellingPrice", "Selling price", { min: 0, max: 9_000_000_000_000_000, decimalPlaces: 2 });
  const quantityOnHand = readFormNumber(formData, "quantityOnHand", "Quantity on hand", { min: 0, max: 1_000_000_000_000, decimalPlaces: 3 });
  const reorderLevel = readFormNumber(formData, "reorderLevel", "Reorder level", { min: 0, max: 1_000_000_000_000, decimalPlaces: 3 });
  const unit = readFormText(formData, "unit", "Unit", { maxLength: 40 }) || "unit";

  await prisma.$transaction(async (tx) => {
    const product = await tx.product.create({
      data: {
        businessId,
        name,
        sku,
        costPrice,
        sellingPrice,
        quantityOnHand,
        reorderLevel,
        unit,
      },
    });

    if (quantityOnHand > 0) {
      await tx.stockMovement.create({
        data: {
          businessId,
          productId: product.id,
          type: "ADJUSTMENT_IN",
          quantity: quantityOnHand,
          note: "Opening stock",
        },
      });
    }
  });

  revalidatePath("/inventory");
  redirect("/inventory");
}

// Manual stock adjustment (e.g. stock count correction, damage, restock outside a purchase).
export async function adjustStock(formData: FormData) {
  const businessId = await requireBusinessId();

  const productId = readFormText(formData, "productId", "Product", { required: true, maxLength: 64 });
  const direction = readFormText(formData, "direction", "Direction", { required: true });
  if (direction !== "IN" && direction !== "OUT") throw new Error("Choose a valid stock adjustment direction");
  const quantity = readFormNumber(formData, "quantity", "Quantity", {
    min: 0.001,
    max: 1_000_000_000_000,
    decimalPlaces: 3,
  });
  const note = readFormText(formData, "note", "Note", { maxLength: 300 }) || null;

  await prisma.$transaction(async (tx) => {
    const productUpdate = await tx.product.updateMany({
      where: {
        id: productId,
        businessId,
        active: true,
        ...(direction === "OUT" ? { quantityOnHand: { gte: quantity } } : {}),
      },
      data: {
        quantityOnHand:
          direction === "IN" ? { increment: quantity } : { decrement: quantity },
      },
    });
    if (productUpdate.count !== 1) {
      throw new Error(direction === "OUT" ? "Insufficient stock for this adjustment" : "Product not found");
    }

    await tx.stockMovement.create({
      data: {
        businessId,
        productId,
        type: direction === "IN" ? "ADJUSTMENT_IN" : "ADJUSTMENT_OUT",
        quantity,
        note,
      },
    });

  });

  revalidatePath("/inventory");
}
