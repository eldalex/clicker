+ Простенький кликер 
+ vpn притворяющийся кликером 
+ ansible playbook для развёртывания всего этого дела.


для работы надо заполнить параметры в ansible/group_vars/all.yml

+ domain - твой арендованый домен
+ trojan_password - придумай пароль для vpn
+ ansible_user/ansible_ssh_pass - креды твоего арендованного vps 
+ Дополнительно указать ip твоего VPS в inventory.ini

установка:
+ ansible-playbook playbook.yml

Клиент для андроида:
+ https://github.com/MetaCubeX/ClashMetaForAndroid/releases

Клиент для windows:
+ https://www.clashforwindows.net/

конфиг для clash в комплекте. 
<p>просто добавь правил по аналогии:</p>

1. Направлять в прокси - DOMAIN-SUFFIX,youtube.com,PROXY
2. Принудительно отправлять напрямки - DOMAIN-SUFFIX,2ip.ru,DIRECT