# KeePassXC-Mail [![codebeat badge](https://codebeat.co/badges/0365004b-6336-4f7c-8611-bbd217f29aa0)](https://codebeat.co/projects/github-com-kkapsner-keepassxc-mail-master)

Mozilla Thunderbird extension for [KeePassXC](https://keepassxc.org/) with Native Messaging.

Based on [KeePassXC-Browser](https://github.com/keepassxreboot/keepassxc-browser) and [keebird](https://github.com/kee-org/keebird).

## Usage

*Hopefully we can get this as simple as for KeePassXC-Browser in the future.*

 1. First the KeePassXC-Browser configuration (described in this [document](https://keepassxc.org/docs/keepassxc-browser-migration/)) has to be done.
 2. Afterwards the configuration file for the Native Messaging has to be created.
 3. At the end the addon can be installed in Thunderbird (download the latest xpi [here](https://github.com/kkapsner/keepassxc-mail/releases/latest)).

## Native Messaging configuration

### Windows

Run the following commands in the PowerShell:
```PowerShell
cat (Join-Path -path (get-item env:USERPROFILE).value -childPath AppData\Local\KeePassXC\org.keepassxc.keepassxc_browser_tor-browser.json) |
	%{$_ -replace "keepassxc-browser@keepassxc.org","keepassxc-mail@kkapsner.de"} |
	%{$_ -replace "org.keepassxc.keepassxc_browser","de.kkapsner.keepassxc_mail"} |
	Out-File -filePath (Join-Path -path (get-item env:USERPROFILE).value -childPath AppData\Local\KeePassXC\de.kkapsner.keepassxc_mail.json)

New-Item -path 'HKCU:\Software\Mozilla\NativeMessagingHosts\de.kkapsner.keepassxc_mail' -type Directory
Set-ItemProperty -path 'HKCU:\Software\Mozilla\NativeMessagingHosts\de.kkapsner.keepassxc_mail' -name '(default)' -value (Join-Path -path (get-item env:USERPROFILE).value -ChildPath AppData\Local\KeePassXC\de.kkapsner.keepassxc_mail.json)
```

### Linux

Run the following command in a terminal:
```Shell
cat ~/.mozilla/native-messaging-hosts/org.keepassxc.keepassxc_browser.json |\
	sed s/keepassxc-browser@keepassxc.org/keepassxc-mail@kkapsner.de/ |\
	sed s/org.keepassxc.keepassxc_browser/de.kkapsner.keepassxc_mail/ >\
	~/.mozilla/native-messaging-hosts/de.kkapsner.keepassxc_mail.json
```

### Mac OS X

Run the following command in a terminal:
```Shell
cat ~/Library/Application Support/Mozilla/NativeMessagingHosts/org.keepassxc.keepassxc_browser.json |\
	sed s/keepassxc-browser@keepassxc.org/keepassxc-mail@kkapsner.de/ |\
	sed s/org.keepassxc.keepassxc_browser/de.kkapsner.keepassxc_mail/ >\
	~/Library/Application Support/Mozilla/NativeMessagingHosts/de.kkapsner.keepassxc_mail.json
```

## Finding entries in the password database

KeePassXC-Mail uses the following schema to find matching entries for a given server:

 * `imap://{server name}`
 * `smtp://{server name}`
 * `pop3://{server name}`
 * `http://{server name}`
 * `https://{server name}`
 * `nntp-1://{server name}`
 * `nntp-2://{server name}`

### Tipp

If you have the same user and password for receiving (imap/pop3) and sending (smtp) and do not want to duplicate your entries you can go to the "Browser Integration" section of the entry definition in KeePassXC and add the second URL there. 

## Icon

Icon is based on the icon of [KeePassXC-Browser](https://github.com/keepassxreboot/keepassxc-browser/blob/develop/keepassxc-browser/icons/keepassxc.svg) - just the colors are changed to some colors of the Thunderbird.