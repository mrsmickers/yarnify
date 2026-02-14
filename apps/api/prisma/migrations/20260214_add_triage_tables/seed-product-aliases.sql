-- Seed product aliases with tested keyword patterns
-- ^ prefix = word-boundary match, multi-word = phrase match

INSERT INTO "product_aliases" ("id", "category", "product", "vendor", "keywords", "notes", "updatedAt") VALUES
('pa_sonicwall', 'Networking', 'SonicWall TZ Series', 'SonicWall', '["sonicwall", "netextender", "vpn client", "tz series", "tz 270", "tz 370", "tz 470"]', 'Firewall/VPN. NetExtender VPN client for remote access. Management via https://<IP>. Reset via pinhole on back.', NOW()),
('pa_dell_laptop', 'Hardware', 'Dell Laptop', 'Dell', '["^latitude", "^precision", "^xps", "supportassist", "dell laptop"]', 'Business laptops. Latitude=business, Precision=high-perf, XPS=premium.', NOW()),
('pa_dell_desktop', 'Hardware', 'Dell Desktop', 'Dell', '["^optiplex", "dell desktop"]', 'Dell Optiplex desktops. SFF, micro, tower form factors.', NOW()),
('pa_dell_server', 'Hardware', 'Dell Server', 'Dell', '["^poweredge", "^idrac", "dell server"]', 'Dell PowerEdge servers. iDRAC for remote management.', NOW()),
('pa_cisco_switch', 'Networking', 'Cisco Switch', 'Cisco', '["cisco switch", "cisco sg", "cisco catalyst"]', 'Cisco Small Business switches.', NOW()),
('pa_unifi', 'Networking', 'UniFi WAP', 'Ubiquiti', '["^unifi", "^ubiquiti", "access point", "wireless ap"]', 'UniFi wireless access points. Managed via UniFi Controller.', NOW()),
('pa_synology', 'Hardware', 'Synology NAS', 'Synology', '["^synology", "synology nas"]', 'Network Attached Storage.', NOW()),
('pa_printer', 'Hardware', 'Printer', 'Various', '["^printer", "^printers", "printing issue", "^toner", "^scanner", "print queue", "print job", "cannot print"]', 'Managed print or HP/Brother laser printers.', NOW()),
('pa_monitor', 'Hardware', 'Monitor', 'Various', '["^benq", "dell monitor", "external monitor", "second monitor", "dual monitor", "monitor not", "screen flickering", "no display", "blank screen"]', 'BENQ or Dell monitors.', NOW()),
('pa_dock', 'Hardware', 'Docking Station', 'Dell', '["docking station", "dell dock", "^wd19", "^wd22", "usb-c hub", "usb-c dock"]', 'Dell docking stations.', NOW()),
('pa_ups', 'Hardware', 'UPS', 'APC', '["^apc", "battery backup", "^powerchute", "apc ups"]', 'APC UPS. PowerChute for monitoring.', NOW()),
('pa_draytek', 'Networking', 'Draytek Vigor 130', 'Draytek', '["^draytek", "vigor 130", "dsl modem"]', 'xDSL modem. Sits before SonicWall firewall.', NOW()),
('pa_keeper', 'SaaS', 'Keeper Enterprise', 'Keeper', '["^keeper", "password manager", "keeper vault"]', 'Enterprise password manager.', NOW()),
('pa_knowbe4', 'SaaS', 'KnowBe4', 'KnowBe4', '["knowbe4", "phishing test", "security awareness training"]', 'Security awareness training platform.', NOW()),
('pa_sentinelone', 'SaaS', 'SentinelOne', 'SentinelOne', '["sentinelone", "sentinel one", "endpoint protection"]', 'EDR/endpoint protection.', NOW()),
('pa_axcient', 'SaaS', 'Axcient x360', 'Axcient', '["^axcient", "x360 recover", "x360 cloud", "axcient backup"]', 'Backup and disaster recovery (x360 Recover for servers, x360 Cloud for M365).', NOW()),
('pa_defender', 'SaaS', 'Microsoft Defender', 'Microsoft', '["microsoft defender", "defender for office", "defender alert"]', 'Email security integrated with M365.', NOW()),
('pa_duo', 'SaaS', 'DUO MFA', 'Cisco', '["duo mobile", "duo mfa", "duo push", "duo authentication", "duo app"]', 'Multi-factor authentication via push notifications.', NOW()),
('pa_teams', 'SaaS', 'Microsoft Teams', 'Microsoft', '["microsoft teams", "^msteams", "teams meeting", "teams call", "teams chat", "teams video"]', 'Collaboration: video, chat, channels.', NOW()),
('pa_onedrive', 'SaaS', 'OneDrive/SharePoint', 'Microsoft', '["^onedrive", "^sharepoint", "file sync", "sharepoint site"]', 'Cloud storage and file sharing.', NOW()),
('pa_umbrella', 'SaaS', 'Cisco Umbrella', 'Cisco', '["^umbrella", "cisco umbrella", "dns filtering"]', 'DNS filtering and web security.', NOW()),
('pa_anyconnect', 'SaaS', 'Cisco AnyConnect', 'Cisco', '["anyconnect", "cisco secure client", "cisco vpn"]', 'Cisco VPN client (AnyConnect / Secure Client).', NOW())
ON CONFLICT ("id") DO NOTHING;
