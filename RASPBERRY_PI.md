# CloudClever POS — Raspberry Pi Hub Runbook (v1.0)

**Audience:** Field techs, DevOps, store admins
**Scope:** Retail + Restaurant (KDS/BDS) • Online + **True Offline** (LAN)
**Hub Role:** LAN realtime relay + local event spool + cloud bridge for both Web and Native apps

---

## 1) Overview

Each store runs a **Local Hub** (Node + Socket.io in Docker). Clients (web + native) discover the Hub on the same Wi-Fi via **mDNS** and exchange **append-only events** (order create/park/re-park/pay, KDS/BDS, etc.).

* **Offline:** Hub rebroadcasts on LAN and stores events locally; apps keep working.
* **Online:** Hub continues LAN realtime and **bridges** events to the cloud API; it also pulls cloud events and rebroadcasts.

**Multi-tenancy:** Strict per-store **realm** `{tenantId, storeId}` validated via **Cluster Tokens (JWT)** signed by your cloud.
**Discovery:** `_poshub._tcp` is advertised by the Hub (mDNS).

---

## 2) Prerequisites

* Raspberry Pi 4/5 (4GB+), 16GB+ microSD (or SSD), stable power (prefer a small UPS)
* Raspberry Pi OS **64-bit Lite** (or Ubuntu Server for Pi)
* LAN with DHCP; Hub ideally on **Ethernet**; clients on same subnet
* Hub container image published (e.g., `ghcr.io/yourorg/pos-hub:1.0.0`)
* Per-store config: `TENANT_ID`, `STORE_ID`, Cluster public key, optional cloud bridge token

---

## 3) Quick Start (Interactive Bootstrap)

SSH into the Pi and paste the following one-shot script. It installs Docker & mDNS, prompts for a **claim code** (e.g., `t-abc:s-001`), writes config, and starts the Hub with **Watchtower** for auto-updates.

```bash
sudo -s <<'EOS'
set -euo pipefail
apt-get update
apt-get install -y avahi-daemon curl jq ca-certificates docker-compose-plugin
curl -fsSL https://get.docker.com | sh
systemctl enable --now docker avahi-daemon

mkdir -p /opt/pos-hub && cd /opt/pos-hub
read -p "Enter claim code (e.g., t-abc:s-001): " CLAIM
TENANT_ID=$(echo "$CLAIM" | cut -d: -f1)
STORE_ID=$(echo "$CLAIM" | cut -d: -f2)

cat >.env <<EOF
TENANT_ID=${TENANT_ID}
STORE_ID=${STORE_ID}
PORT=4001
IMAGE_REF=ghcr.io/yourorg/pos-hub:stable
CLUSTER_PUBLIC_KEY_BASE64=REPLACE_ME
CLOUD_BRIDGE_URL=https://api.example.com/events/ingest
CLOUD_BRIDGE_TOKEN=REPLACE_ME
UPDATE_CHANNEL=stable
EOF

cat >/etc/avahi/services/poshub.service <<EOF
<?xml version="1.0" standalone='no'?>
<!DOCTYPE service-group SYSTEM "avahi-service.dtd">
<service-group>
  <name replace-wildcards="yes">POS Hub - %h (${STORE_ID}/${TENANT_ID})</name>
  <service>
    <type>_poshub._tcp</type>
    <port>4001</port>
    <txt-record>storeId=${STORE_ID}</txt-record>
    <txt-record>tenantId=${TENANT_ID}</txt-record>
    <txt-record>version=1</txt-record>
  </service>
</service-group>
EOF
systemctl restart avahi-daemon

cat >docker-compose.yml <<'EOF'
services:
  hub:
    image: ${IMAGE_REF}
    restart: unless-stopped
    env_file: .env
    ports: ["${PORT}:${PORT}"]
    volumes: ["./data:/data"]
    healthcheck:
      test: ["CMD", "curl", "-fsS", "http://localhost:${PORT}/healthz"]
      interval: 30s
      timeout: 5s
      retries: 5
      start_period: 20s
    labels:
      - "com.centurylinklabs.watchtower.enable=true"
      - "cc.update.channel=${UPDATE_CHANNEL}"
  watchtower:
    image: containrrr/watchtower
    restart: unless-stopped
    volumes: ["/var/run/docker.sock:/var/run/docker.sock"]
    command: --label-enable --cleanup --interval 3600
EOF

cat >/etc/systemd/system/pos-hub.service <<'EOF'
[Unit]
Description=CloudClever POS Hub
After=network-online.target docker.service
Requires=docker.service
[Service]
Type=oneshot
WorkingDirectory=/opt/pos-hub
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down
RemainAfterExit=yes
[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable pos-hub
docker compose pull
docker compose up -d
EOS
```

**After it starts**

* Hub listens on **:4001** and advertises **`_poshub._tcp`** on the LAN.
* Web/Native clients **auto-discover** (or you can enter the Hub IP manually).

---

## 4) Files & Layout

All Hub files live under **`/opt/pos-hub/`**:

```
.env                   # Per-store realm & secrets (TENANT_ID, STORE_ID, PORT, CLUSTER_PUBLIC_KEY_BASE64, ...)
docker-compose.yml     # Hub + Watchtower services
data/                  # SQLite event log & cursors (volume)
/etc/systemd/system/pos-hub.service
/etc/avahi/services/poshub.service
```

**`.env` example**

```env
TENANT_ID=t-abc
STORE_ID=s-001
PORT=4001
IMAGE_REF=ghcr.io/yourorg/pos-hub:stable
CLUSTER_PUBLIC_KEY_BASE64=BASE64_PEM_HERE
CLOUD_BRIDGE_URL=https://api.example.com/events/ingest
CLOUD_BRIDGE_TOKEN=YOUR_TOKEN
UPDATE_CHANNEL=stable
```

---

## 5) Everyday Operations

### Start / Stop / Restart

```bash
# Start at boot (already enabled by systemd)
sudo systemctl enable pos-hub

# Manual control
sudo systemctl start pos-hub
sudo systemctl stop pos-hub
sudo systemctl restart pos-hub

# Or via Docker Compose directly
cd /opt/pos-hub
docker compose up -d
docker compose down
docker compose restart hub
```

### Health & Status

```bash
# Health endpoint on the Pi
curl http://localhost:4001/healthz

# Optional status endpoint (peers, outbox depth, cloud cursor)
curl http://localhost:4001/status

# Container logs
docker logs -f $(docker ps -q -f name=hub)
```

---

## 6) Using the Hub (Clients)

Clients attempt **mDNS discovery** for services of type **`_poshub._tcp`**. If multiple Hubs are found, they match by `{tenantId, storeId}` from TXT records (Cluster Token); otherwise they fall back to the **last known IP/port** or manual entry.

**Client policy (recommended):**

* Prefer **Hub** when reachable; fallback to **Cloud** only if Hub isn’t found.
* Always **write locally first** (device DB) → send event to Hub → Hub fans out and bridges to cloud asynchronously.

---

## 7) Updates at Scale

**Watchtower + channels (simple):** field devices follow an image reference like `:stable` or `:canary`. You move channel tags when ready.

```bash
# Promote 1.1.0 to 'canary'
docker tag ghcr.io/yourorg/pos-hub:1.1.0 ghcr.io/yourorg/pos-hub:canary
docker push ghcr.io/yourorg/pos-hub:canary

# After canary burn-in, promote to 'stable'
docker tag ghcr.io/yourorg/pos-hub:1.1.0 ghcr.io/yourorg/pos-hub:stable
docker push ghcr.io/yourorg/pos-hub:stable
```

**Tailscale + Ansible (controlled waves):**

```yaml
# Example Ansible tasks
- hosts: stores_canary
  tasks:
    - shell: docker compose -f /opt/pos-hub/docker-compose.yml pull
    - shell: docker compose -f /opt/pos-hub/docker-compose.yml up -d
    - uri: url=http://{{ inventory_hostname }}:4001/healthz return_content=yes
```

**Rollback:** re-pin previous image tag in `.env` (`IMAGE_REF`) or retag `stable` back; then:

```bash
cd /opt/pos-hub
docker compose pull
docker compose up -d
```

---

## 8) Troubleshooting

**Clients do not find the Hub**

* Ensure Pi and devices are on the same subnet.
* Check mDNS: `avahi-browse -rt _poshub._tcp` (Linux/Mac).
* Temporarily enter the Hub IP manually in the client.

**Port conflict on 4001**

* Change `PORT` in `/opt/pos-hub/.env` and in `/etc/avahi/services/poshub.service`; restart `avahi-daemon` and the stack.

**Container keeps restarting**

* Check health endpoint and logs. If a bad release, rollback to previous image and `docker compose up -d`.

**Time drift**

* Ensure NTP is enabled on the Pi; correct time is important for logs and tokens.

---

## 9) Multi-Tenant Co-Hosting (one Pi, many realms)

Run **one container per realm** with separate ports and data directories.

```yaml
services:
  hub_tA_s1:
    image: ghcr.io/yourorg/pos-hub:stable
    env_file: .env.tA_s1
    ports: ["4001:4001"]
    volumes: ["./data/tA_s1:/data"]

  hub_tB_s7:
    image: ghcr.io/yourorg/pos-hub:stable
    env_file: .env.tB_s7
    ports: ["4011:4011"]
    volumes: ["./data/tB_s7:/data"]
```

---

## 10) Uninstall / Reset

```bash
# Stop services
sudo systemctl stop pos-hub

# Remove containers
cd /opt/pos-hub
docker compose down

# (Danger) Delete data
sudo rm -rf /opt/pos-hub/data

# Remove systemd unit and mDNS service
sudo rm -f /etc/systemd/system/pos-hub.service
sudo rm -f /etc/avahi/services/poshub.service
sudo systemctl daemon-reload
sudo systemctl restart avahi-daemon
```

---

## 11) Security Notes

Use **Cluster Tokens (JWT)** signed by your cloud. The Hub verifies tokens offline using the public key stored in `CLUSTER_PUBLIC_KEY_BASE64`. Rotate keys centrally; set token TTLs with an offline grace for known devices.

**Optional LAN TLS:** generate a LAN certificate (e.g., with `mkcert`) and distribute your root CA to clients so browsers/apps trust the Hub over HTTPS/WSS on the LAN.

---

**End of Runbook — CloudClever POS © 2025**
