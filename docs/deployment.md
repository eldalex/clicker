# Deployment

Этот документ описывает развёртывание сайта и сопутствующей инфраструктуры через Ansible.

## Подготовка

Запускать playbook нужно из каталога `ansible`:

```bash
cd ansible
```

Заполни `ansible/inventory.ini`:

```ini
[clicker_server]
clicker ansible_host=YOUR_SERVER_IP
```

Заполни обязательные переменные в [`ansible/group_vars/all.yml`](../ansible/group_vars/all.yml):

- `domain` - домен, который указывает на твой VPS
- `trojan_password` - пароль для `trojan`-клиентов
- `ansible_user` / `ansible_ssh_pass` - SSH-доступ к серверу
- `ansible_become_*` - если нужен `become`

Минимальный deploy без VLESS:

- `enable_vless: false`
- `enable_vless_reality: false`

Установка:

```bash
ansible-playbook playbook.yml
```

При чистой установке `trojan-go` не ставится. Сразу разворачивается `Xray`, который поднимает `trojan`-inbound на `443`.

## Базовый сценарий

- на `443/tcp` поднимается `trojan`-inbound в `Xray`
- сайт обслуживает `nginx`
- сертификат получает `certbot`
- опционально можно включить `VLESS`
- опционально можно включить `VLESS Reality`

## VLESS

Если нужен дополнительный протокол `VLESS`:

1. Сгенерируй UUID.

```bash
cat /proc/sys/kernel/random/uuid
```

2. Укажи в [`ansible/group_vars/all.yml`](../ansible/group_vars/all.yml):

```yaml
enable_vless: true
vless_uuid: "ТВОЙ_UUID"
vless_port: 8443
enable_vless_reality: false
```

3. Запусти playbook:

```bash
ansible-playbook playbook.yml
```

Что нужно клиенту для `VLESS TLS`:

- `server`: твой домен
- `port`: `8443` или значение `vless_port`
- `uuid`: значение `vless_uuid`
- `security`: `tls`
- `sni`: твой домен

## VLESS Reality

Если нужен `VLESS Reality`, сначала подготовь ключи.

1. На машине, где есть `xray`, сгенерируй пару ключей:

```bash
/usr/local/bin/xray x25519
```

Команда вернёт:

- `PrivateKey` - это серверный ключ, его нужно записать в `vless_reality_private_key`
- `Password` - это публичный ключ, его потом нужно отдать клиенту как `publicKey`
- `Hash32` - для текущего шаблона не нужен

2. Сгенерируй `UUID`, если ещё не сделал:

```bash
cat /proc/sys/kernel/random/uuid
```

3. Придумай `short_id`.

Требования:

- hex-строка
- обычно 8-16 hex-символов
- пример: `5b34470e77ed40ee`

4. Укажи в [`ansible/group_vars/all.yml`](../ansible/group_vars/all.yml):

```yaml
enable_vless: true
vless_uuid: "ТВОЙ_UUID"
vless_port: 8443
enable_vless_reality: true
vless_reality_server_name: "www.cloudflare.com"
vless_reality_dest: "www.cloudflare.com:443"
vless_reality_private_key: "ТВОЙ_PRIVATE_KEY"
vless_reality_short_id: "ТВОЙ_SHORT_ID"
```

5. Запусти playbook:

```bash
ansible-playbook playbook.yml
```

Что нужно клиенту для `VLESS Reality`:

- `server`: твой домен или IP
- `port`: `8443` или значение `vless_port`
- `uuid`: значение `vless_uuid`
- `flow`: `xtls-rprx-vision`
- `serverName`: значение `vless_reality_server_name`
- `publicKey`: это `Password` из вывода `xray x25519`
- `shortId`: значение `vless_reality_short_id`
- `security`: `reality`

Если клиент требует `uTLS`, обычно подходит fingerprint `chrome`.

## Клиенты

Клиент для Android:

- https://github.com/MetaCubeX/ClashMetaForAndroid/releases

Клиент для Windows:

- https://www.clashforwindows.net/

Конфиг для Clash есть в репозитории:

- [`ansible/conf_for_clash.yml`](../ansible/conf_for_clash.yml)

При миграции `trojan-go -> Xray` trojan-конфиг клиента менять не нужно, если пароль, домен и порт не менялись.

Правила для Clash добавляются по аналогии:

1. Направлять в прокси: `DOMAIN-SUFFIX,youtube.com,PROXY`
2. Принудительно отправлять напрямую: `DOMAIN-SUFFIX,2ip.ru,DIRECT`
