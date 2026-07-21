import Image from "next/image";
import Link from "next/link";

export type WorkspaceSection = Readonly<{ slug: string; label: string }>;

export function WorkspaceScaffold({
  title,
  eyebrow,
  rootPath,
  activeSection,
  sections,
  summary,
  children,
}: Readonly<{
  title: string;
  eyebrow: string;
  rootPath: string;
  activeSection: string;
  sections: readonly WorkspaceSection[];
  summary: readonly { label: string; value: string }[];
  children?: React.ReactNode;
}>) {
  const current = sections.find((section) => section.slug === activeSection) ?? sections[0];
  return (
    <div className="workspace-shell">
      <aside className="workspace-sidebar">
        <Link className="brand workspace-brand" href="/"><Image src="/coastbookings-logo.svg" width={42} height={42} alt="" /><span>Coast <strong>Bookings</strong></span></Link>
        <div className="workspace-identity"><small>{eyebrow}</small><strong>{title}</strong></div>
        <nav aria-label={`${title} navigation`}>{sections.map((section) => <Link className={section.slug === current.slug ? "active" : ""} key={section.slug} href={`${rootPath}/${section.slug}`}>{section.label}</Link>)}</nav>
        <Link className="workspace-exit" href="/auth/continue">Switch workspace</Link>
      </aside>
      <main className="workspace-main">
        <header className="workspace-header"><div><span className="section-kicker">{eyebrow}</span><h1>{current.label}</h1></div><div className="security-chip">Server protected</div></header>
        <section className="workspace-stats">{summary.map((item) => <article key={item.label}><span>{item.label}</span><strong>{item.value}</strong></article>)}</section>
        <section className="workspace-panel">
          <div className="workspace-panel-heading"><div><h2>{current.label}</h2><p>Data on this screen is scoped by the authenticated user and active organization.</p></div><span>Live workspace</span></div>
          {children ?? <div className="workspace-empty"><strong>No records require attention.</strong><p>New activity will appear here after it has passed server-side authorization.</p></div>}
        </section>
      </main>
    </div>
  );
}
