# Серверная диагностика VPN, TLS, сайта и backend

Этот файл рассчитан на текущую конфигурацию репозитория:

- `xray` слушает `443/tcp`
- fallback с `xray` идет на `127.0.0.1:80`
- `nginx` обслуживает сайт на `80/tcp`
- backend `click-backend` работает на `127.0.0.1:3000`
- SQLite лежит в `/var/lib/clicker`
- опционально `VLESS` слушает отдельный порт, обычно `8443`

## 1. Быстрый снимок состояния

Сразу собрать основную информацию:

```bash
date -u
uname -a
uptime
hostname -f
free -h
df -h
```

Сетевые сокеты и порты:

```bash
ss -ltnp
ss -s
ip a
ip r
```

Проверить, что ожидаемо слушают:

- `xray` на `0.0.0.0:443`
- `nginx` на `*:80`
- `node`/`click-backend` на `127.0.0.1:3000` или `*:3000`
- `VLESS` на отдельном порту, если включен

## 2. Systemd и процессы

Проверить сервисы:

```bash
systemctl status xray --no-pager
systemctl status nginx --no-pager
systemctl status click-backend --no-pager
```

Проверить последние логи:

```bash
journalctl -u xray -n 200 --no-pager
journalctl -u nginx -n 200 --no-pager
journalctl -u click-backend -n 200 --no-pager
```

Следить в реальном времени:

```bash
journalctl -u xray -f
journalctl -u nginx -f
journalctl -u click-backend -f
```

Что искать:

- рестарты
- `bind failed`
- `connection reset`
- ошибки чтения сертификата
- ошибки backend при `/api`

## 3. Конфиги и их фактическое состояние

Проверить конфиг `xray`:

```bash
sed -n '1,240p' /etc/xray/config.json
```

Убедиться, что:

- есть inbound `trojan` на `443`
- пароль ожидаемый
- fallback указывает на `127.0.0.1:80`
- сертификаты читаются из `/etc/letsencrypt/live/YOUR_DOMAIN/`
- `VLESS` и `Reality` параметры совпадают с ожидаемыми

Проверить конфиг `nginx`:

```bash
nginx -t
sed -n '1,240p' /etc/nginx/conf.d/YOUR_DOMAIN.conf
```

Проверить systemd unit backend:

```bash
systemctl cat click-backend
```

## 4. Локальная цепочка трафика по шагам

Проверить сайт локально через `nginx`:

```bash
curl -Ivs http://127.0.0.1/
curl -Ivs http://127.0.0.1/index.html
```

Проверить backend локально:

```bash
curl -Ivs http://127.0.0.1:3000/
curl -sS http://127.0.0.1:3000/api/scores?game=clicker
```

Проверить путь через публичный HTTPS:

```bash
curl -Ivs https://YOUR_DOMAIN/
curl -sS https://YOUR_DOMAIN/api/scores?game=clicker
```

Логика интерпретации:

- локальный `127.0.0.1:3000` падает: проблема backend
- `3000` работает, а `127.0.0.1/` нет: проблема nginx
- `127.0.0.1/` работает, а `https://YOUR_DOMAIN/` нет: проблема xray/TLS/DNS/маршрута

## 5. TLS и сертификаты на сервере

Проверить сертификат:

```bash
openssl x509 -in /etc/letsencrypt/live/YOUR_DOMAIN/fullchain.pem -noout -subject -issuer -dates -fingerprint -sha256
```

Проверить доступ к файлам:

```bash
namei -l /etc/letsencrypt/live/YOUR_DOMAIN/fullchain.pem
namei -l /etc/letsencrypt/live/YOUR_DOMAIN/privkey.pem
```

Проверить внешнее TLS-рукопожатие с сервера на самого себя:

```bash
openssl s_client -connect YOUR_DOMAIN:443 -servername YOUR_DOMAIN -brief < /dev/null
```

Проверить certbot:

```bash
certbot certificates
systemctl status certbot.timer --no-pager
```

## 6. Firewall и доступность портов

Проверить firewall:

```bash
ufw status verbose
iptables -S
iptables -L -n -v
```

Если используется nftables:

```bash
nft list ruleset
```

Проверить извне, что порты реально видны:

```bash
ss -ltnp | rg ':80|:443|:8443|:3000'
```

Важно:

- `3000` не обязан быть открыт наружу
- `80` нужен для сайта и `Let's Encrypt`
- `443` нужен для `trojan` и внешнего HTTPS
- `8443` нужен только если включен `VLESS`

## 7. Производительность и узкие места

Нагрузка:

```bash
uptime
vmstat 1 10
mpstat -P ALL 1 5
iostat -xz 1 5
```

Процессы:

```bash
ps aux --sort=-%cpu | head -20
ps aux --sort=-%mem | head -20
```

Сетевые ошибки интерфейса:

```bash
ip -s link
ethtool -S eth0
```

Если `ethtool` не установлен или интерфейс не `eth0`, скорректируй имя.

Что считать подозрительным:

- высокая `load average`
- постоянный `wa` в `vmstat`
- dropped/errors на сетевом интерфейсе
- нехватка RAM и активный swap

## 8. Тест пропускной способности

Базовая скорость скачивания сайта:

```bash
curl -o /dev/null -sS -w 'connect=%{time_connect} tls=%{time_appconnect} ttfb=%{time_starttransfer} total=%{time_total} speed=%{speed_download}\n' https://YOUR_DOMAIN/
```

Если есть второй сервер или клиент с `iperf3`, проверь канал:

На сервере:

```bash
iperf3 -s
```

На клиенте:

```bash
iperf3 -c YOUR_DOMAIN -p 5201
iperf3 -c YOUR_DOMAIN -p 5201 -R
```

Если `iperf3` недоступен, хотя бы сравни:

- скорость загрузки обычного сайта
- скорость VPN в том же временном окне

## 9. Проверка xray как точки деградации

Посмотреть, не упирается ли `xray` в лимиты:

```bash
journalctl -u xray --since '30 min ago' --no-pager
systemctl show xray -p MainPID,ExecMainStatus,Restart
cat /proc/$(systemctl show -p MainPID --value xray)/limits
```

Проверить открытые соединения:

```bash
ss -tnp state established '( sport = :443 or dport = :443 )'
ss -tnp state established '( sport = :8443 or dport = :8443 )'
```

Если много соединений в `SYN-RECV`, `TIME-WAIT` или частые resets:

- возможно сетевое давление извне
- возможно проблема conntrack/firewall
- возможно перегрузка или шейпинг по пути

## 10. Nginx и backend

Проверить логи веба:

```bash
tail -n 200 /var/log/nginx/access.log
tail -n 200 /var/log/nginx/error.log
```

Проверить backend-ошибки:

```bash
journalctl -u click-backend --since '30 min ago' --no-pager
```

Проверить живость API:

```bash
curl -sS 'http://127.0.0.1:3000/api/score?user=diag&game=clicker'
curl -sS 'https://YOUR_DOMAIN/api/scores?game=clicker'
```

Проверить БД:

```bash
ls -lh /var/lib/clicker
sqlite3 /var/lib/clicker/game.db '.tables'
sqlite3 /var/lib/clicker/game.db 'select count(*) from users;'
sqlite3 /var/lib/clicker/game.db 'select count(*) from scores;'
```

## 11. Проверка снаружи самого сервера

Иногда сервер “думает”, что все хорошо локально, но снаружи трафик режется. Полезно выполнить с сервера:

```bash
curl -4 ifconfig.me
dig +short YOUR_DOMAIN
```

И отдельно с внешней машины:

```bash
curl -Ivs https://YOUR_DOMAIN/
openssl s_client -connect YOUR_DOMAIN:443 -servername YOUR_DOMAIN -brief < /dev/null
nc -vz YOUR_DOMAIN 443
nc -vz YOUR_DOMAIN 8443
```

## 12. Признаки блокировки или шейпинга на стороне оператора/магистрали

Косвенные признаки:

- `nginx` и backend локально работают стабильно
- `xray` слушает порт и не падает
- сайт иногда открывается, но VPN-трафик нестабилен именно у части клиентов
- проблема зависит от провайдера, региона или времени суток
- при проверке с другого хоста сервис стабилен

В таком случае особенно важны:

- `mtr` с клиента до сервера
- сравнение разных операторов
- сохранение таймингов `curl`
- внешние TLS-проверки

## 13. Полезный набор команд для быстрого дампа

Можно сохранить единый снимок:

```bash
{
  date -u
  echo '== systemctl =='
  systemctl --no-pager --full status xray nginx click-backend
  echo '== sockets =='
  ss -ltnp
  echo '== xray log =='
  journalctl -u xray -n 200 --no-pager
  echo '== nginx log =='
  tail -n 100 /var/log/nginx/error.log
  echo '== backend log =='
  journalctl -u click-backend -n 100 --no-pager
  echo '== local http =='
  curl -Ivs http://127.0.0.1/ 2>&1
  echo '== public https =='
  curl -Ivs https://YOUR_DOMAIN/ 2>&1
} | tee server_diagnostics_$(date -u +%Y%m%dT%H%M%SZ).log
```

## 14. Минимум, который нужен для предметного разбора

- вывод `systemctl status xray nginx click-backend`
- вывод `ss -ltnp`
- вывод `nginx -t`
- вывод `curl -Ivs http://127.0.0.1/`
- вывод `curl -Ivs https://YOUR_DOMAIN/`
- вывод `journalctl -u xray -n 200`
- вывод `openssl x509 -in /etc/letsencrypt/live/YOUR_DOMAIN/fullchain.pem -noout -dates`
- точное время проблемы в UTC

