import { asc } from "drizzle-orm";
import { changeUserStatus, updateFeatureFlag, updateSystemSetting } from "@/app/admin/actions";
import { getDb } from "@/db/connection";
import { featureFlags, systemSettings, users } from "@/db/schema";

export async function AdminSectionActions({ section }: Readonly<{ section: string }>) {
  if (section === "feature-flags") {
    const flags = await getDb().select().from(featureFlags).orderBy(asc(featureFlags.key));
    return <form className="workspace-action-card" action={updateFeatureFlag}><h3>Controlled feature rollout</h3><div className="compact-form-grid"><label><span>Feature</span><select name="key" required>{flags.map((flag) => <option key={flag.key} value={flag.key}>{flag.key} · {flag.enabled ? "enabled" : "disabled"}</option>)}</select></label><label><span>Rollout percentage</span><input name="rolloutPercentage" type="number" min="0" max="100" defaultValue="100" required /></label><label className="filter-check"><input name="enabled" type="checkbox" /><span>Enable feature</span></label><label className="wide"><span>Mandatory reason</span><textarea name="reason" required minLength={5} /></label></div><button className="button button-small" type="submit">Update feature flag</button></form>;
  }
  if (["commission-settings", "payment-settings", "notification-integrations", "email-settings", "whatsapp-settings", "data-retention"].includes(section)) {
    const settings = await getDb().select().from(systemSettings).orderBy(asc(systemSettings.key));
    return <form className="workspace-action-card" action={updateSystemSetting}><h3>Update versioned policy setting</h3><div className="compact-form-grid"><label><span>Setting</span><select name="key" required>{settings.map((setting) => <option key={setting.key} value={setting.key}>{setting.key}</option>)}</select></label><label><span>JSON value</span><input name="value" required placeholder="720 or false or &quot;text&quot;" /></label><label className="wide"><span>Mandatory reason</span><textarea name="reason" required minLength={5} /></label></div><button className="button button-small" type="submit">Save versioned setting</button></form>;
  }
  if (section === "users" || section === "restrictions") {
    const userRows = await getDb().select({ id: users.id, name: users.fullName, email: users.primaryEmail, status: users.status }).from(users).orderBy(asc(users.fullName));
    return <form className="workspace-action-card" action={changeUserStatus}><h3>Change account status</h3><div className="compact-form-grid"><label><span>User</span><select name="userId" required>{userRows.map((user) => <option key={user.id} value={user.id}>{user.name} · {user.email} · {user.status}</option>)}</select></label><label><span>Status</span><select name="status"><option>ACTIVE</option><option>RESTRICTED</option><option>SUSPENDED</option></select></label><label className="wide"><span>Mandatory reason</span><textarea name="reason" required minLength={10} /></label></div><button className="button button-small" type="submit">Update protected account</button></form>;
  }
  return null;
}
