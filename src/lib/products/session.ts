import type { ResponseCookie } from "next/dist/compiled/@edge-runtime/cookies";
import {
  PRODUCT_ACCESS_COOKIE,
  productAccessCookieValue,
} from "@/lib/products/entitlements";
import type { ProductKey, UserProductAccess } from "@/lib/products/types";
import { appProductKeyToPrisma } from "@/lib/products/paths";
import { getPrisma } from "@/lib/db";

function productCookieOptions(): Partial<ResponseCookie> {
  return {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
  };
}

export function applyProductAccessCookie(
  res: { cookies: { set: (name: string, value: string, options?: Partial<ResponseCookie>) => void } },
  access: UserProductAccess,
) {
  res.cookies.set(PRODUCT_ACCESS_COOKIE, productAccessCookieValue(access), productCookieOptions());
}

/** Persist last active product for multi-product login routing. */
export async function updateLastActiveProduct(
  userId: string,
  product: ProductKey,
): Promise<void> {
  const prisma = getPrisma();
  await prisma.user.update({
    where: { id: userId },
    data: { lastActiveProduct: appProductKeyToPrisma(product) },
  });
}

/** Persist signup source / product intent. */
export async function updateProductIntent(
  userId: string,
  product: ProductKey,
): Promise<void> {
  const prisma = getPrisma();
  await prisma.user.update({
    where: { id: userId },
    data: { productIntent: appProductKeyToPrisma(product) },
  });
}
