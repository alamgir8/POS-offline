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
