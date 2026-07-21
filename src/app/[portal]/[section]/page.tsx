import Link from "next/link";
import { notFound } from "next/navigation";
import { dashboardStats, reservations } from "@/data/demo";
import { StatusPill } from "@/components/status-pill";

const portalConfig = {
  guest: { title: "Good afternoon, Amina", subtitle: "Your coastal trips, payments and messages in one place.", sections: ["dashboard", "bookings", "favourites", "messages", "payments", "profile"] },
  host: { title: "Ocean Breeze overview", subtitle: "Today’s reservations and the health of your properties.", sections: ["dashboard", "properties", "calendar", "pricing", "reservations", "messages", "earnings", "payouts", "verification"] },
  staff: { title: "Operations centre", subtitle: "Group enquiries, reservations and host response queues.", sections: ["dashboard", "enquiries", "quotations", "bookings", "hosts", "properties", "finance", "support", "reports"] },
  admin: { title: "Marketplace control", subtitle: "Permissions, finance, verification and platform health.", sections: ["dashboard", "users", "roles", "settings", "audit", "integrations", "system-health"] },
} as const;

type PortalKey = keyof typeof portalConfig;
type PageProps = { params: Promise<{ portal: string; section: string }> };

function titleCase(value: string) { return value.replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }

export default async function PortalPage({ params }: PageProps) {
  const { portal: rawPortal, section } = await params;
  if (!(rawPortal in portalConfig)) notFound();
  const portal = rawPortal as PortalKey;
  const config = portalConfig[portal];
  if (!(config.sections as readonly string[]).includes(section)) notFound();
  const isDashboard = section === "dashboard";
  return <section className="dashboard-page"><div className="shell">
    <div className="dashboard-top"><div><span className="section-kicker">{titleCase(portal)} portal · demo workspace</span><h1>{isDashboard ? config.title : titleCase(section)}</h1><p>{isDashboard ? config.subtitle : `${titleCase(section)} tools are wired to the same permissions-first application shell.`}</p></div><div className="portal-switcher">{Object.keys(portalConfig).map((item) => <Link className={item === portal ? "active" : ""} href={`/${item}/dashboard`} key={item}>{titleCase(item)}</Link>)}</div></div>
    <div className="dashboard-grid"><nav className="side-nav">{config.sections.map((item) => <Link className={item === section ? "active" : ""} href={`/${portal}/${item}`} key={item}>{titleCase(item)}</Link>)}</nav><div className="dashboard-content">
      {isDashboard && <div className="stats-grid">{dashboardStats[portal].map(([label, value]) => <article className="stat-card" key={label}><span>{label}</span><strong>{value}</strong></article>)}</div>}
      <section className="panel"><div className="panel-heading"><h2>{isDashboard ? "Reservation activity" : `${titleCase(section)} workspace`}</h2><Link href={`/${portal}/${section}`}>Export CSV</Link></div>
        {isDashboard ? <table className="data-table"><thead><tr><th>Reference</th><th>Guest</th><th>Stay</th><th>Dates</th><th>Total</th><th>Status</th></tr></thead><tbody>{reservations.map((row) => <tr key={row.reference}><td><strong>{row.reference}</strong></td><td>{row.guest}</td><td>{row.stay}</td><td>{row.dates}</td><td>{row.total}</td><td><StatusPill>{row.status}</StatusPill></td></tr>)}</tbody></table> : <div style={{ padding: 28 }}><h3 style={{ color: "var(--navy)", marginTop: 0 }}>Production-ready module boundary</h3><p style={{ color: "var(--muted)", lineHeight: 1.7 }}>This surface is prepared for Supabase-backed records, Zod-validated actions, audit logging and role-specific controls. Demo rows are intentionally separated from transaction logic.</p><div className="filter-row"><button className="button">Create record</button><button className="filter-chip">View activity</button><button className="filter-chip">Manage filters</button></div></div>}
      </section>
    </div></div>
  </div></section>;
}
