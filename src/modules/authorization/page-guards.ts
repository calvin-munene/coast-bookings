import "server-only";
import { redirect } from "next/navigation";
import { AccountRestrictedError, ForbiddenError, OrganizationContextRequiredError, UnauthenticatedError } from "./errors";

export async function guardPage<T>(check: () => Promise<T>): Promise<T> {
  try {
    return await check();
  } catch (error) {
    if (error instanceof UnauthenticatedError) redirect("/sign-in");
    if (error instanceof AccountRestrictedError) redirect("/account-restricted");
    if (error instanceof OrganizationContextRequiredError) redirect("/auth/continue");
    if (error instanceof ForbiddenError) redirect("/account-restricted");
    throw error;
  }
}
