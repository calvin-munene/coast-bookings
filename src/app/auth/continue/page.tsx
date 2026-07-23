import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { findUserByClerkId, listActiveMemberships } from "@/modules/authorization/repository";
import { WorkspaceChooser, type WorkspaceOption } from "@/components/workspace-chooser";

export const dynamic = "force-dynamic";

export default async function ContinuePage({ searchParams }: Readonly<{ searchParams: Promise<{ activate?: string }> }>) {
  const session = await auth();
  if (!session.userId) redirect("/sign-in");
  const user = await findUserByClerkId(session.userId);
  if (!user) redirect("/onboarding");
  if (user.status !== "ACTIVE") redirect("/account-restricted");
  const memberships = await listActiveMemberships(user.id);
  if (session.orgId) {
    const active = memberships.find((membership) => membership.clerkOrganizationId === session.orgId);
    if (active?.organizationType === "INTERNAL") redirect("/staff/dashboard");
    if (active?.organizationType === "HOST") redirect("/host/dashboard");
  }
  if (memberships.length === 0) redirect("/guest/dashboard");
  const options: WorkspaceOption[] = memberships.map((membership) => ({
    clerkOrganizationId: membership.clerkOrganizationId,
    label: membership.organizationType === "INTERNAL" ? "Coast Bookings Operations" : "Host workspace",
    destination: membership.organizationType === "INTERNAL" ? "/staff/dashboard" : "/host/dashboard",
  }));
  const { activate } = await searchParams;
  return <section className="auth-shell"><div className="form-card"><span className="section-kicker">Choose workspace</span><h1>Where are you working today?</h1><p>Your active Clerk organization determines the tenant scope for every server request.</p><WorkspaceChooser options={options} autoActivate={activate} /></div></section>;
}
