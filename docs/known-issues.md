# 問題点の整理と今後の方向性

最終更新: 2026-08-29（v1.0.0-spumoni.4.1 + main `893ba4f` 時点）

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

---

## 2. 未解決

### 2.1 Wayland での外部アプリへのドラッグアウト（**アプリ側では解決不能**）

**症状**: ネイティブ Wayland（GNOME 50 で確認）で、ファイルを Nautilus 等へドラッグすると、ファイルではなく `Dragged Text-<日時>` というテキストファイルが作られる。

**検証結果**（2026-08-29、Ubuntu / GNOME Shell 50.1 / Wayland）:

| 方式 | Electron | 結果 |
|---|---|---|
| HTML5 ドラッグ + `startDrag` 同時（3.7 の実装） | 28 | ドラッグアウト NG |
| `dragstart` で `preventDefault` → `startDrag`（Electron 公式パターン） | 28 | ドラッグ自体が開始しない（内部ドロップも NG） |
| HTML5 ドラッグのみ + `text/uri-list` | 28 | 内部ドロップ OK、外部は「Dragged Text」 |
| mousedown → 6px 移動検出 → `startDrag`（Blink を経由しない） | 28 | ドラッグ自体が開始しない |
| `dragstart` → `startDrag` | 44 | ドラッグ自体が開始しない |
| `dragstart` → `startDrag`、**X11 (XWayland)** | 44 | **ドラッグアウト OK**、内部ドロップ NG（原因未特定） |

**原因**: Chromium の Wayland バックエンドは、ポインタイベント処理の内部（Blink のドラッグ開始）からしか `wl_data_device.start_drag` を発行しない。Electron の `webContents.startDrag` は IPC 経由の別コンテキストから `RunShellDrag` を呼ぶため、Wayland では無視される。一方、Web コンテンツ由来の HTML5 ドラッグは `text/uri-list` を実ファイルとして提供できない（Chromium は `SetFilenames` されたデータにしか `text/uri-list` を付けない。`setData("text/uri-list")` は URL 扱いになり `text/x-moz-url` に化ける）。したがって Wayland 上ではどちらの経路でもファイルを外部に渡せない。

**現在の実装**（main）: Linux は HTML5 ドラッグのみ（内部 D&D 動作）、Windows/macOS はネイティブ `startDrag` のみ。README に制限を明記。回避策は `npm start -- --ozone-platform=x11`。

**関連ブランチ**: `electron-upgrade`（Electron 44 化 + `webUtils.getPathForFile` + D&D 診断ログ `localStorage.dndDebug=1`）。main 未マージ。Electron 側で Wayland ドラッグが改善された際の検証用。

### 2.2 X11 でのアプリ内ドロップ失敗（原因未特定）

`electron-upgrade` ブランチ + `--ozone-platform=x11` で、ネイティブドラッグは外部には渡るが、自ウィンドウへのドロップ（同一ペイン・他ペイン）が動作しない。「`dragover`/`drop` が自ウィンドウに配送されていない」のか「内部状態が先に消えている」のかが未確定。診断ログは仕込み済みだが採取していない。

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
| 保守 | レガシー `copy-item` / `move-item` が未使用のまま残存 / `package.json` の `bugs`・`homepage` と `LICENSES-THIRD-PARTY.md` が削除済みの `compiledkernel-idk/prism-fm` を指す |

---

## 3. ロギングの現状評価

**2026-08-29 追記: 下記「推奨する最小構成」を main に実装済み（CHANGELOG Unreleased 参照）。以下は実装前の評価。**

**結論（実装前）: 障害調査に必要なログは取れていない。** 今回の D&D 調査で DevTools のコンソールを毎回手で見てもらう必要があったのはこのため。

| 項目 | 現状 | 問題 |
|---|---|---|
| main プロセスの出力先 | `console.error` のみ（`logCommandFailure` 5 箇所） | ファイルに残らない。`npm start` ではターミナルにも出ない場合がある |
| レンダラーの出力先 | `console.log/warn/error` 15 箇所 | `--enable-logging`（`npm run dev`）か DevTools でしか見えない |
| 未捕捉例外 | main: `process.on("uncaughtException")` なし / renderer: `window.onerror`・`unhandledrejection` なし | クラッシュ・非同期エラーが記録されない |
| プロセス異常終了 | `app.on("render-process-gone")`・`child-process-gone` なし | レンダラー/GPU クラッシュの記録なし |
| デバッグ用ログ | `[ui] new-folder-btn clicked` 等の開発時ログが本番に残存 | ノイズ。一方で D&D・ファイル操作・ナビゲーションのログは無い |
| ログレベル | なし | 詳細ログを出す手段がない（`electron-upgrade` の `dndDebug` は暫定） |
| ログ収集手順 | `npm run dev` のみ | ユーザーに「DevTools を開いて Console をコピー」を依頼する必要がある |

**推奨する最小構成**:
1. main に軽量ロガー（`app.getPath("logs")/prism-fm.log`、サイズローテーション、`PRISM_LOG=debug` でレベル切替）
2. renderer の `console.*` と `window.onerror` / `unhandledrejection` を IPC でロガーに転送
3. `process.on("uncaughtException" / "unhandledRejection")`、`app.on("render-process-gone" / "child-process-gone")` を記録
4. ファイル操作（batch-file-operation の開始/終了/エラー）、ナビゲーション、D&D（開始・dragenter・drop・cleanup）に debug ログ
5. Customize ダイアログに「ログフォルダを開く」ボタン
6. 開発時の `[ui] ... clicked` ログは削除

---

## 4. 今後の方向性（選択肢）

### A. 現状で確定し、Wayland のドラッグアウトは制限事項とする
- 作業: なし（README/CHANGELOG 記載済み）
- 利点: 追加の検証負担なし。内部 D&D・外部からのドロップ・ファイル操作は動作
- 欠点: Wayland ユーザーは外部へのドラッグアウトができない

### B. ロギング基盤を整備してから、X11 の内部ドロップ不良を追う
- 作業: 上記 3 の 1〜6 を実装（1 コミット）→ ユーザーは `PRISM_LOG=debug npm start -- --ozone-platform=x11` で操作 → ログファイルを送るだけ
- 利点: 今後の障害調査全般が「ログファイルを送る」だけで済む。X11 内部ドロップが直れば「Linux は X11 既定」という選択肢が成立し、ドラッグアウトも内部 D&D も両立
- 欠点: XWayland では HiDPI のフラクショナルスケーリングでにじみが出る可能性。透過/ぼかしは X11 でも動作するが要確認

### C. Electron を 44 に更新（`electron-upgrade` を main へ）
- 作業: ブランチをマージ、electron-builder の対応確認、3 OS でビルド確認
- 利点: セキュリティ更新、`File.path` 廃止など将来の互換性への対応が済む
- 欠点: Wayland のドラッグアウトは直らない（確認済み）。ビルド/配布の検証負担
- 備考: B と組み合わせ可能。A/B とは独立の判断

### D. Electron / Chromium へ upstream 報告
- 作業: `webContents.startDrag` が Wayland で無視される最小再現を作成して報告
- 利点: 根本解決の可能性
- 欠点: 時期不明。既存 issue の有無を要確認

### E. Low 項目の一括対応
- 作業: 2.4 のうちパフォーマンス 3 件、`package.json` の URL 修正、レガシー IPC 削除、`cached.ts` 修正（1 コミット）
- 利点: 小さくリスクも低い
- 欠点: 体感できる改善は限定的

**推奨**: **B**（ロギング整備）を先に行う。理由は、今回の調査で「ログが取れない」ことが最大のボトルネックだったこと、および X11 内部ドロップの原因特定にそのまま使えること。B の結果次第で A（Wayland 既定のまま制限明記）か「Linux は X11 既定」かを決め、C と E は任意のタイミングで実施。
