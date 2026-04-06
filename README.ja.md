# Prism FM

Electron を利用した、軽量で透過対応のファイルマネージャー。Linux、Windows、macOS に対応しています。

[English README](README.md)

> 本プロジェクトは [compiledkernel-idk/prism-fm](https://github.com/compiledkernel-idk/prism-fm) のフォークです。コミット履歴とコードベースの分析から、prism-fm は [TechyTechster/ez-fm](https://github.com/TechyTechster/ez-fm) をフォークし、名前を変更して公開されたものと思われます。
>
> オリジナルの ez-fm を開発された **TechyTechster** 氏、そして prism-fm として公開・メンテナンスされた **compiledkernel-idk** 氏の両者に心より感謝いたします。洗練されたアーキテクチャと丁寧な設計のおかげで、クロスプラットフォーム対応のファイルマネージャーへと発展させることができました。オープンソースコミュニティへの貢献に深く御礼申し上げます。

![Preview](file-manager.png)

## 最近の変更

完全な変更履歴は [CHANGELOG.md](CHANGELOG.md) を参照してください。

### v1.0.0-spumoni.3.8

- ファイル操作の信頼性向上：個別エラースキップ、シンボリックリンク対応、移動検証、ディスク容量チェック
- 大きいファイル（100MB以上）のストリームコピーによる滑らかな進捗表示、小ファイルの並列コピー（6並列）
- バッチ削除のプログレスバーとキャンセル対応
- コピー時のパーミッションとタイムスタンプの保持
- カスタマイズダイアログにバージョン表示
- ファイル操作中のアプリ終了時に確認ダイアログ表示

### v1.0.0-spumoni.3.7

- PDF・動画のサムネイル表示（macOS: qlmanage、Linux: pdftoppm/ffmpeg）
- プレビューペインでの PDF・動画プレビュー
- コピー・移動時のファイル競合ダイアログ（上書き、スキップ、両方保持、すべてに適用）
- プレビューペインのツールバーボタン
- 隠しファイルの半透明表示
- Linux ドラッグアウト修正、日付列幅の修正
- 設定メニューにフォルダ設定全リセットオプション追加

## 機能

- **透過 UI**: Hyprland、Sway などのモダンなコンポジターやデスクトップ環境とシームレスに統合
- **デュアルペインナビゲーション**: 左右分割ビューによる効率的なファイル管理
- **基本操作**: コピー、移動、削除、リネーム、アーカイブ操作（展開・圧縮のみ対応。アーカイブ内のブラウジングは非対応）
- **ドラッグ＆ドロップ**: 外部アプリへのネイティブドラッグ、外部からのドロップによるコピー、ペイン間のドラッグで移動（Ctrl キーでコピー）
- **プレビュー**: 画像、PDF、動画、テキストの統合プレビュー（サムネイル自動生成）
- **タグ**: カラーコード付きタグによるファイル整理
- **プロパティ**: OS 固有の情報（Windows 属性、POSIX パーミッション）を表示するプロパティダイアログ
- **ターミナル連携**: 11種類のプリセット付きターミナルエミュレーター設定。ツールバーまたはコンテキストメニューから起動
- **テーマカスタマイザー**: プリセット（Default Glass、Nord Frost、Amber Glow、Forest Mist、Light Frost）と Wal テーマインポート対応のテーマエディタ
- **XDG 連携**: システム全体のディレクトリピッカーとして機能（Linux）

## インストール

```bash
git clone https://github.com/fukuyori/prism-fm.git
cd prism-fm
npm install
```

### ビルド

**ワンステップビルド（パッケージ + インストーラー）:**

```bash
npm run build          # 現在のプラットフォーム（自動検出）
npm run build:win      # Windows（NSIS インストーラー）
npm run build:mac      # macOS（DMG）
npm run build:linux    # Linux（AppImage + deb）
```

**2ステップビルド（コード署名用）:**

```bash
# ステップ 1: 実行ファイルのパッケージ化
npm run build:win:pack      # -> dist/win-unpacked/prism-fm.exe
npm run build:mac:pack      # -> dist/mac/prism-fm.app（または dist/mac-arm64/）
npm run build:linux:pack    # -> dist/linux-unpacked/prism-fm

# ステップ 2: バイナリの署名（プラットフォーム固有）
# Windows:  signtool sign /f cert.pfx dist/win-unpacked/prism-fm.exe
# macOS:    codesign --deep --force --sign "Developer ID" dist/mac/prism-fm.app

# ステップ 3: 署名済みバイナリからインストーラーを作成
npm run build:win:installer      # -> dist/prism-fm-<version>-x64.exe
npm run build:mac:installer      # -> dist/prism-fm-<version>.dmg
npm run build:linux:installer    # -> dist/prism-fm-<version>.AppImage + .deb
```

### 依存関係

**Arch Linux:**

```bash
sudo pacman -S nodejs npm electron
```

**Debian / Ubuntu:**

```bash
sudo apt install nodejs npm
sudo npm install -g electron
```

**Fedora:**

```bash
sudo dnf install nodejs npm
sudo npm install -g electron
```

## 使い方

ターミナルまたはアプリケーションメニューから起動:

```bash
prism-fm [パス]
```

### キーバインド

| キー | 動作 |
| :--- | :--- |
| `Ctrl+C` / `Ctrl+V` | コピー / 貼り付け |
| `Ctrl+X` | 切り取り |
| `F2` | 名前変更 |
| `Del` / `Shift+Del` | ゴミ箱 / 完全削除 |
| `Ctrl+T` / `Ctrl+W` | 新しいタブ / タブを閉じる |
| `Ctrl+L` | パスバーにフォーカス |
| `Ctrl+H` | 隠しファイルの表示切替 |
| `F12` / `Ctrl+Shift+I` | 開発者ツール |

## 設定

設定は `~/.config/prism-fm/`（Linux/macOS）または `%APPDATA%\prism-fm\`（Windows）に保存されます。

**コンポジター設定（Hyprland）:**

```ini
layerrule = blur,class:prism-fm
windowrulev2 = opacity 0.9 0.8,class:^(prism-fm)$
```

## ライセンス

本フォークは [GPL-3.0](LICENSE) でライセンスされています。

オリジナルの ez-fm（TechyTechster 氏作）/ prism-fm（compiledkernel-idk 氏作）は MIT ライセンスです。本フォークにはアーカイブ操作用の [7za バイナリ](https://www.7-zip.org/)（LGPL-2.1）がバンドルされています。

サードパーティライセンスの詳細は [LICENSES-THIRD-PARTY.md](LICENSES-THIRD-PARTY.md) を参照してください。
