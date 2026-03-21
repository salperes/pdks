import paramiko
import time
import sys
import subprocess
import os

sys.stdout.reconfigure(encoding='utf-8')

HOST = '192.168.88.111'
USER = 'mssadmin'
PASS = 'Ankara12!'
APP_DIR = '/home/mssadmin/pdks'

# Resolve tar path for Windows
result = subprocess.run(['bash', '-c', 'cygpath -w /tmp/pdks_deploy.tar'], capture_output=True, text=True)
tar_path = result.stdout.strip()
if not tar_path:
    tar_path = os.path.join(os.environ.get('TEMP', 'C:/Users/alper.es/AppData/Local/Temp'), 'pdks_deploy.tar')

print(f'[INFO] Tar path: {tar_path}')
print(f'[INFO] Tar exists: {os.path.exists(tar_path)}')
if os.path.exists(tar_path):
    print(f'[INFO] Tar size: {os.path.getsize(tar_path)} bytes')

print(f'[INFO] Connecting to {HOST}...')
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, username=USER, password=PASS)
print('[OK] Connected.')

def run_cmd(cmd, timeout=30, sudo=False, stream=False):
    print(f'[CMD] {cmd[:120]}{"..." if len(cmd) > 120 else ""}')
    print(f'[CMD] timeout={timeout}s, sudo={sudo}')
    t0 = time.time()
    stdin, stdout, stderr = ssh.exec_command(cmd, get_pty=True)
    if sudo:
        time.sleep(1)
        stdin.write(PASS + '\n')
        stdin.flush()
        print('[CMD] sudo password sent')

    if stream:
        # Stream output line by line with a max wait
        stdout.channel.settimeout(5)
        lines = []
        deadline = time.time() + timeout
        while time.time() < deadline:
            try:
                line = stdout.readline()
                if not line:
                    if stdout.channel.exit_status_ready():
                        break
                    time.sleep(1)
                    continue
                cleaned = line.rstrip('\n\r')
                # Filter sudo noise
                if 'password' in cleaned.lower() or '[sudo]' in cleaned.lower():
                    continue
                lines.append(cleaned)
                # Print progress dots for build lines
                if any(kw in cleaned.lower() for kw in ['step', 'running', 'done', 'built', 'error', 'warning', 'creating', 'started', 'pulling']):
                    print(f'  >> {cleaned[:150]}')
            except Exception:
                time.sleep(1)
                continue
        elapsed = time.time() - t0
        print(f'[CMD] completed in {elapsed:.1f}s, {len(lines)} lines')
        return '\n'.join(lines).strip()
    else:
        time.sleep(timeout)
        out = stdout.read().decode('utf-8', errors='replace')
        elapsed = time.time() - t0
        lines = [l for l in out.split('\n') if 'password' not in l.lower() and '[sudo]' not in l.lower()]
        result_text = '\n'.join(lines).strip()
        print(f'[CMD] completed in {elapsed:.1f}s, output={len(result_text)} chars')
        return result_text

# Step 1: DB Backup
print('\n========== Step 1: DB Backup ==========')
ts = time.strftime('%Y%m%d_%H%M%S')
backup_cmd = f'sudo -S docker exec pdks-postgres pg_dump -U pdks pdks > {APP_DIR}/backup/pdks_backup_{ts}.sql 2>&1'
out = run_cmd(backup_cmd, timeout=15, sudo=True)
print(f'[INFO] Backup file: pdks_backup_{ts}.sql')
if out:
    print(f'[OUTPUT] {out[:300]}')
out2 = run_cmd(f'ls -lh {APP_DIR}/backup/*.sql 2>/dev/null | tail -5', timeout=3)
print(f'[OUTPUT] {out2}')

# Step 2: Copy tar
print('\n========== Step 2: Copying deploy archive ==========')
from scp import SCPClient
t0 = time.time()
with SCPClient(ssh.get_transport()) as scp:
    scp.put(tar_path, '/home/mssadmin/pdks_deploy.tar')
print(f'[OK] Archive copied in {time.time()-t0:.1f}s')

# Step 3: Extract
print('\n========== Step 3: Extracting ==========')
out = run_cmd(f'cd {APP_DIR} && tar -xf /home/mssadmin/pdks_deploy.tar --overwrite && rm /home/mssadmin/pdks_deploy.tar && echo EXTRACT_OK', timeout=5)
if 'EXTRACT_OK' in out:
    print('[OK] Extracted successfully.')
else:
    print(f'[WARN] Extract output: {out[:300]}')

# Step 4: Build
print('\n========== Step 4: Building containers ==========')
print('[INFO] This may take 3-5 minutes...')
out = run_cmd(f'cd {APP_DIR} && sudo -S docker-compose build --no-cache backend frontend 2>&1', timeout=360, sudo=True, stream=True)
# Show last 10 lines
lines = out.strip().split('\n') if out.strip() else []
print(f'[INFO] Build output: {len(lines)} total lines. Last 10:')
for line in lines[-10:]:
    cleaned = ''.join(c if c.isprintable() or c in '\n\r\t' else '' for c in line)
    if cleaned.strip():
        print(f'  {cleaned}')

# Step 5: Restart
print('\n========== Step 5: Restarting containers ==========')
out = run_cmd(f'cd {APP_DIR} && sudo -S docker-compose up -d 2>&1', timeout=30, sudo=True)
print(f'[OUTPUT] {out[:500]}')

# Step 6: Wait and verify
print('\n========== Step 6: Container status ==========')
print('[INFO] Waiting 15s for startup...')
time.sleep(15)
out = run_cmd(f'sudo -S docker ps --filter "name=pdks" --format "table {{{{.Names}}}}\\t{{{{.Status}}}}\\t{{{{.Ports}}}}" 2>&1', timeout=5, sudo=True)
print(f'[OUTPUT]\n{out}')

# Step 7: Health check
print('\n========== Step 7: Health check ==========')
for attempt in range(3):
    print(f'[INFO] Attempt {attempt+1}/3...')
    time.sleep(5)
    out = run_cmd('curl -s -m 10 http://localhost:5174/api/v1/settings/system-info 2>&1', timeout=15)
    print(f'[OUTPUT] {out[:500]}')
    if 'personnelCount' in out or 'version' in out:
        print('[OK] Health check passed!')
        break
    if attempt < 2:
        print('[WARN] No valid response, retrying...')

ssh.close()
print('\n========== Deploy complete ==========')
