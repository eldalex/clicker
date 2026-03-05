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

Прочие параметры задаются в `defaults/main.yml`.
