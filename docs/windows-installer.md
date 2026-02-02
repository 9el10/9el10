# Windows 安装包制作（Electron）

本项目使用 SVG 图标源文件，并在构建时自动生成 Windows 所需的 PNG/ICO。

## 准备工作

1. 安装 Node.js（建议 18+）。
2. 在项目根目录执行依赖安装：

```bash
npm install
```

## 本地预览

```bash
npm run start
```

## 生成安装包

```bash
npm run dist
```

产物将输出到 `dist/` 目录中，例如：

- `Stagecraft Audio Console Setup.exe`

将该安装文件拷贝到其他 Windows 电脑即可直接安装使用。

## 图标与生成脚本

- 源文件：`assets/icon.svg`
- 自动生成脚本：`scripts/build-icons.js`
- 生成位置：`assets/generated/icon.png` 与 `assets/generated/icon.ico`

生成目录已加入 `.gitignore`，不会提交二进制文件。
