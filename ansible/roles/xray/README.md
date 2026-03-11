Role Name
=========

xray

Description
-----------

Устанавливает и настраивает Xray в режиме совместимого `trojan`-сервера на `443/tcp` с TLS,
используя текущие переменные `domain` и `trojan_password`.

Compatibility
-------------

- Клиенты Clash с `type: trojan` продолжают работать без изменений.
- Legacy сервис `trojan-go` останавливается и отключается после установки Xray.

Variables
---------

- `domain`
- `trojan_password`
- `enable_vless` (по умолчанию `false`)
- `vless_port` (по умолчанию `8443`)
- `vless_uuid` (обязателен при `enable_vless: true`)
- `enable_vless_reality` (по умолчанию `false`)
- `vless_reality_server_name` (например `www.cloudflare.com`)
- `vless_reality_dest` (например `www.cloudflare.com:443`)
- `vless_reality_private_key` (обязателен для Reality)
- `vless_reality_short_id` (обязателен для Reality)

Прочие параметры задаются в `defaults/main.yml`.
