import Link from "next/link";
import type { WorkspaceSectionData } from "@/modules/workspaces/section-repository";

export function WorkspaceRecords({ data, children }: Readonly<{ data?: WorkspaceSectionData; children?: React.ReactNode }>) {
  if (!data) return <div className="workspace-empty"><strong>No records require attention.</strong><p>New activity will appear here after it has passed server-side authorization.</p></div>;
  return <div className="workspace-record-content"><p className="workspace-description">{data.description}</p>{children}{data.records.length > 0 ? <div className="workspace-record-list">{data.records.map((record) => {
    const content = <><div><strong>{record.title}</strong><p>{record.detail}</p></div><div className="record-meta"><span className="record-status">{record.status.replaceAll("_", " ")}</span>{record.metric && <strong>{record.metric}</strong>}</div></>;
    return record.href ? <Link className="workspace-record" href={record.href} key={record.id}>{content}</Link> : <article className="workspace-record" key={record.id}>{content}</article>;
  })}</div> : <div className="workspace-empty"><strong>{data.emptyTitle}</strong><p>{data.emptyCopy}</p></div>}</div>;
}
