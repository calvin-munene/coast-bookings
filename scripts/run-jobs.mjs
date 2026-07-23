const appUrl = process.env.NEXT_PUBLIC_APP_URL;
const secret = process.env.CRON_SHARED_SECRET;
if (!appUrl || !secret) throw new Error("NEXT_PUBLIC_APP_URL and CRON_SHARED_SECRET are required");
const response = await fetch(new URL("/api/jobs/run", appUrl), { method: "POST", headers: { Authorization: `Bearer ${secret}` } });
const body = await response.text();
if (!response.ok) throw new Error(`Coast Bookings jobs failed (${response.status}): ${body}`);
console.log(body);
