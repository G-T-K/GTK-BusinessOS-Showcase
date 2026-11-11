"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getPermissionContext } from "@/lib/permissions";
import { readFormText } from "@/lib/form-data";
import { normalizeWebsiteUrl } from "@/lib/website-url";
import {
  MAX_BUSINESS_LOGO_BYTES,
  optimizeBusinessLogo,
  LogoInputError,
} from "@/lib/business-logo";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export type BusinessProfileActionState = {
  success: boolean;
  error: string | null;
  message: string | null;
};

function failure(error: string): BusinessProfileActionState {
  return { success: false, error, message: null };
}

export async function updateBusinessProfile(formData: FormData): Promise<BusinessProfileActionState> {
  try {
    const permission = await getPermissionContext("settings");
    if (!permission.allowed) {
      return failure(
        permission.status === 401
          ? "Your session has expired. Sign in again to update your business profile."
          : "You do not have permission to update this business profile.",
      );
    }

    const { businessId } = permission.context;
    let name: string;
    let address: string;
    let phone: string;
    let email: string;
    let websiteValue: string;
    try {
      name = readFormText(formData, "name", "Business name", { required: true, maxLength: 120 });
      address = readFormText(formData, "address", "Address", { maxLength: 500 });
      phone = readFormText(formData, "phone", "Phone number", { maxLength: 40 });
      email = readFormText(formData, "email", "Email", { maxLength: 254 });
      websiteValue = readFormText(formData, "website", "Website", { maxLength: 200 });
    } catch (error) {
      if (error instanceof Error) return failure(error.message);
      throw error;
    }

    const removeLogoValue = formData.get("removeLogo");
    if (removeLogoValue !== null && removeLogoValue !== "on") {
      return failure("The logo removal selection is invalid.");
    }
    const removeLogo = removeLogoValue === "on";
    const logoFile = formData.get("logo");

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return failure("Enter a valid business email address.");
    }

    const websiteResult = normalizeWebsiteUrl(websiteValue);
    if (websiteResult.error) return failure(websiteResult.error);
    const website = websiteResult.value;

    let logo: Buffer | null | undefined;
    let logoMimeType: string | null | undefined;

    if (logoFile !== null && !(logoFile instanceof File)) {
      return failure("Upload a PNG or JPEG logo file.");
    }

    if (logoFile instanceof File && logoFile.size > 0) {
      if (logoFile.size > MAX_UPLOAD_BYTES) {
        return failure("Choose a logo of 10 MB or less so it can be processed safely.");
      }

      const extension = logoFile.name.toLowerCase().split(".").pop();
      const allowedExtensions = ["png", "jpg", "jpeg"];
      const expectedMimeType = extension === "png" ? "image/png" : "image/jpeg";
      if (!allowedExtensions.includes(extension ?? "") || (logoFile.type && logoFile.type !== expectedMimeType)) {
        return failure("Upload a PNG, JPG, or JPEG logo file.");
      }

      const optimizedLogo = await optimizeBusinessLogo(Buffer.from(await logoFile.arrayBuffer()));
      if (optimizedLogo.mimeType !== expectedMimeType) {
        return failure("The selected file type does not match the image contents.");
      }
      if (optimizedLogo.bytes.byteLength > MAX_BUSINESS_LOGO_BYTES) {
        return failure("This logo could not be optimized to 512 KB. Try a simpler or smaller image.");
      }
      logo = optimizedLogo.bytes;
      logoMimeType = optimizedLogo.mimeType;
    }

    if (removeLogo && !(logoFile instanceof File && logoFile.size > 0)) {
      logo = null;
      logoMimeType = null;
    }

    await prisma.business.update({
      where: { id: businessId },
      data: {
        name,
        address: address || null,
        phone: phone || null,
        email: email || null,
        website,
        logo,
        logoMimeType,
      },
    });

    revalidatePath("/settings/business");
    revalidatePath("/sales/quotations", "layout");
    revalidatePath("/sales/invoices", "layout");
    return { success: true, error: null, message: "Business profile saved." };
  } catch (error) {
    if (error instanceof LogoInputError) return failure(error.message);
    console.error("Business profile update failed", error);
    return failure("We couldn't save your business profile. Please try again.");
  }
}
