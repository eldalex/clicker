# Клиентская диагностика VPN и сайта

Этот файл рассчитан на текущую схему проекта:

- домен указывает на VPS
- `Xray` принимает `trojan` на `443/tcp`
- при обычном HTTPS-трафике `Xray` делает fallback на `nginx`
- `nginx` отдает сайт и проксирует `/api` на backend `127.0.0.1:3000`
- опционально включен `VLESS TLS` или `VLESS Reality` на отдельном порту, обычно `8443`

Во всех командах ниже замени:

- `YOUR_DOMAIN` на домен сервиса
- `VLESS_PORT` на фактический порт `VLESS`, если он включен

## 1. Быстрая проверка доступности

Проверить, резолвится ли домен:

```bash
dig +short YOUR_DOMAIN A
dig +short YOUR_DOMAIN AAAA
getent hosts YOUR_DOMAIN
```

Проверить ICMP, если провайдер не режет его:

```bash
ping -c 4 YOUR_DOMAIN
```

Проверить TCP-доступность `443`:

```bash
nc -vz YOUR_DOMAIN 443
timeout 5 bash -lc 'cat < /dev/null > /dev/tcp/YOUR_DOMAIN/443' && echo OK || echo FAIL
```

Если используется `VLESS` на отдельном порту:

```bash
nc -vz YOUR_DOMAIN VLESS_PORT
```

## 2. DNS и география маршрута

Сравнить резолв через разные DNS:

```bash
dig @1.1.1.1 +short YOUR_DOMAIN
dig @8.8.8.8 +short YOUR_DOMAIN
dig @9.9.9.9 +short YOUR_DOMAIN
```

Проверить трассировку:

```bash
traceroute YOUR_DOMAIN
mtr -rwzc 100 YOUR_DOMAIN
```

Что искать:

- резкую потерю пакетов на последних хопах
- сильный рост RTT на магистральных узлах
- разные IP в разных DNS, если оператор подменяет ответ

## 3. Проверка обычного HTTPS сайта

Если fallback и TLS работают, сайт должен открываться как обычный HTTPS:

```bash
curl -Ivs https://YOUR_DOMAIN/
curl -Ivs https://YOUR_DOMAIN/api/scores?game=clicker
```

Проверить время установления соединения:

```bash
curl -o /dev/null -sS \
  -w 'dns=%{time_namelookup} connect=%{time_connect} tls=%{time_appconnect} ttfb=%{time_starttransfer} total=%{time_total}\n' \
  https://YOUR_DOMAIN/
```

Ориентиры:

- `time_connect` растет при проблемах сети или блокировке/шейпинге
- `time_appconnect` растет при проблемах TLS
- `time_starttransfer` растет при проблемах nginx/backend

## 4. Диагностика TLS и сертификата

Проверить рукопожатие TLS:

```bash
openssl s_client -connect YOUR_DOMAIN:443 -servername YOUR_DOMAIN -brief < /dev/null
```

Посмотреть сертификат и цепочку:

```bash
openssl s_client -connect YOUR_DOMAIN:443 -servername YOUR_DOMAIN -showcerts < /dev/null
```

Достать сроки действия сертификата:

```bash
echo | openssl s_client -connect YOUR_DOMAIN:443 -servername YOUR_DOMAIN 2>/dev/null | \
openssl x509 -noout -subject -issuer -dates -fingerprint -sha256
```

Проверить поддержку HTTP/2:

```bash
curl -Ivs --http2 https://YOUR_DOMAIN/
```

Что считать проблемой:

- handshake timeout
- неожиданный сертификат
- отсутствие `servername`-совпадения
- резкое отличие результатов с разных сетей

## 5. Сравнение через разные каналы

Проверь сервис:

- с мобильного интернета
- через домашний интернет
- через другой провайдер или Wi-Fi
- через сервер/VM вне проблемной сети

Если сайт и TLS работают в одной сети, но VPN-клиент нет:

- вероятен DPI/селективное ограничение VPN-трафика
- особенно если обычный `curl https://YOUR_DOMAIN/` успешен, а `trojan`/`VLESS` нестабилен

## 6. Скорость до сайта

Проверить скорость скачивания статического ответа:

```bash
curl -Lso /dev/null -w 'size=%{size_download} speed=%{speed_download} total=%{time_total}\n' https://YOUR_DOMAIN/
```

Проверить несколько запусков подряд:

```bash
for i in 1 2 3 4 5; do
  curl -o /dev/null -sS -w "run=$i connect=%{time_connect} tls=%{time_appconnect} total=%{time_total} speed=%{speed_download}\n" https://YOUR_DOMAIN/;
done
```

Если есть внешний тестовый файл на сервере, можно проверить через `wget`:

```bash
wget -O /dev/null https://YOUR_DOMAIN/
```

## 7. Проверка MTU и фрагментации

Иногда VPN “тормозит” из-за MTU/PMTU blackhole.

Для Linux:

```bash
ping -M do -s 1472 YOUR_DOMAIN -c 3
ping -M do -s 1460 YOUR_DOMAIN -c 3
ping -M do -s 1400 YOUR_DOMAIN -c 3
```

Если большие пакеты стабильно теряются, а маленькие проходят:

- возможна проблема MTU по пути
- в клиенте VPN может помочь уменьшение MTU/mssfix, если клиент это поддерживает

## 8. Проверка локальных ограничений на клиенте

Убедиться, что нет локального packet loss или перегруза:

```bash
ip a
ip r
ss -s
```

Проверить системный resolver:

```bash
resolvectl status
```

Для Linux также полезно:

```bash
journalctl -b --no-pager | rg -i 'network|dns|timeout|tls'
```

## 9. Диагностика trojan/VLESS-клиента

Что проверить в клиенте:

- домен и порт совпадают с сервером
- для `trojan` пароль корректный
- для `VLESS TLS` правильный `uuid`, `security=tls`, `sni=YOUR_DOMAIN`
- для `VLESS Reality` правильные `uuid`, `serverName`, `publicKey`, `shortId`
- системное время на клиенте синхронизировано

Если клиент умеет выводить логи:

- включи `debug` или `info`
- ищи `timeout`, `EOF`, `handshake failed`, `reality`, `tls`, `certificate`, `connection reset`

## 10. Признаки именно операторской блокировки или шейпинга

Косвенные признаки:

- сайт по `https://YOUR_DOMAIN/` открывается, а VPN-протокол нет
- с одного провайдера все плохо, с другого все нормально
- ночью работает лучше, вечером хуже
- резкий рост `connect`/`tls` только на целевом домене/порту
- нестабильность только на `443` с VPN, но не на обычных HTTPS-сайтах

Для фиксации симптомов сохрани:

```bash
date -u
curl -Ivs https://YOUR_DOMAIN/ 2>&1 | tee client_https_check.txt
openssl s_client -connect YOUR_DOMAIN:443 -servername YOUR_DOMAIN -brief < /dev/null 2>&1 | tee client_tls_check.txt
mtr -rwzc 100 YOUR_DOMAIN | tee client_mtr.txt
```

## 11. Минимальный набор, который стоит прислать в разбор

- вывод `dig +short YOUR_DOMAIN`
- вывод `nc -vz YOUR_DOMAIN 443`
- вывод `curl -Ivs https://YOUR_DOMAIN/`
- вывод `openssl s_client -connect YOUR_DOMAIN:443 -servername YOUR_DOMAIN -brief`
- вывод `mtr -rwzc 100 YOUR_DOMAIN`
- точное время проблемы в UTC
- тип сети: домашний интернет, мобильный, конкретный оператор

