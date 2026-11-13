// Polls foreverstatus.com for EU rulesets, keeps one status message updated via a Discord webhook
// and posts a separate message whenever a ruleset changes state.
const { WEBHOOK_URL, STATUS_MESSAGE_ID } = process.env;
if (!WEBHOOK_URL || !STATUS_MESSAGE_ID) throw new Error("WEBHOOK_URL and STATUS_MESSAGE_ID are required");

const REGION = "eu";
const msgUrl = `${WEBHOOK_URL}/messages/${STATUS_MESSAGE_ID}`;

const res = await fetch("https://foreverstatus.com/api/status");
if (!res.ok) throw new Error(`status source returned ${res.status}`);
const data = await res.json();
const region = data.regions.find((r) => r.region === REGION);
// Source could not reach Blizzard: do not report that as an outage.
if (!region || !region.ok) throw new Error("status source has no valid EU data");

const current = Object.fromEntries(region.rulesets.map((r) => [r.name, r.online]));

const prevRes = await fetch(msgUrl);
if (!prevRes.ok) throw new Error(`could not read status message: ${prevRes.status}`);
const prevMsg = await prevRes.json();
let previous = {};
try { previous = JSON.parse(prevMsg.embeds?.[0]?.footer?.text ?? "{}"); } catch {}

const icon = (up) => (up ? "🟢" : "🔴");
const allUp = Object.values(current).every(Boolean);
const lines = Object.entries(current).map(([n, up]) => `${icon(up)} **${n}** – ${up ? "Online" : "Offline"}`);

const embed = {
  title: "WoW Forever EU – Server Status",
  description: lines.join("\n") + `\n\nLast checked: <t:${Math.floor(Date.now() / 1000)}:R>`,
  color: allUp ? 0x57f287 : 0xed4245,
  footer: { text: JSON.stringify(current) },
};

const changes = Object.entries(current).filter(([n, up]) => n in previous && previous[n] !== up);

const patch = await fetch(msgUrl, {
  method: "PATCH",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ embeds: [embed] }),
});
if (!patch.ok) throw new Error(`status update failed: ${patch.status} ${await patch.text()}`);

if (changes.length) {
  const text = changes
    .map(([n, up]) => `${icon(up)} **WoW Forever EU ${n}** is now **${up ? "ONLINE" : "OFFLINE"}**`)
    .join("\n");
  const post = await fetch(WEBHOOK_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ content: text }),
  });
  if (!post.ok) throw new Error(`change post failed: ${post.status} ${await post.text()}`);
}
console.log(JSON.stringify({ current, changes }));
