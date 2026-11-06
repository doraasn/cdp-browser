---
name: cdp-browser
description: "閫氳繃 Chrome DevTools Protocol (CDP) 杩炴帴宸茶繍琛岀殑娴忚鍣紝鎵ц椤甸潰蹇収銆佷氦浜掋€佹暟鎹彁鍙栧拰鏍囩绠＄悊銆傚綋鐢ㄦ埛瑕佹眰杩炴帴璋冭瘯绔彛銆佽鍙栫綉椤点€佹搷浣滈〉闈€佹埅鍥炬垨绠＄悊鏍囩鏃朵娇鐢ㄣ€傞粯璁ゅ悗鍙版柊寤烘爣绛俱€佷换鍔＄粨鏉熷悗缁熶竴娓呯悊锛屼笉鍏抽棴鐢ㄦ埛鏍囩锛涘叧闂祻瑙堝櫒銆侀噸鍚祻瑙堝櫒銆佸叧闂敤鎴锋爣绛俱€佺偣鍑绘彁浜?鍒犻櫎/璐拱/鍙戦€佺被鎺т欢鍓嶏紝蹇呴』鍏堝彇寰楃敤鎴锋槑纭巿鏉冦€?
metadata:
  version: "1.18.1"
---

# CDP 娴忚鍣ㄨ嚜鍔ㄥ寲

閫氳繃 Node.js 鑴氭湰杩炴帴宸茶繍琛岀殑 Chrome銆丒dge 鎴?Chromium 娴忚鍣ㄣ€傛湰鏂囨。鑷冻锛氱幆澧冦€佹巿鏉冦€佹爣绛剧瓥鐣ャ€佸懡浠や笌瀹夊叏瑙勫垯閮藉湪杩欓噷锛屾棤闇€鍙﹁鍏朵粬鏂囦欢銆?
## 鐜瑕佹眰

- Node.js 鎻愪緵鍐呯疆 WebSocket API锛屾棤闇€瀹夎 npm 渚濊禆銆?- 娴忚鍣ㄩ渶寮€鍚湰鍦拌繙绋嬭皟璇曠鍙ｏ紝榛樿杩炴帴 `127.0.0.1:9222`锛屽彲鐢?`CDP_HOST`銆乣CDP_PORT` 淇敼銆?- **Chrome 136 鍙婃洿楂樼増鏈?*瀵?榛樿閰嶇疆 + 璋冭瘯绔彛"鏈夌瓥鐣ラ檺鍒讹紝瀹樻柟瑕佹眰鍙︾粰鐙珛鐨?`--user-data-dir`銆備絾杩欐槸 Chrome 鑷韩鐨勭瓥鐣ワ紝Chromium 鍒嗘敮涓嶄竴瀹氫細鎷︼細鏈満 CentBrowser 5.3锛圕hromium 150锛夊疄娴嬬敤**鍘熸潵鐨勯粯璁ら厤缃?*鍔?`--remote-debugging-port=9222 --restore-last-session` 閲嶅惎鍚庯紝绔彛姝ｅ父銆佸師鏈?11 涓爣绛惧叏閮ㄥ彲璇汇€?*鐢ㄦ埛瑕佹眰鎺ョ浠栬嚜宸辨祻瑙堝櫒鏃舵墠灏濊瘯閲嶅惎锛涢粯璁や笉閲嶅惎锛屽厛鍙敤鍙鎴栫嫭绔嬪疄渚嬨€?*

Windows 鍚姩绀轰緥锛?
```powershell
& "$env:ProgramFiles\Google\Chrome\Application\chrome.exe" `
  --remote-debugging-port=9222 `
  --user-data-dir="$env:TEMP\chrome-cdp"
```

鐙珛鐩綍鏄竴浠芥柊鐨勬祻瑙堝櫒閰嶇疆锛屽師閰嶇疆涓殑鐧诲綍鐘舵€佸拰 Cookie 涓嶄細鑷姩澶嶅埗杩囧幓銆傝皟璇曠鍙ｅ彲浠ユ帶鍒舵祻瑙堝櫒锛岃闄愬埗涓烘湰鏈鸿闂紝涓嶈鏆撮湶鍒板叕缃戙€?
## 杩炴帴娴忚鍣?
1. 鍏堣窇 `ping`銆傝剼鏈細鑷姩鍙戠幇绔偣锛岄『搴忔槸锛歚CDP_PORT` 鎸囧畾鐨勭鍙?鈫?9222 鈫?**姝ｅ湪杩愯涓斿甫 `--remote-debugging-port` 鐨勬湁鐣岄潰娴忚鍣?*锛堣杩涚▼鍛戒护琛岃В鏋愶紝涓嶇洸鎵鍙ｏ級銆?*榛樿璺宠繃 headless 瀹炰緥**锛岄伩鍏嶈杩炲埆鐨勯」鐩窇鐫€鐨勮嚜鍔ㄥ寲娴忚鍣紱闇€瑕佹椂鐢?`CDP_INCLUDE_HEADLESS=1` 鎵撳紑锛屾垨鐢?`CDP_IGNORE_PORTS=9223,9333` 鎺掗櫎鎸囧畾绔彛銆傝繑鍥為噷鐨?`port`銆乣portSource` 璇存槑杩炵殑鏄摢涓€佹€庝箞鎵惧埌鐨勩€?2. 鏈満鍚屾椂璺戠潃鍒殑椤圭洰娴忚鍣ㄦ椂锛?*寤鸿姣忔潯鍛戒护閮芥樉寮忓甫 `CDP_PORT`**锛屼笉瑕佷緷璧栬嚜鍔ㄥ彂鐜版潵鍥為€€銆傚垽鏂繛鐨勬槸璋侊細`portSource` 涓?`default` 鎴?`running-browser` 閮藉彲鑳芥槸**鐢ㄦ埛鑷繁鐨勬祻瑙堝櫒**锛?222 涓婂氨鍙兘鏄粬鐨勬棩甯告祻瑙堝櫒锛夛紝鐪?`tabs list` 閲?`tracked=false` 鐨勬爣绛惧嵆鍙‘璁ゃ€傝繖绉嶆儏鍐典笅鍙互鐩存帴鐢?`--target` 鎿嶄綔浠栫殑鏍囩锛堝彧璇讳紭鍏堛€佷笉鍏抽棴銆佷笉鏂板缓锛夈€?3. **姣忎釜鍛戒护閮芥槸鐙珛杩涚▼**锛氱敤浜嗛潪榛樿绔彛鏃讹紝姣忔潯鍛戒护閮借甯︿笂锛屼緥濡?PowerShell 閲屽厛 `$env:CDP_PORT='9390'`锛屾垨鐢?`CDP_PORT=9390 node ...`锛坆ash锛夈€?4. 涓€涓鍙ｉ兘娌″彂鐜版椂锛屼笉瑕佸啀闂敤鎴锋€庝箞閫夛紝鐩存帴鍚姩鐙珛璋冭瘯瀹炰緥锛?
   ```bash
   node scripts/launch_debug_browser.mjs
   ```

   鑴氭湰鐢ㄧ郴缁熼粯璁ゆ祻瑙堝櫒锛堟敞鍐岃〃瑙ｆ瀽锛屽彲鐢?`CDP_BROWSER_PATH` 瑕嗙洊锛夈€佺嫭绔嬮厤缃紙榛樿 `%LOCALAPPDATA%\cdp-browser-profile`锛屽彲鐢?`CDP_PROFILE_DIR` 鏀癸級鍜?`--remote-debugging-port` 鍚庡彴鍚姩锛岀瓑绔彛灏辩华鍚庤繑鍥?JSON銆傛樉寮忚浜?`CDP_PORT` 鏃跺彧鐢ㄨ绔彛锛屼笉浼氭倓鎮勬崲绔彛銆?5. 鎯崇洿鎺ユ帴绠＄敤鎴疯嚜宸辩殑鏍囩锛?*缁忕敤鎴峰悓鎰忓悗**璁╁悓涓€涓祻瑙堝櫒甯︾鍙ｉ噸鍚紙淇濈暀鐧诲綍鎬佸拰鍘熸湁鏍囩锛夛細

   ```powershell
   & "$env:LOCALAPPDATA\CentBrowser\Application\chrome.exe" --remote-debugging-port=9222 --remote-allow-origins=* --restore-last-session
   ```

   杩欎細鍏抽棴骞堕噸寮€娴忚鍣紝**蹇呴』鍏堝緛寰楀悓鎰忥紝涓嶈鎿呰嚜鎵ц**銆?6. 鐢ㄦ埛涓嶆兂閲嶅惎銆佹垨閲嶅惎鍚庣鍙ｄ粛鎵撲笉寮€鏃讹紝鎵嶉€€鍥炵嫭绔嬮厤缃疄渚嬶紙瑙佺 4 鏉★級锛屽苟璇存槑鐧诲綍鎬佷笉缁ф壙銆佺湅涓嶅埌鍘熺獥鍙ｆ爣绛俱€?7. 涓嶈鍋峰伔鎺ョ鐢ㄦ埛姝ｅ湪鐢ㄧ殑娴忚鍣紱涓嶈鍦ㄤ笉鍛婄煡鐨勬儏鍐典笅鍏抽棴瀹冦€?
鎵嬪姩鍚姩锛堣剼鏈笉鍙敤鏃剁殑澶囬€夛級锛?
```powershell
# Chrome
& "$env:ProgramFiles\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="$env:LOCALAPPDATA\cdp-browser-profile" --no-first-run

# Edge
& "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe" --remote-debugging-port=9222 --user-data-dir="$env:LOCALAPPDATA\cdp-browser-profile" --no-first-run

# CentBrowser锛堟湰鏈鸿矾寰勶紝鎸夊疄闄呭畨瑁呬綅缃浛鎹級
& "$env:LOCALAPPDATA\CentBrowser\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="$env:LOCALAPPDATA\cdp-browser-profile" --no-first-run
```

macOS锛?
```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --remote-debugging-port=9222 --user-data-dir=/tmp/cdp-browser-profile
```

### Windows 蹇嵎鏂瑰紡閰嶇疆锛堜繚鎸佺鍙ｅ彲鐢級

绔彛鍜屼細璇濇仮澶嶉兘鐢?*鍚姩鍙傛暟**鍐冲畾锛岃€?Windows 涓婁笉鍚屽叆鍙ｅ悇鏈変竴浠藉揩鎹锋柟寮忥紝鍙傛暟涓嶄竴鑷村氨浼氬嚭鐜?鏈夋椂鑳借繛銆佹湁鏃惰繛涓嶄笂"銆傞渶瑕佸悓鏃舵敼杩欏嚑澶勶細

- 浠诲姟鏍忓浐瀹氾細`%APPDATA%\Microsoft\Internet Explorer\Quick Launch\User Pinned\TaskBar\<娴忚鍣?.lnk`
- 寮€濮嬭彍鍗曪細`%APPDATA%\Microsoft\Windows\Start Menu\Programs\<娴忚鍣?.lnk`

缁熶竴浣跨敤涓嬮潰鐨勫弬鏁帮紙绔彛鎸夊疄闄呮敼锛夛細

```text
--remote-debugging-port=9222 --remote-allow-origins=* --restore-last-session
```

- `--remote-debugging-port` 鎵撳紑 CDP 绔彛锛?- `--remote-allow-origins=*` 鏀惧 WebSocket 鏉ユ簮鏍￠獙锛屼粎鏈満绔彛鏃堕闄╀綆锛屼笉闇€瑕佸彲鍘绘帀锛?- `--restore-last-session` 閲嶅惎鍚庢仮澶嶄笂娆＄殑鏍囩椤碉紝閬垮厤鍏虫祻瑙堝櫒灏变涪鐜板満銆?
鐢?PowerShell 鏀癸紙鏀瑰墠鍏堝浠?`.lnk`锛夛細

```powershell
$lnk = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Cent Browser.lnk"
Copy-Item $lnk "$env:TEMP\Cent Browser.lnk.bak" -Force
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($lnk)
$shortcut.Arguments = '--remote-debugging-port=9222 --remote-allow-origins=* --restore-last-session'
$shortcut.Save()
```

鏀瑰畬蹇呴』**瀹屽叏閫€鍑烘祻瑙堝櫒锛堝惈鎵樼洏鍥炬爣锛?*鍐嶄粠蹇嵎鏂瑰紡鍚姩鎵嶇敓鏁堬紱鐒跺悗 `ping` 搴旇繑鍥?`portSource=default`锛宍tabs list` 鑳界湅鍒板師鏈夋爣绛俱€傚彧鏀瑰揩鎹锋柟寮忎笉浼氬奖鍝嶆鍦ㄨ繍琛岀殑瀹炰緥銆?
**涓轰粈涔堟甯稿惎鍔ㄧ殑娴忚鍣ㄦ病鏈夌鍙?*锛堢敤鎴烽棶璧锋椂杩欐牱瑙ｉ噴锛夛細

- 璋冭瘯绔彛鍙湪鍚姩鍙傛暟閲屽甫 `--remote-debugging-port` 鏃舵墠鍒涘缓锛屽弻鍑绘墦寮€娴忚鍣ㄤ笉浼氬紑銆?- Chrome 瀹樻柟瀵归粯璁ら厤缃湁"绂佹杩滅▼璋冭瘯"鐨勭瓥鐣ワ紝浣嗘槸鍚︾敓鏁堝彇鍐充簬鍏蜂綋鏋勫缓锛氭湰鏈?CentBrowser 150 瀹炴祴鐢ㄥ師榛樿閰嶇疆甯︾鍙ｉ噸鍚悗瀹屽叏姝ｅ父銆傛墍浠ュ厛璇曞悓涓€閰嶇疆閲嶅惎锛屽け璐ヤ簡鍐嶆敼鐢ㄧ嫭绔?`--user-data-dir`銆?- Chromium 鏄崟瀹炰緥锛氭祻瑙堝櫒宸插湪杩愯鏃跺啀鐢ㄥ悓涓€涓?`--user-data-dir` 鍚姩锛屽彧浼氭妸鍙傛暟杞彂缁欑幇鏈夎繘绋嬶紝绔彛涓嶄細鏂板紑銆傚繀椤诲厛閫€鍑猴紙鍚墭鐩橈級鍐嶅甫鍙傛暟鍚姩銆?
杩炰笂鍚庡厛楠岃瘉锛歚node scripts/cdp_executor.mjs ping` 鍜?`tabs list`銆?*ping 涓嶉€氬氨缁х画鎺掓煡锛屼笉瑕佸０绉板凡缁忚繛涓婃垨宸茬粡璇诲埌椤甸潰銆?*

## 棣栨杩炴帴涓庢巿鏉冿紙纭€ц鍒欙級

1. 鍏?`ping`锛堣嚜鍔ㄥ彂鐜扮鐐癸級锛涢€氫簡灏辩洿鎺ョ敤璇ヤ細璇濓紝涓嶅叧闂€佷笉閲嶅惎鐢ㄦ埛鐨勬祻瑙堝櫒銆俙ping` 杩炰笉涓婃椂浠嶈緭鍑?JSON 浣?`connected=false`銆侀€€鍑虹爜涓?1锛岀敤鑴氭湰璋冪敤鏃跺厛鐪嬮€€鍑虹爜銆?2. 鑻ヨ繛鐨勬槸鐢ㄦ埛鑷繁鐨勬祻瑙堝櫒锛坄portSource` 涓?`default` 鎴?`running-browser`锛屾垨 `tabs list` 閲?`tracked=false` 鐨勬爣绛撅級锛氬彧璇绘垨鎸夌敤鎴锋巿鏉冩搷浣滐紝鐢?`--target` 鎸囧畾鏍囩锛屼笉鏂板缓銆佷笉鍏抽棴锛涗换鍔＄粨鏉熶篃涓嶆竻鐞嗕粬鐨勬爣绛俱€?3. 涓€涓鍙ｉ兘娌″彂鐜版椂锛岃繍琛?`node scripts/launch_debug_browser.mjs` 璧风嫭绔嬪疄渚嬶紝涓嶉渶瑕佸啀寰佹眰鈥滄槸鍚﹀叧闂祻瑙堝櫒鈥濈殑閫夋嫨锛?*涓嶅緱鍏抽棴鐢ㄦ埛姝ｅ湪鐢ㄧ殑娴忚鍣ㄧ獥鍙?*銆傛樉寮忚浜?`CDP_PORT` 鏃惰剼鏈彧璁よ绔彛锛屼笉浼氬幓鎺㈡祴鎴栧鐢ㄥ埆鐨勭鍙ｃ€?4. 鐙珛瀹炰緥璇讳笉鍒扮敤鎴峰師绐楀彛鐨勬爣绛撅紝涔熶笉缁ф壙鐧诲綍鎬侊紱涓嶅緱澹扮О宸茬粡鎭㈠鎴栬鍙栦簡閭ｄ簺鏍囩銆傞渶瑕佹椂璇风敤鎴锋彁渚?URL 鎴栧湪璇ョ獥鍙ｉ噸鏂扮櫥褰曘€?5. URL 鍙兘鍚晱鎰熸煡璇㈠弬鏁帮紝鏈粡鐢ㄦ埛鍚屾剰涓嶅緱淇濆瓨銆備笉寰椾粠鏈叕寮€鐨勬祻瑙堝櫒浼氳瘽鏂囦欢鎺ㄦ柇鏍囩鐘舵€併€?6. 鏈兘閫氳繃 CDP 璇诲埌鐨勪笢瑗匡紝涓嶅緱澹扮О宸茬粡璇诲埌鎴栧凡缁忔仮澶嶃€?7. 澶辫触淇℃伅浠?JSON 鍐欏埌 **stderr**锛歅owerShell 閲岀敤 `2>&1` 鍚堝苟杈撳嚭锛屽苟妫€鏌?`$LASTEXITCODE`锛屽惁鍒欏鏄撹浠ヤ负鍛戒护娌℃湁杈撳嚭銆?
## 鏍囩浣跨敤瑙勫垯锛堟牳蹇冿級

**寮€宸ユ竻鍗曪紙姣忎釜浠诲姟杩囦竴閬嶏紱璺ㄨ疆娆°€侀殧寰堜箙鍐嶇户缁殑浠诲姟瑕侀噸鏂拌繃锛?*

- 杩欐瑕佸紑鍑犱釜鏍囩锛熻兘涓€涓爣绛捐窇鍒扮粨鏉熷氨鍙紑涓€涓€?- 鍏ㄩ儴**鍚庡彴**鎵撳紑锛岃涓?`targetId`锛屽悗缁瘡鏉″懡浠ら兘甯?`--target`銆?- 缁撴潫鎬庝箞鏀讹細鍝簺鐢?`tabs close-id` 鍏炽€佸摢浜涜鐣欑粰鐢ㄦ埛銆?
**涓夋潯纭孩绾?*

- **涓嶆彁渚涗换浣曞墠鍙?婵€娲昏兘鍔?*锛歚--foreground`銆乣--user-requested-foreground` 涓€寰嬫姤閿欓€€鍑猴紱鏍囩鍙湪鍚庡彴鎵撳紑鍜屾搷浣滐紝缁濅笉鎶㈢敤鎴风劍鐐广€?- **涓嶈缁曡繃鎶€鑳芥姠鐒︾偣**锛氱姝㈢敤 `/json/new`銆乣/json/activate`銆乣Page.bringToFront` 绛夊師鐢熸帴鍙ｅ紑鎴栨縺娲绘爣绛撅紱鏂板缓涓€寰嬬敤 `tabs open`锛堝悗鍙帮級銆傜敤鎴疯鈥滃埆鎵撴壈鎴戔€濇椂锛岃繛鏂扮獥鍙ｉ兘涓嶈寮广€?- **涓嶈涓轰簡鎴浘/璋冭瘯鍘绘敼搴旂敤銆佹彃浠舵垨鍓嶇鐨勫惎鍔ㄥ弬鏁?*锛氫笉瑕佸線 Electron / 妗岄潰绋嬪簭 / 鍓嶇浠ｇ爜閲屽 `--remote-debugging-port` 涔嬬被鐨勫弬鏁帮紝涔熶笉瑕佹妸妗岄潰搴旂敤绐楀彛褰撶綉椤垫爣绛炬潵鎿嶆帶锛涜楠岃瘉 UI 灏辩敤娴忚鍣ㄦ墦寮€缃戦〉鎴栨湰鍦伴瑙堥〉锛屽苟鍚庡彴鎵撳紑銆?- 鏀跺熬鍙叧鑷繁寮€鐨勶細浼樺厛 `tabs close-id <id>`銆俙cleanup` / `tabs close` / `close-tracked` **榛樿鍙姩鏈細璇濓紙owner锛夌殑鏍囩**锛涘姞 `--all` 鎵嶄細杩炲埆鐨勪細璇濆拰鍘嗗彶閬楃暀涓€璧峰叧锛屾墽琛屽墠蹇呴』纭娌℃湁鍏朵粬浼氳瘽姝ｅ湪鐢ㄦ祻瑙堝櫒銆?
**缁嗗垯**

1. **鍏堣鍒掑啀寮€鏍囩**銆傚姩鎵嬪墠鍏堜及绠椾换鍔￠渶瑕佸嚑涓爣绛撅細涓€涓爣绛捐兘璺戝埌缁撴潫灏卞彧寮€涓€涓紝涓嶈涓€鏉″懡浠ゅ紑涓€涓€佺敤瀹屽氨鍏炽€?*姣忔潯椤甸潰鍛戒护閮芥樉寮忓甫 `--target`**锛氭紡甯︽椂浼氶潤榛樻柊寤烘爣绛惧苟杩涘叆杩借釜锛岄殢鍚?`cleanup` 浼氭妸瀹冨叧鎺夈€?2. **浼樺厛澶嶇敤**銆傚悓涓€ URL 鐨勮嚜鏈夋爣绛句細琚嚜鍔ㄥ鐢紱杩炵画浠诲姟搴斿鐢ㄥ悓涓€鎵规爣绛剧洿鍒扮粨鏉燂紝閬垮厤鍙嶅鏂板缓/鍏抽棴閫犳垚鎶栧姩鍜屾€ц兘鎹熻€椼€?3. **鐢ㄦ埛鎸囧畾宸叉湁鏍囩鏃讹紝鍙娇鐢ㄧ敤鎴风殑鏍囩锛屼笉鏂板缓浠讳綍鏍囩**銆傚厛鐢?`tabs list` 鎵惧埌鐩爣鏍囩 ID锛屼箣鍚庢墍鏈夐〉闈㈠懡浠ら兘甯?`--target <id>`锛涢渶瑕佸師鍦版搷浣滄椂 URL 浣嶇疆浼?`-`銆?*鍙 `tracked=false` 鐨勭敤鎴锋爣绛惧仛淇濇姢**锛氬甫 URL 瀵艰埅瀹冧細琚嫆缁濓紙閬垮厤瑕嗙洊浠栧綋鍓嶇殑椤甸潰锛夛紝纭疄瑕佸鑸繀椤绘樉寮忓姞 `--navigate-user-tab`锛涜嚜鏈夋爣绛惧甫 URL 鍒欐甯稿鑸€傛敞鎰忚繖鍙**宸茶繛鎺ュ疄渚嬪唴**鐨勬爣绛炬垚绔嬶紱鐙珛璋冭瘯瀹炰緥鐪嬩笉鍒扮敤鎴峰師绐楀彛鐨勬爣绛撅紝闇€瑕佽鍏跺湪璇ョ獥鍙ｉ噸鏂版墦寮€銆?4. **涓嶅叧闂敤鎴锋爣绛?*銆傜敤鎴锋爣绛句笉杩涘叆杩借釜锛宍cleanup`銆乣tabs close` 閮戒笉浼氱瀹冿紱浠诲姟缁撴潫鍚庝篃涓嶅緱鍏抽棴銆傚彧鏈夌敤鎴锋槑纭姹傚叧闂煇涓爣绛炬椂锛屾墠鍙敤 `tabs close-id <id>` 绮剧‘鍏抽棴銆?5. **鏂板缓鏍囩涓€寰嬪悗鍙帮紝娌℃湁鍓嶅彴鍙傛暟**銆俙tabs open` 鍥哄畾 `background=true`锛屾敹鍒?`--foreground` / `--user-requested-foreground` 鐩存帴鎶ラ敊閫€鍑恒€傜敤鎴锋爣绛捐鍐荤粨鏃朵笉瑕佽瘯鍥炬縺娲诲畠锛屾敼鐢?`tabs open` 鏂版爣绛撅紝鎴栬鐢ㄦ埛鑷繁鐐瑰紑閭ｄ釜鏍囩銆?6. **浠诲姟缁撴潫缁熶竴娓呯悊**銆傛敹灏剧敤 `tabs close-id` 绮剧‘鍏虫帀鏈浠诲姟鑷繁寮€鐨勬爣绛撅紱`cleanup` 榛樿鍙叧鏈細璇濇爣绛撅紝鍔?`--all` 鎵嶄細鍏ㄥ眬娓呯悊銆傝鐣欑粰鐢ㄦ埛鏌ョ湅鐨勬爣绛句繚鐣欏苟鍦ㄦ渶鍚庤鏄庯紝涓嶈姣忔潯鍛戒护鍚庨兘 `cleanup`銆?7. **鑳藉苟琛屽氨骞惰**銆傞渶瑕佸涓〉闈㈡椂锛岀敤涓€娆?`tabs open <url1> <url2> ...` 鎵归噺鍚庡彴鎵撳紑锛屾垨骞跺彂鎵ц澶氭鍛戒护锛涘悇鑷敤 `--target` 鎸囧悜鑷繁鐨勬爣绛俱€傝拷韪枃浠跺甫鏂囦欢閿侊紝骞跺彂瀹夊叏銆?8. **澶栭儴鍙樻洿闇€鎺堟潈**銆傜偣鍑绘彁浜ゃ€佸垹闄ゃ€佽喘涔般€佸彂閫佺瓑浼氶€犳垚澶栭儴鍙樻洿鐨勬帶浠跺墠锛屽繀椤诲彇寰楃敤鎴锋槑纭巿鏉冿紱濉啓鍐呭鏈韩涓嶄唬琛ㄥ厑璁告彁浜ゃ€?
## 澶氫細璇濆叡鐢ㄦ祻瑙堝櫒锛堢害瀹氾級

- **褰掑睘鑷姩鍒ゅ畾**锛歚CDP_OWNER` > `DSH_SESSION_ID` > `default`銆傚悓涓€鍙版満鍣ㄤ笂涓嶅悓浼氳瘽澶╃劧鏄笉鍚岀殑 owner锛屼笉闇€瑕佹墜宸ヨ缃€?- **瀛愪唬鐞嗕篃鏄嫭绔?owner**锛氳娲剧敓鐨勫瓙浠ｇ悊鎷垮埌鐨勬槸鑷繁鐨?`DSH_SESSION_ID`锛堜笌鐖朵細璇濅笉鍚岋級锛屼笉浼氬拰鐖朵細璇濅簰鐩稿叧闂鏂规爣绛撅紱纭疄瑕佽瀛愪唬鐞嗘帴绠＄埗浼氳瘽鐨勬爣绛炬椂锛岀粰鍙屾柟鏄惧紡璁剧疆鍚屼竴涓?`CDP_OWNER`銆?- **榛樿闅旂**锛歚cleanup`銆乣tabs close`銆乣tabs close-tracked` 鍙鐞嗘湰浼氳瘽鐨勬爣绛撅紱`tabs list` 鐢?`owner` / `mine` 璁ら锛屼笉瑕侀潬鏁伴噺鐚溿€?- **鍚屼竴 URL 鍙鐢ㄦ湰浼氳瘽鐨勬爣绛?*锛氫袱涓細璇濆悓鏃跺紑鍚屼竴涓?URL 浼氬悇寮€涓€涓紝涓嶄細涓插彴锛涜法浼氳瘽涓嶄細鍏辩敤鏍囩銆?- **`--all` 鏄敮涓€鐨勫叏灞€娓呯悊**锛氫細鍏抽棴鍏朵粬浼氳瘽鐨勬爣绛惧拰鏃х増閬楃暀锛坥wner=`legacy`锛夌殑璺熻釜鏍囩锛屾墽琛屽墠纭娌℃湁鍒殑浼氳瘽姝ｅ湪鐢ㄦ祻瑙堝櫒銆?- **涓嶈鍏变韩鍚屼竴涓爣绛惧仛浜や簰**锛氫袱涓細璇濆悓鏃剁敤 `--target` 鐐瑰悓涓€涓爣绛撅紝鍔ㄤ綔浼氫氦閿欍€佺粨鏋滀笉纭畾锛涜骞惰灏卞悇寮€鍚勭殑銆?- **鐢ㄦ埛鏍囩姘歌繙瀹夊叏**锛氫笉杩涘叆杩借釜锛屼换浣?owner 閮藉叧涓嶆帀銆?
## 浣跨敤鍏ュ彛

```bash
node "$SKILLS_ROOT/cdp-browser/scripts/cdp_executor.mjs" <command> [args...]
node "$SKILLS_ROOT/cdp-browser/scripts/launch_debug_browser.mjs"   # 涓€涓鍙ｉ兘娌″彂鐜版椂锛岃捣鐙珛璋冭瘯瀹炰緥
```

鍦ㄦ妧鑳界洰褰曞唴鎵ц鏃跺彲绠€鍐欎负 `node scripts/cdp_executor.mjs <command> [args...]`銆傛垚鍔熺粨鏋滆緭鍑哄埌 **stdout**锛屽け璐ヤ俊鎭緭鍑哄埌 **stderr**锛岄兘鏄?JSON锛涘け璐ユ椂閫€鍑虹爜闈為浂锛坄ping` 杩炰笉涓婁篃杩斿洖 1锛屽悓鏃?stdout 閲屾湁 `connected=false`锛夈€?
甯歌杩斿洖瀛楁锛?
| 鍛戒护 | 杩斿洖 |
|---|---|
| `tabs list` | 鏁扮粍锛屾瘡椤?`id`銆乣title`銆乣url`銆乣tracked`銆乣owner`銆乣mine`锛涜鐩栨墍鏈夌獥鍙?|
| `tabs open` | 鍗曚釜 URL 杩斿洖鎵佸钩瀵硅薄锛坄targetId`銆乣url`銆乣newTab`銆乣reusedTab`銆乣background`锛夛紱澶氫釜 URL 杩斿洖 `{ tabs: [...] }` |
| `extract` | `title`銆乣url`銆乣lines`銆乣totalLines`銆乣targetId`銆乣newTab`銆乣reusedTab` |
| `eval` | `result`锛堥〉闈㈣〃杈惧紡杩斿洖鍊硷級 |
| `screenshot` | `path`銆乣size`銆乣newTab`銆乣reusedTab` |
| `snapshot` | `nodes`銆乣snapshot`銆乣nodeCount`銆乣maxNodes`銆乣truncated` |
| `click` | `action`銆乣selector`銆乣element`銆乣x`銆乣y` |
| `fill` | `action`銆乣selector`銆乣element`銆乣changed`銆乣valueLength`锛?*涓嶅洖鏄捐緭鍏ュ唴瀹?*锛岃鏍稿灏卞啀 `eval` 璇讳竴娆★級 |
| `press` / `scroll` | `action`銆乣selector`銆乣element`锛堟寜閿細鍙戦€?keydown/keyup锛屽彲鑳借Е鍙戦〉闈㈢洃鍚拰榛樿琛屼负锛屼緥濡?Enter 鎻愪氦琛ㄥ崟锛?|
| `cleanup` | `cleanedUp`銆乣failed`銆乣keptTracked`銆乣scope`锛坄owner <id>` 鎴?`all tracked tabs`锛?|

### 澶嶆潅 JS 鐢?`--file`锛屼笉瑕佸杩涘懡浠よ

Windows PowerShell 浼氬悶鎺夋垨杞箟鍐呭眰寮曞彿锛岀◢闀跨殑 JS 浼犺繘鍘诲緢瀹规槗鍙樻垚 `SyntaxError: Unexpected end of input`銆傛妸 JS 鍐欏埌鏂囦欢鍐嶆墽琛岋細

```powershell
node scripts/cdp_executor.mjs eval - --target TARGET_ID --file .\snippet.js
Get-Content .\snippet.js -Raw | node scripts/cdp_executor.mjs eval - --target TARGET_ID --stdin
```

bash 涓嬪搴?`cat snippet.js | node scripts/cdp_executor.mjs eval - --target TARGET_ID --stdin`銆傜煭琛ㄨ揪寮忥紙濡?`document.title`锛変粛鍙洿鎺ヤ綔涓哄弬鏁颁紶銆?
**涓嶈鐢?`| Select-Object -First N` 鎴柇杩欎簺鍛戒护鐨勮緭鍑?*锛氱閬撴彁鍓嶅叧闂細璁?node 鏀跺埌 EPIPE 骞朵互閫€鍑虹爜 1 缁撴潫锛岀湅璧锋潵鍍忊€滃懡浠ゅけ璐ヤ絾 JSON 鏄?success鈥濄€傞渶瑕佹埅鏂氨鍏?`2>&1 | Out-String` 鏀跺叏锛屽啀澶勭悊瀛楃涓层€?
甯哥敤鍛戒护锛?
```bash
node scripts/cdp_executor.mjs ping
node scripts/cdp_executor.mjs tabs list
node scripts/cdp_executor.mjs tabs open <url...>            # 鍥哄畾鍚庡彴锛涘墠鍙板弬鏁颁細琚嫆缁?node scripts/cdp_executor.mjs extract <url|-> [--wait <ms>] [--target <id>]
node scripts/cdp_executor.mjs eval <url|-> <js-code> [--target <id>]
node scripts/cdp_executor.mjs eval <url|-> --file <js-path> [--target <id>]
node scripts/cdp_executor.mjs snapshot <url|-> [--target <id>]
node scripts/cdp_executor.mjs screenshot <url|-> <output-path> [--target <id>]
node scripts/cdp_executor.mjs click <url|-> <selector> [--target <id>]
node scripts/cdp_executor.mjs fill <url|-> <selector> <value> [--target <id>]
node scripts/cdp_executor.mjs press <url|-> <selector> <key> [--target <id>]
node scripts/cdp_executor.mjs scroll <url|-> <selector> <direction> [amount] [--target <id>]
node scripts/cdp_executor.mjs cleanup [--keep <id,id,...>] [--all]
```

## 鑴氭湰缁撴瀯

| 鏂囦欢 | 鑱岃矗 | 瀵瑰簲鍛戒护 |
|---|---|---|
| `cdp_executor.mjs` | 鍞竴鍛戒护鍏ュ彛锛屾墽琛屾墍鏈夋搷浣?| 鍏ㄩ儴鍛戒护 |
| `launch_debug_browser.mjs` | 鎵句笉鍒扮鍙ｆ椂鍚姩鐙珛璋冭瘯瀹炰緥 | 杩炴帴鍓?|
| `cdp_endpoint.mjs` | 鍙戠幇骞舵帓搴忓彲鐢ㄨ皟璇曠鍙?| ping / 杩炴帴闃舵 |
| `dom_actions.mjs` | 鐐瑰嚮銆佸～琛ㄣ€佹寜閿€佹粴鍔?| click / fill / press / scroll |
| `page_snapshot.mjs` | 鐢熸垚绮剧畝鏃犻殰纰嶆爲蹇収 | snapshot |

闄?`cdp_executor.mjs` 澶栧潎涓哄唴閮ㄦā鍧楋紝鐢卞叆鍙?import锛屼笉瑕佸崟鐙皟鐢紝涔熶笉瑕佸綋姝讳唬鐮佸垹闄ゃ€?
## 鍛戒护鍙傝€?
| 鍛戒护 | 浣滅敤 |
|---|---|
| `ping` | 妫€鏌?CDP 杩炴帴 |
| `tabs list` | 鍒楀嚭椤甸潰鏍囩鍙?`tracked`/`owner`/`mine`锛涘彧璇诲彇锛屼笉鍏抽棴 |
| `tabs open <url...>` | 鍥哄畾鍚庡彴鎵撳紑鎴栧鐢ㄦ爣绛撅紝鍙竴娆′紶澶氫釜 URL锛涗笉鍏抽棴鍏朵粬鏍囩銆備换浣曞墠鍙?婵€娲诲弬鏁伴兘浼氭姤閿欓€€鍑?|
| `extract <url> [--wait ms]` | 鎻愬彇鏍囬銆佸綋鍓?URL 鍜屾渶澶?200 琛岄〉闈㈡枃鏈?|
| `eval <url|-> <js-code> | --file <path> | --stdin [--wait ms]` | 鎵ц椤甸潰 JavaScript锛涘鏉?JS 鐢?`--file` 鎴?`--stdin`锛岄伩鍏?PowerShell 鍚炲紩鍙?|
| `screenshot <url> <output> [--wait ms]` | 淇濆瓨褰撳墠瑙嗗彛鐨?PNG 鎴浘 |
| `snapshot <url>` | 璇诲彇绮剧畝鐨勬棤闅滅鏍戯紝鏈€澶?500 涓妭鐐?|
| `wait-for <url> <selector> [--timeout ms]` | 绛夊緟 selector 瀵瑰簲鐨勫彲瑙佸厓绱?|
| `click <url> <selector> [--timeout ms]` | 绛夊緟骞剁偣鍑诲敮涓€銆佸彲瑙併€佸彲鐢ㄧ殑鍏冪礌 |
| `fill <url> <selector> <value> [--timeout ms]` | 绛夊緟骞跺～鍐欐枃鏈?input銆乼extarea 鎴?contenteditable |
| `press <url> <selector> <key> [--timeout ms]` | 鑱氱劍鍏冪礌骞跺彂閫佹寜閿紝鏀寔 `Control+A` 绛夌粍鍚堥敭 |
| `scroll <url> <selector> <direction> [amount] [--timeout ms]` | 婊氬姩鏈€杩戠殑鍙粴鍔ㄧ鍏堟垨椤甸潰锛宎mount 涓?1鈥?0000 |
| `tabs close <pattern> [--all]` | 鍏抽棴 URL 鍖归厤鐨勬湰浼氳瘽鏍囩锛沗--all` 鍚叾浠栦細璇?|
| `tabs close-id <targetId>` | 鍏抽棴鏄庣‘鎸囧畾鐨勬爣绛撅紙鐢ㄦ埛瑕佹眰鍏抽棴鐢ㄦ埛鏍囩鏃舵墠鐢級 |
| `tabs close-tracked [--all]` / `cleanup [--all]` | 鍏抽棴鏈細璇濆垱寤虹殑鏍囩锛沗--all` 鍏抽棴鍏ㄩ儴杩借釜鏍囩 |
| `cleanup --keep <id,id,...>` | 鍏抽棴鍏朵粬鑷湁鏍囩骞朵繚鐣欐寚瀹氭爣绛?|

椤甸潰鍛戒护鍙檮鍔?`--target <id>` 绮剧‘閫夋嫨鐜版湁鏍囩锛涗笉鎻愪緵鍓嶅彴鍙傛暟锛堜紶 `--foreground` 浼氭姤閿欙級锛岄檮鍔?`--navigate-user-tab` 鎵嶄細鍏佽鐢?URL 瀵艰埅鐢ㄦ埛鏍囩銆傝嫢涓嶉渶瑕佸鑸紝鍦?URL 浣嶇疆浼?`-`锛屼緥濡?`click - "button.search" --target TARGET_ID`銆備笉浼?`--target` 鏃讹紝椤甸潰鍛戒护鍙鐢?URL 鐩稿悓鐨勮嚜鏈夋爣绛撅紝娌℃湁鎵嶆柊寤猴紝涓斾笉鍏抽棴鍏朵粬鏍囩銆俙tabs open` 浼犱竴涓?URL 鏃惰繑鍥炴墎骞冲璞★紙鍚?`targetId`锛夛紝浼犲涓椂杩斿洖 `{ tabs: [...] }`銆?
## 鏍囩褰掑睘涓庢竻鐞?
- 鍙湁鑴氭湰鑷繁鍒涘缓骞惰拷韪殑鏍囩浼氳娓呯悊锛岃€屼笖**榛樿鍙竻鐞嗘湰浼氳瘽 owner 鐨?*锛涚敤鎴峰凡鏈夋爣绛惧彧鍏佽璇诲彇鍒楄〃锛屾垨閫氳繃 `--target` 浣跨敤銆俙tabs list` 鏄疄鏃跺揩鐓э紝鏁伴噺鍙樺寲涔熷彲鑳芥潵鑷敤鎴疯嚜宸卞紑鍏虫爣绛撅紱鑴氭湰鍙湪鏄惧紡 `tabs close*` / `cleanup` 鏃跺叧闂爣绛俱€?- **鐢ㄦ埛鏍囩鍙兘琚祻瑙堝櫒鍐荤粨鎴栧悗鍙版寕璧?*锛堥暱鏃堕棿娌℃縺娲荤殑鏍囩甯歌锛夛細鍛戒护浼氬厛鍋?2.5 绉掓帰娲伙紝澶辫触鏃惰繑鍥炩€滄爣绛炬棤鍝嶅簲锛氬彲鑳藉凡鍐荤粨鎴栧湪鍚庡彴鎸傝捣鈥濓紝**涓嶈璇曞浘婵€娲诲畠**锛堟妧鑳芥病鏈夊墠鍙拌兘鍔涳級锛涚洿鎺?`tabs open` 鏂版爣绛鹃噸寤猴紝鎴栬鐢ㄦ埛鑷繁鐐瑰紑閭ｄ釜鏍囩锛屼笉瑕佸湪鍚屼竴涓爣绛句笂鍙嶅閲嶈瘯銆?- **`tracked=true` 涓嶇瓑浜庘€滄湰娆′换鍔″垱寤虹殑鈥?*锛氳拷韪枃浠朵細璺ㄤ細璇濈暀瀛橈紝`tabs list` 閲屽彲鑳芥寕鐫€鍒殑浼氳瘽鎴栧緢鏃╀互鍓嶇殑鏍囩銆傜湅 `owner`/`mine` 鍖哄垎锛沗cleanup` 榛樿鍙叧 `mine=true` 鐨勶紝`--all` 鎵嶄細杩炲巻鍙蹭笌鍒汉鐨勪竴璧峰叧銆?- `tabs open` 鏀寔 `file://` 鏈湴椤甸潰锛岃嚜娴嬫椂涓嶉渶瑕佸缃戙€傝矾寰勫惈涓枃鎴栫┖鏍兼椂鏁翠綋鍔犲紩鍙凤紝渚嬪 `"file:///C:/Users/Lenovo/娴嬭瘯 椤?html"`锛涜兘閬垮厤鏃朵紭鍏堢敤 ASCII 鏂囦欢鍚嶃€?- 鑴氭湰鍒涘缓鏍囩鏃惰褰曞湪绯荤粺涓存椂鐩綍涓嬨€佷互娴忚鍣ㄨ皟璇曚細璇濇爣璇嗗尯鍒嗙殑杩借釜鏂囦欢鍐咃紝鍐欏叆浣跨敤鏂囦欢閿佸拰鍘熷瓙鏇挎崲锛涗笉寰楁妸鏃х増鍏变韩杩借釜鏂囦欢閲岀殑鏍囩 ID 褰撲綔鏈細璇濊嚜鏈夋爣绛俱€?- 姣忔鎿嶄綔鍓嶅埛鏂版爣绛惧垪琛紱杩囨湡 ID 浼氭姤閿欏苟鍋滄锛屼笉浼氱寽娴嬫浛浠ｆ爣绛俱€俇RL 浣嶇疆浼?`-` 琛ㄧず涓嶅鑸綋鍓嶆爣绛俱€?- 椤甸潰鍛戒护鏈韩涓嶅叧闂换浣曟爣绛撅紱娓呯悊鍙彂鐢熷湪鏄惧紡璋冪敤 `cleanup` / `tabs close*` 鏃躲€?
## 绀轰緥

```bash
# 鍙璋冪爺锛屼竴涓爣绛捐窇鍒板簳
node scripts/cdp_executor.mjs tabs open "https://example.org"
node scripts/cdp_executor.mjs extract - --target TARGET_ID
node scripts/cdp_executor.mjs click - "a.more" --target TARGET_ID
node scripts/cdp_executor.mjs cleanup --keep TARGET_ID

# 骞惰浠诲姟锛氫竴娆″紑涓や釜鍚庡彴鏍囩
node scripts/cdp_executor.mjs tabs open "https://a.example" "https://b.example"
node scripts/cdp_executor.mjs extract - --target TAB_A
node scripts/cdp_executor.mjs extract - --target TAB_B

# 浣跨敤鐢ㄦ埛宸叉湁鏍囩锛氬彧璇诲彧鍐欙紝涓嶆柊寤恒€佷笉鍏抽棴
node scripts/cdp_executor.mjs tabs list
node scripts/cdp_executor.mjs fill - "input[name=q]" "CDP" --target USER_TAB
```

## 娴嬭瘯

鍦ㄦ妧鑳界洰褰曞唴鎵ц `node --test`锛堣嚜鍔ㄥ彂鐜?`tests/*.test.mjs`锛夈€俉indows PowerShell 涓?`tests/` 鐩綍鍙傛暟鍜?`*` 閫氶厤绗︿笉浼氳灞曞紑锛屼笉瑕佸啓鎴?`node --test tests/*.test.mjs`銆?
