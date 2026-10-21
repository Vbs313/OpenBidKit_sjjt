# Inno Setup 6 安装脚本（Windows）

本目录是 Windows 安装器的 Inno Setup 6 脚本与语言文件，属于 Inno Setup 迁移的过渡实现；
NSIS / MSI 构建路径在迁移验收前保持不变。

## 文件

| 文件 | 说明 |
|---|---|
| setup.iss | 主安装脚本；UTF-8 无 BOM，CRLF；per-user 安装（无需管理员） |
| ChineseSimplified.isl | 官方简体中文语言文件（Inno Setup 6.5.0+） |

## 语言文件来源

- 来源：https://github.com/jrsoftware/issrc/blob/main/Files/Languages/ChineseSimplified.isl
- 原始下载：https://raw.githubusercontent.com/jrsoftware/issrc/refs/heads/main/Files/Languages/ChineseSimplified.isl
- 维护者：Zhenghan Yang（见 jrsoftware.org/files/istrans/ 官方翻译列表）
- 说明：Inno Setup 6.7.3 自带语言包（29 个）不含中文，故随仓库 vendor；文件内容未修改。
- 升级：Inno Setup 升级后重新对照上游文件，保持一致。

## 编译

~~~powershell
$iscc = "$env:LOCALAPPDATA\Programs\Inno Setup 6\ISCC.exe"
& $iscc client\build\installer\inno\setup.iss /DMyAppVersion=0.1.0
~~~

产物：client/release/inno/数据集团工具箱-Setup-{version}.exe

## 前置

- 需要 client/release/win-unpacked（electron-builder 打包产物）；
- 本机 Inno Setup 6.7.3 安装在 %LOCALAPPDATA%\Programs\Inno Setup 6\；
- 暂无代码签名证书，产出为 unsigned。
