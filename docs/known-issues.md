# 問題点の整理と今後の方向性

最終更新: 2026-08-29（v1.0.0-spumoni.4.1 + main `f6d35f4` 時点）

本書は 2026-08-29 に実施したコード監査（main.js のファイル操作、レンダラーの操作フロー、GUI）と、その後の修正・検証で判明した事項をまとめたもの。監査時の指摘は High/Medium/Low で分類し、対応状況を記す。

---

## 1. 対応済み（4.0 / 4.1 / main）

### 1.1 データ消失につながる不具合（High）

| 問題 | 対応 | バージョン |
|---|---|---|
| 貼り付けで自分自身/子孫フォルダへ移動・コピーすると無限再帰でディスクを消費 | `buildTransferItems()` で拒否、main 側 `batch-file-operation` でも `path.relative` で拒否 | 4.0 |
| Copy/Move の Undo が競合解決（Skip/Replace/Keep Both）を無視し、既存ファイルを削除 | main が実際の `completedItems`（最終 dest・replaced フラグ）を返し、それだけを Undo 対象に | 4.0 |
| `performUndo` が未定義で Undo が動作しない | 実装（操作キュー経由）、Ctrl+Z にバインド | 4.0 |
| `delete-item-sudo` のシェルインジェクション（root 権限） | `spawn("sudo", [...])` に変更 | 4.0 |
| Rename で既存ファイルを無警告上書き | main 側で存在チェック・名前検証 | 4.0 |
| Ctrl+A が非表示ファイルも選択 → Delete で消える | 表示中の項目のみ選択 | 4.0 |
| dest がシンボリックリンクのとき「Replace」がリンク先を破壊 | Replace 時に dest を `fs.rm` してからコピー | 4.1 |
| 分割ビューで Back/Forward すると旧ディレクトリを描画 | `navigateHistory()` に統合、pane 更新後に描画 | 4.1 |

### 1.2 GUI の機能停止・不整合（High/Medium）

| 問題 | 対応 | バージョン |
|---|---|---|
| `clamp` 未定義でサイドバー/プレビューのリサイズ不可 | 定義追加 | 4.0 |
| `window.api.getItemInfo` 未定義で外部フォルダのピン留め失敗 | `window.fileManager` に修正 | 4.0 |
| `getImageDataUri` が preload に無い | IPC 追加（20MB 上限） | 4.0 |
| Operations パネルがスタブで Cancel が呼べない | 本実装（Cancel/Pause/履歴）。**4.0 ではスタブが本実装を上書きしており未動作、4.1 で修正** | 4.0→4.1 |
| `processOperationQueue` が `onError` を呼ばず失敗通知が出ない | 修正 | 4.0 |
| モーダル表示中・キーリピート時のショートカット多重発火 | `isModalOpen()` と `e.repeat` ガード | 4.0 |
| `navigateTo` / `ensurePaneLoaded` / プレビュー / ドライブ一覧に世代ガードがなく遅延応答が上書き | 世代トークン導入 | 4.1 |
| refresh 後に選択ハイライトが残留、`currentItems` が古い配列を指す | 描画前にクリア、`refreshPane` で同期 | 4.1 |
| 操作完了後の refresh がアクティブペインを更新（対象ペインではない） | `refreshPanesShowing()` | 4.1 |
| Linux で右クリックのたびにコンテキストメニューが 2 回構築 | `contextmenu` のみに統一 | 4.1 |
| 複数選択の 1 つに残りをドロップすると中へ移動 | 拒否 | 4.1 |
| macOS のコピー修飾キーが Ctrl 固定 | Option に（`isCopyModifier()`） | 4.1 |
| Cmd+Q で操作中の終了確認が出ない | `before-quit` でも確認 | 4.1 |
| 進捗バーが次の操作開始 700ms 以内に消える | タイマーをキャンセル | 4.0 |
| Wayland で起動時 SIGSEGV（v3.5 以降） | `screen.getCursorScreenPoint()` を Wayland では回避 | main |
| `npm start` が SUID sandbox エラーで中断（Ubuntu 24.04+） | 起動スクリプトで `--no-sandbox` を付与 | main |
| コンテキストメニューのサブメニュー（New ▸ File/Folder）が表示されない（3.6 以降） | `.context-menu` の `overflow-y: auto` がサブメニューをクリップしていた。スクロールを `.context-menu-panel` に移動。位置も開いた行に揃える | main |

### 1.3 ファイル操作の信頼性（Medium）

| 問題 | 対応 | バージョン |
|---|---|---|
| ディレクトリ「Replace」が実際はマージ | Replace 時に既存 dest を削除 | 4.1 |
| move の rename 失敗理由を見ずにコピー+削除にフォールバック | `EXDEV` のみフォールバック | 4.1 |
| 同一デバイス move にも容量チェック | `stat().dev` 比較で別デバイス分のみ集計 | 4.1 |
| キャンセル時の部分ファイル残置 | `streamCopy` で削除、`close` 待ち | 4.1 |
| 1 ファイル失敗でディレクトリ全体を放棄 | `allSettled`、子単位で継続。move は失敗があればソース保持 | 4.1 |
| 競合ダイアログの応答待ちで永久 pending | cancel/ウィンドウ破棄時に自動 cancel | 4.1 |
| `create-folder` の空名で `parent (1)` | 名前検証 | 4.1 |
| `extract-archive` が既存フォルダへ上書き展開、maxBuffer 1MB で SIGTERM | ユニーク名、`-bso0 -bsp0`、64MB | 4.1 |
| `compress-items` が既存アーカイブに追記、`-x`/`@list` 名を誤解釈 | 既存拒否、`--` 区切り | 4.1 |
| Cut 直後のクリップボードクリア | 成功後にクリア | 4.1 |

### 1.4 基盤

| 項目 | 内容 | バージョン |
|---|---|---|
| Electron 28 → 44 | 28 は 2024 年 6 月にサポート終了。`File.path` 廃止に対応（`webUtils.getPathForFile`）。Wayland/X11 起動、`electron-builder --linux --dir`（builder 24.13.3）、パッケージ済みバイナリ起動を確認。Windows/macOS ビルドは未検証 | main |
| Move on drag-out | ドラッグアウト後、`$HOME` とマウント済みボリュームを `find -xdev`（深さ 6、隠しディレクトリ/`node_modules` 除外、ボリュームごと 15 秒上限）で同名・新規作成のファイル/フォルダを探し、サイズ→SHA-256（フォルダは再帰）で一致を検証してから元を**ゴミ箱**へ。コピー進行中はサイズ安定まで待機（最大 5 分）。候補なしは 20 秒で終了し何もしない。Ctrl/Option ドラッグと設定 OFF では無効。**FUSE/ネットワークマウント（例: rclone の GoogleDrive）が `$HOME` 直下にあると `-xdev` なしでは探索が数分かかる**ため `-xdev` は必須 | main |
| ロギング基盤 | ファイルログ（`app.getPath("logs")/prism-fm.log`、5MB×3 ローテーション）、`PRISM_LOG=debug` / Customize の「Debug log」トグル、IPC 自動計測、ファイル操作内部・操作キュー・競合ダイアログ・ナビゲーション・D&D・ユーザー操作の記録、renderer の console/例外転送、`uncaughtException`/`render-process-gone` 等の捕捉、「Open Log Folder」ボタン。詳細は §3 | main |
| 起動スクリプト | `--ozone-platform=` の明示指定を優先、グローバル electron が無ければプロジェクト内のものを使用 | main |

---

## 2. 未解決

### 2.1 外部アプリへのドラッグアウト（**解決済み・2026-08-29 追記**）

以前の「Wayland では `startDrag` が無視される」という結論は**誤り**だった。ロギング導入後の検証で、Wayland でも `startDrag` はドロップまでブロックして正常にセッションを実行しており（Chromium の `LOG(ERROR)` なし、`startDrag returned after 1647ms`）、外部アプリへのファイル受け渡しも成功していた。

**真の原因（アプリ内ドロップが動かなかった理由）**: `startDrag` は copy/link しか許可しないのに、`dragover` が `dropEffect = "move"` を要求していた。Blink はこれを「ドロップ拒否」と解釈し `drop` を発火しない。`chooseDropEffect()` で `effectAllowed` の範囲内に制限して解決。Linux の既定はネイティブドラッグ（`PRISM_NATIVE_DRAG=0` で HTML5）。

**残る制限**: 受け取り側は常に「コピー」（Electron #7207、クローズ済み）。対策として「Move on drag-out」（§1.4 参照）を実装。検証マトリクスは履歴として下に残す。

| 方式 | Electron | 結果（当時の観測） | 後日の解釈 |
|---|---|---|---|
| `dragstart` → `preventDefault` → `startDrag` | 28/44 | 内部ドロップ NG、外部 NG | 内部は dropEffect の問題。外部 NG はドラッグアイコンが出ず「何も起きない」と見えていた可能性 |
| HTML5 のみ + `text/uri-list` | 28/44 | 内部 OK、外部はテキスト | Chromium Wayland は `text/uri-list` を実ファイル名にしか付けない（事実） |

### 2.2 X11 でのアプリ内ドロップ失敗（**解決済み**）

原因は 2.1 と同じ（`dropEffect: "move"`）。

### 2.3 Windows / macOS のドラッグアウト（未検証）

Electron 公式パターン（`dragstart` + `preventDefault` + `startDrag`）を実装済みだが、テスト環境が Linux のみのため未確認。3.1 で「`dragstart` 内の `startDrag` でクラッシュ」の記録があり、現在の実装（HTML5 セッションを開始しない）で解消しているかは実機確認が必要。

### 2.4 残りの Low

| 領域 | 問題 |
|---|---|
| 選択 | Shift+クリックのアンカーが DOM にない場合 0 番目から範囲選択 |
| パフォーマンス | サムネイル IntersectionObserver が再描画で旧要素を保持 / サイズソート時にフォルダごとに全再描画 / `saveWindowBounds` が resize ごとに同期 I/O |
| 表示 | `getFolderSizeCell` が存在しない `cached.ts` を参照（常に「—」→ 再取得でちらつき） |
| main.js | `get-directory-contents` でディレクトリへのシンボリックリンクが `isDirectory=false` / Windows の `fs.symlink` に type 未指定 / 外部ドライブの `.Trash-<uid>` 非対応 / `df` フォールバックのシェル補間 / Windows 11 24H2 で `wmic` 廃止 |
| Undo | 非 Linux でゴミ箱 Undo メニューが出るが必ず失敗 |
| IPC | `onFileConflict` の解除が `removeAllListeners` / `resolveFileConflict` の引数名が `operationId`（実体は resolveId） |
| 表示更新 | ディレクトリ監視（`fs.watch` / chokidar）が無く、外部で行われた変更（他アプリでの移動・削除・作成、X11 でのドラッグアウト後の移動など）が Ctrl+R か次のナビゲーションまで反映されない。表示中のペインのディレクトリのみ監視し、デバウンス付きで `refreshPanesShowing()` を呼ぶ形が候補 |
| 起動 | 同じディレクトリの `get-directory-contents` が起動時に 3 回呼ばれる（`navigateTo` と `ensurePaneLoaded` の重複。ログで確認） |
| 保守 | レガシー `copy-item` / `move-item` が未使用のまま残存 / `package.json` の `bugs`・`homepage` と `LICENSES-THIRD-PARTY.md` が削除済みの `compiledkernel-idk/prism-fm` を指す |
| 検証 | Windows / macOS: Electron 44 でのビルド・起動・ドラッグアウト（`dragstart` + `startDrag`）が未検証 |

---

## 3. ロギング（実装済み）

### 3.1 取得方法

| 方法 | 内容 |
|---|---|
| ログファイル | Linux `~/.config/prism-fm/logs/prism-fm.log` / Windows `%APPDATA%\prism-fm\logs\` / macOS `~/Library/Logs/prism-fm/`。5MB で `.1` `.2` にローテーション |
| レベル | `error / warn / info / debug`。優先順: 環境変数 `PRISM_LOG` > `<userData>/logging.json`（UI から保存）> 既定 `info` |
| UI | Customize ダイアログのヘッダ: **Open Log Folder** ボタン、**Debug log** トグル（即時反映・永続化） |
| ターミナル | ファイルと同じ行を `npm start` の標準出力にも出力 |

### 3.2 記録される内容

| 分類 | レベル | 内容 |
|---|---|---|
| 起動 | info | バージョン、Electron/Chromium/Node、OS、Wayland/X11、引数、ログレベル、ログファイルパス |
| IPC（自動計測） | info: ファイル操作・マウント・端末・キャンセル / debug: その他 | チャネルごとに `←` 引数（長い配列は件数＋先頭 5、`password` 等は redacted）と `→ Nms` 結果（success/error/code/completed/skipped/errors 件数など）。`success:false` は warn、例外は error |
| ファイル操作内部（`[fileop:<opId>]`） | info/debug | スキャン結果、容量チェック、自己参照の拒否、競合ダイアログの提示と回答、skip、replace 時の既存削除、クロスデバイス移動、項目ごとの所要時間、子エラー、完了サマリ、キャンセル |
| 削除（`[delete:<opId>]`） | info/warn | 件数、削除できなかったパスと理由 |
| 操作キュー（`[renderer:ops]`） | info | queued / start / completed / failed / cancelled と所要時間・結果件数、cancel 要求、`onSuccess`/`onError` 内の例外 |
| Undo | info/debug | push / perform |
| 競合ダイアログ（`[renderer:conflict]`） | info | 提示（ファイル・dest・opId）と選択（action・applyToAll） |
| ナビゲーション（`[renderer:nav]`） | debug/warn | `navigateTo` の path・所要時間・件数、stale 応答の破棄、失敗 |
| D&D（`[renderer:dnd]`） | debug | dragstart（native/HTML5、件数、ペイン）、dragenter、drop（isDragging・draggedItems・files・MIME types）、cleanup の呼び出し元、`drag-ended`、`startDrag` の復帰時間 |
| ユーザー操作（`[renderer:action]`） | info | paste/drop の判定（受理・拒否件数）、delete、rename、new folder/file |
| 通知 | debug / warn(error 通知) | 表示したメッセージ |
| 例外 | error | renderer: `console.error`、`window.onerror`、`unhandledrejection` / main: `uncaughtException`、`unhandledRejection`、`render-process-gone`、`child-process-gone`（理由・exitCode） |
| 外部コマンド | error | 失敗したコマンドと stderr/stdout |

### 3.3 不具合報告の手順

1. Customize → **Debug log** を ON（または `PRISM_LOG=debug npm start`）
2. 問題を再現
3. Customize → **Open Log Folder** → `prism-fm.log` を添付

---

## 4. 今後の方向性（選択肢）

B（ロギング）と C（Electron 44）は実施済み。残る選択肢:

### A. 現状で確定（Wayland のドラッグアウトは制限事項）
- 作業: なし。README/CHANGELOG に記載済み
- Wayland ユーザーは外部へのドラッグアウト不可、他は動作

### B'. X11 の内部ドロップ不良を追い、「Linux は X11 既定」を検討
- 作業: §2.2 の手順でログ採取 → 原因修正 → 起動スクリプトで Linux 既定を X11 に（Wayland は明示指定で可）
- 利点: ドラッグアウトと内部 D&D の両立
- 懸念: XWayland では HiDPI のフラクショナルスケーリングでにじみ。透過/ぼかしの見え方も要確認

### D. Electron / Chromium へ upstream 報告
- `webContents.startDrag` が Wayland で無視される最小再現（素の Electron + `dragstart` → `startDrag`）を作成して報告。既存 issue の確認から

### E. Low 項目の一括対応
- §2.4 のうち: 起動時の 3 重ロード、パフォーマンス 3 件、`cached.ts`、`package.json` の URL、レガシー IPC 削除（1 コミット規模）

### F. 4.2 リリース
- main の Unreleased（Wayland 起動修正、サンドボックス、D&D 整理、サブメニュー、Electron 44、ロギング）をまとめて `1.0.0-spumoni.4.2` として tag/push

**推奨**: F を先に行い（Wayland 起動クラッシュとサブメニュー不可はユーザー影響が大きい）、その後 E → 必要に応じて B'。
