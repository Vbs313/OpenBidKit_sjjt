; 数据集团工具箱 — Inno Setup 6 安装脚本
; 编码要求：UTF-8 无 BOM；行尾 CRLF
; 编译：ISCC.exe setup.iss /DMyAppVersion=<version>

#define MyAppName "数据集团工具箱"
#define MyAppPublisher "数据集团"
#define MyAppExeName "数据集团工具箱.exe"

[Setup]
AppId={{3316B38E-B072-4911-8C12-7679B5C2B941}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={localappdata}\数据集团工具箱
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
; 说明：Inno 6.7 起 x64 已弃用（会被替换为 x64os），评审时可改为 x64compatible；本版按迁移规格保留 x64
ArchitecturesAllowed=x64
ArchitecturesInstallIn64BitMode=x64
OutputDir=..\..\..\release\inno
OutputBaseFilename=数据集团工具箱-Setup-{#MyAppVersion}
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
SetupIconFile=..\..\..\assets\icon.ico
UninstallDisplayIcon={app}\{#MyAppExeName}
VersionInfoCompany={#MyAppPublisher}
VersionInfoDescription={#MyAppName} 安装程序
VersionInfoCopyright=Copyright (C) 2025-2026 mark / yibiaoai; Copyright (C) 2025-2026 数据集团
; 代码签名：阶段 0 未发现可用证书，暂不启用；启用时取消下一行注释并配置 /Ssigntool
; SignTool=signtool

[Languages]
; 官方语言文件不在 Inno 6.7.3 自带包内，已 vendor 到本目录（来源见 README.md）
Name: "chinesesimplified"; MessagesFile: "ChineseSimplified.isl"

[Tasks]
Name: "desktopicon"; Description: "创建桌面快捷方式"; GroupDescription: "附加任务:"; Flags: unchecked

[Files]
Source: "..\..\..\release\win-unpacked\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{autoprograms}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "启动 {#MyAppName}"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
Type: filesandordirs; Name: "{app}"
