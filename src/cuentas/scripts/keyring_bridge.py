#!/usr/bin/env python3
"""Puente de comunicación con el Secret Service de Linux para Antigravity.
Permite leer y escribir el StoredToken en service='gemini', username='antigravity'.
"""

import sys
import json
import dbus

SERVICE_NAME = "gemini"
USER_NAME = "antigravity"

def get_secret_item():
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

def read_token():
    bus, service, login_col, item = get_secret_item()
    if not item:
        print(json.dumps({"success": False, "error": "Item not found in Secret Service"}))
        return

    session_output, session_path = service.OpenSession("plain", dbus.String("", variant_level=1), dbus_interface="org.freedesktop.Secret.Service")
    secret = item.GetSecret(session_path, dbus_interface="org.freedesktop.Secret.Item")
    raw_val = bytes(secret[2]).decode("utf-8")
    try:
        data = json.loads(raw_val)
        print(json.dumps({"success": True, "data": data}))
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))

def write_token(token_json_str):
    bus, service, login_col, item = get_secret_item()
    session_output, session_path = service.OpenSession("plain", dbus.String("", variant_level=1), dbus_interface="org.freedesktop.Secret.Service")
    
    secret_payload = (
        session_path,
        dbus.ByteArray(b""),
        dbus.ByteArray(token_json_str.encode("utf-8")),
        "text/plain"
    )

    if item:
        item.SetSecret(secret_payload, dbus_interface="org.freedesktop.Secret.Item")
        print(json.dumps({"success": True, "action": "updated"}))
    else:
        properties = {
            "org.freedesktop.Secret.Item.Label": f"Password for '{USER_NAME}' on '{SERVICE_NAME}'",
            "org.freedesktop.Secret.Item.Attributes": {
                "service": SERVICE_NAME,
                "username": USER_NAME,
                "xdg:schema": "org.freedesktop.Secret.Generic"
            }
        }
        item_path, prompt_path = login_col.CreateItem(properties, secret_payload, True, dbus_interface="org.freedesktop.Secret.Collection")
        print(json.dumps({"success": True, "action": "created", "path": str(item_path)}))

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
