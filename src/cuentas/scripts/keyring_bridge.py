#!/usr/bin/env python3
"""Puente de comunicación multiplataforma con el almacén seguro del sistema operativo (Linux, macOS, Windows).
Permite leer y escribir el StoredToken en service='gemini', username='antigravity'.
"""

import sys
import json
import subprocess
import os

SERVICE_NAME = "gemini"
USER_NAME = "antigravity"

def _try_keyring_read():
    try:
        import keyring
        val = keyring.get_password(SERVICE_NAME, USER_NAME)
        if val:
            return json.loads(val)
    except Exception:
        pass
    return None

def _try_keyring_write(token_json_str):
    try:
        import keyring
        keyring.set_password(SERVICE_NAME, USER_NAME, token_json_str)
        return True
    except Exception:
        return False

# --- Backend Linux (Secret Service D-Bus) ---
def _linux_dbus_get_secret_item():
    import dbus
    bus = dbus.SessionBus()
    service = bus.get_object("org.freedesktop.secrets", "/org/freedesktop/secrets")
    login_col = bus.get_object("org.freedesktop.secrets", "/org/freedesktop/secrets/collection/login")
    items = login_col.Get("org.freedesktop.Secret.Collection", "Items", dbus_interface="org.freedesktop.DBus.Properties")

    for item_path in items:
        item = bus.get_object("org.freedesktop.secrets", item_path)
        attrs = item.Get("org.freedesktop.Secret.Item", "Attributes", dbus_interface="org.freedesktop.DBus.Properties")
        if str(attrs.get("service", "")) == SERVICE_NAME and str(attrs.get("username", "")) == USER_NAME:
            return bus, service, login_col, item
    return bus, service, login_col, None

def _linux_read():
    try:
        import dbus
        bus, service, login_col, item = _linux_dbus_get_secret_item()
        if not item:
            return None, "Item not found in Secret Service"
        session_output, session_path = service.OpenSession("plain", dbus.String("", variant_level=1), dbus_interface="org.freedesktop.Secret.Service")
        secret = item.GetSecret(session_path, dbus_interface="org.freedesktop.Secret.Item")
        raw_val = bytes(secret[2]).decode("utf-8")
        return json.loads(raw_val), None
    except Exception as e:
        return None, str(e)

def _linux_write(token_json_str):
    try:
        import dbus
        bus, service, login_col, item = _linux_dbus_get_secret_item()
        session_output, session_path = service.OpenSession("plain", dbus.String("", variant_level=1), dbus_interface="org.freedesktop.Secret.Service")
        secret_payload = (
            session_path,
            dbus.ByteArray(b""),
            dbus.ByteArray(token_json_str.encode("utf-8")),
            "text/plain"
        )
        if item:
            item.SetSecret(secret_payload, dbus_interface="org.freedesktop.Secret.Item")
        else:
            properties = {
                "org.freedesktop.Secret.Item.Label": f"Password for '{USER_NAME}' on '{SERVICE_NAME}'",
                "org.freedesktop.Secret.Item.Attributes": {
                    "service": SERVICE_NAME,
                    "username": USER_NAME,
                    "xdg:schema": "org.freedesktop.Secret.Generic"
                }
            }
            login_col.CreateItem(properties, secret_payload, True, dbus_interface="org.freedesktop.Secret.Collection")
        return True, None
    except Exception as e:
        return False, str(e)

# --- Backend macOS (Keychain via security CLI) ---
def _macos_read():
    try:
        cmd = ["/usr/bin/security", "find-generic-password", "-s", SERVICE_NAME, "-a", USER_NAME, "-w"]
        proc = subprocess.run(cmd, capture_output=True, text=True, check=True)
        raw = proc.stdout.strip()
        return json.loads(raw), None
    except subprocess.CalledProcessError as e:
        return None, f"Item not found in macOS Keychain ({e})"
    except Exception as e:
        return None, str(e)

def _macos_write(token_json_str):
    try:
        cmd = ["/usr/bin/security", "add-generic-password", "-s", SERVICE_NAME, "-a", USER_NAME, "-w", token_json_str, "-U"]
        subprocess.run(cmd, capture_output=True, text=True, check=True)
        return True, None
    except Exception as e:
        return False, str(e)

# --- Backend Windows (Windows Credential Manager via PowerShell PasswordVault) ---
def _windows_read():
    try:
        ps_cmd = (
            f"$v = New-Object Windows.Security.Credentials.PasswordVault; "
            f"try {{ $c = $v.Retrieve('{SERVICE_NAME}', '{USER_NAME}'); $c.RetrievePassword(); $c.Password }} "
            f"catch {{ exit 1 }}"
        )
        proc = subprocess.run(["powershell", "-NoProfile", "-Command", ps_cmd], capture_output=True, text=True)
        if proc.returncode == 0 and proc.stdout.strip():
            return json.loads(proc.stdout.strip()), None
        return None, "Item not found in Windows Credential Manager"
    except Exception as e:
        return None, str(e)

def _windows_write(token_json_str):
    try:
        # Escapar comillas simples para PowerShell
        escaped_json = token_json_str.replace("'", "''")
        ps_cmd = (
            f"$v = New-Object Windows.Security.Credentials.PasswordVault; "
            f"$c = New-Object Windows.Security.Credentials.PasswordCredential('{SERVICE_NAME}', '{USER_NAME}', '{escaped_json}'); "
            f"$v.Add($cred)"
        )
        proc = subprocess.run(["powershell", "-NoProfile", "-Command", ps_cmd], capture_output=True, text=True)
        return (proc.returncode == 0), (proc.stderr.strip() if proc.returncode != 0 else None)
    except Exception as e:
        return False, str(e)

def read_token():
    # 1. Intentar librería oficial cross-platform si está presente
    val = _try_keyring_read()
    if val:
        print(json.dumps({"success": True, "data": val}))
        return

    # 2. Fallbacks específicos por sistema operativo
    platform = sys.platform
    data = None
    err = None

    if platform.startswith("linux"):
        data, err = _linux_read()
    elif platform == "darwin":
        data, err = _macos_read()
    elif platform == "win32":
        data, err = _windows_read()
    else:
        data, err = _linux_read()

    if data:
        print(json.dumps({"success": True, "data": data}))
    else:
        print(json.dumps({"success": False, "error": err or "Token no encontrado"}))

def write_token(token_json_str):
    # 1. Intentar librería oficial cross-platform si está presente
    if _try_keyring_write(token_json_str):
        print(json.dumps({"success": True, "action": "synced_keyring"}))
        return

    # 2. Fallbacks específicos por sistema operativo
    platform = sys.platform
    ok = False
    err = None

    if platform.startswith("linux"):
        ok, err = _linux_write(token_json_str)
    elif platform == "darwin":
        ok, err = _macos_write(token_json_str)
    elif platform == "win32":
        ok, err = _windows_write(token_json_str)
    else:
        ok, err = _linux_write(token_json_str)

    if ok:
        print(json.dumps({"success": True, "action": "synced_native"}))
    else:
        print(json.dumps({"success": False, "error": err or "Fallo al escribir token"}))

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "Command required: read or write"}))
        sys.exit(1)

    cmd = sys.argv[1]
    if cmd == "read":
        read_token()
    elif cmd == "write":
        if len(sys.argv) < 3:
            payload = sys.stdin.read()
        else:
            payload = sys.argv[2]
        write_token(payload)
    else:
        print(json.dumps({"success": False, "error": f"Unknown command {cmd}"}))
        sys.exit(1)
