import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AdminWorkspace, ADMIN_SECTIONS } from "@/components/internal/admin-workspace";
import { OperationsWorkspace, OPERATIONS_SECTIONS } from "@/components/internal/operations-workspace";
import { GuestWorkspace, GUEST_SECTIONS } from "@/components/workspaces/guest-workspace";
import { HostWorkspace, HOST_SECTIONS } from "@/components/workspaces/host-workspace";

const summary = [
  { label: "Open items", value: "3" },
  { label: "Status", value: "Ready" },
] as const;

function verifyWorkspace(markup: string, rootPath: string, sections: readonly { slug: string; label: string }[]) {
  expect(markup).toContain("Server protected");
  expect(markup).toContain("Live workspace");
  for (const section of sections) {
    expect(markup).toContain(`href="${rootPath}/${section.slug}"`);
    expect(markup).toContain(section.label);
  }
}

describe("role workspaces", () => {
  it("server-renders every guest feature and navigation link", () => {
    const markup = renderToStaticMarkup(<GuestWorkspace section="dashboard" summary={summary} />);
    verifyWorkspace(markup, "/guest", GUEST_SECTIONS);
  });

  it("server-renders every host feature and navigation link", () => {
    const markup = renderToStaticMarkup(<HostWorkspace section="reservations" summary={summary} />);
    verifyWorkspace(markup, "/host", HOST_SECTIONS);
  });

  it("server-renders every operations feature and navigation link", () => {
    const markup = renderToStaticMarkup(<OperationsWorkspace section="payments" summary={summary} />);
    verifyWorkspace(markup, "/staff", OPERATIONS_SECTIONS);
  });

  it("server-renders every administration feature and navigation link", () => {
    const markup = renderToStaticMarkup(<AdminWorkspace section="roles" />);
    verifyWorkspace(markup, "/admin", ADMIN_SECTIONS);
  });
});
