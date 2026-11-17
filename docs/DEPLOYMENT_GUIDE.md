# Deployment and Production Synchronization Guide

This document describes how code updates are validated, synchronized to GitHub, and safely deployed to the production ATE server (`10.11.11.2`).

---

## 1. Production Server Details

- **Host:** `10.11.11.2` (Hostname: `ni-ate`)
- **User:** `paridit`
- **Production Directory:** `/home/paridit/project/ate-platform`
- **Production Daemon:** `ate-web.service` (Systemd unit running on Port 8080)
- **Backup Location:** `/home/paridit/project/backups/`

---

## 2. Pre-Deployment Checklist

Before deploying any changes:
1. Run backend unit and integration tests:
   ```bash
   pytest tests/
   pytest hmi/backend/tests/
   ```
2. Build frontend production assets:
   ```bash
   cd hmi/frontend && npm run build
   ```
3. Commit and push clean working tree to GitHub `main`:
   ```bash
   git push origin main
   ```

---

## 3. Server Deployment Procedure

1. Connect to production server via SSH:
   ```bash
   ssh paridit@10.11.11.2
   ```
2. Create safety snapshot backup:
   ```bash
   cd /home/paridit/project
   cp -r ate-platform backups/ate-platform_backup_$(date +%Y%m%d_%H%M%S)
   ```
3. Pull latest commits from GitHub `origin/main`:
   ```bash
   cd /home/paridit/project/ate-platform
   git pull origin main
   ```
4. Restart production service safely:
   ```bash
   sudo systemctl restart ate-web.service
   ```
5. Verify health check:
   ```bash
   systemctl status ate-web.service
   curl -sI http://127.0.0.1:8080/arinc
   ```

---

## 4. Rollback Procedure

If any issue occurs during deployment:
```bash
sudo systemctl stop ate-web.service
rm -rf /home/paridit/project/ate-platform
cp -r /home/paridit/project/backups/<backup_folder> /home/paridit/project/ate-platform
sudo systemctl start ate-web.service
```
