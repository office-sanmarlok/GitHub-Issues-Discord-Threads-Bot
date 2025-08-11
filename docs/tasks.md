# Implementation Plan

## GitHub コメント同期機能の実装タスク

- [ ] 1. EnhancedStore にコメントマッピング管理機能を追加
  - EnhancedStore.ts に findCommentByGitId, updateCommentMapping, removeCommentMapping メソッドを実装
  - 各メソッドの型定義を追加
  - メソッドは Thread の comments 配列を操作する
  - _Requirements: 1.4, 2.2, 3.3_

- [ ] 2. EnhancedStore の単体テストを作成
  - [ ] 2.1 findCommentByGitId のテストケースを作成
    - 存在するコメントの検索テスト
    - 存在しないコメントの検索テスト
    - 空の comments 配列でのテスト
    - _Requirements: 3.1_
  
  - [ ] 2.2 updateCommentMapping のテストケースを作成
    - 既存マッピングの更新テスト
    - 存在しないマッピングの更新テスト
    - _Requirements: 1.4, 3.3_
  
  - [ ] 2.3 removeCommentMapping のテストケースを作成
    - マッピングの削除成功テスト
    - 存在しないマッピングの削除テスト
    - _Requirements: 2.2_

- [ ] 3. DiscordActions にメッセージ削除機能を実装
  - deleteMessage メソッドを DiscordActions.ts に追加
  - Discord API を使用してメッセージを削除
  - エラーハンドリングとログ出力を含める
  - 削除成功/失敗を boolean で返す
  - _Requirements: 1.2, 2.1, 4.1_

- [ ] 4. DiscordActions.deleteMessage の単体テストを作成
  - [ ] 4.1 正常系のテストケース
    - メッセージ削除成功のモックテスト
    - 適切なログ出力の確認
    - _Requirements: 2.1_
  
  - [ ] 4.2 異常系のテストケース
    - メッセージが見つからない場合のテスト
    - Discord API エラーのテスト
    - 権限不足エラーのテスト
    - _Requirements: 4.4, 4.5_

- [ ] 5. GitHubWebhookHandlers にコメント編集処理を実装
  - [ ] 5.1 handleIssueCommentEdited メソッドの基本実装
    - Webhook payload の検証
    - スレッドとコメントマッピングの検索
    - _Requirements: 1.1, 1.5_
  
  - [ ] 5.2 メッセージ置き換えロジックの実装
    - 元のメッセージを削除
    - 新しいメッセージを createComment で投稿
    - マッピングを updateCommentMapping で更新
    - _Requirements: 1.2, 1.3, 1.4_
  
  - [ ] 5.3 エラーハンドリングの実装
    - 削除失敗時のフォールバック処理
    - 適切なログ出力
    - _Requirements: 1.5, 4.5_

- [ ] 6. GitHubWebhookHandlers にコメント削除処理を実装
  - [ ] 6.1 handleIssueCommentDeleted メソッドの基本実装
    - Webhook payload の検証
    - スレッドとコメントマッピングの検索
    - _Requirements: 2.1, 2.3_
  
  - [ ] 6.2 メッセージ削除ロジックの実装
    - deleteMessage を呼び出してメッセージ削除
    - removeCommentMapping でマッピング削除
    - _Requirements: 2.1, 2.2_
  
  - [ ] 6.3 エラーハンドリングの実装
    - 削除失敗時のログ記録
    - マッピングが見つからない場合の処理
    - _Requirements: 2.3, 2.4, 4.5_

- [ ] 7. WebhookHandlers の単体テストを作成
  - [ ] 7.1 handleIssueCommentEdited のテスト
    - 正常な編集処理のテスト
    - スレッドが見つからない場合のテスト
    - マッピングが見つからない場合のテスト
    - 削除失敗時のフォールバックテスト
    - _Requirements: 1.1, 1.2, 1.5_
  
  - [ ] 7.2 handleIssueCommentDeleted のテスト
    - 正常な削除処理のテスト
    - スレッドが見つからない場合のテスト
    - マッピングが見つからない場合のテスト
    - 削除失敗時のエラー処理テスト
    - _Requirements: 2.1, 2.3, 2.4_

- [ ] 8. リトライメカニズムの実装
  - [ ] 8.1 RetryHelper ユーティリティクラスの作成
    - 指数バックオフ付きリトライロジック
    - 最大リトライ回数の設定
    - _Requirements: 4.1_
  
  - [ ] 8.2 DiscordActions.deleteMessage にリトライを適用
    - RetryHelper を使用した削除処理のラップ
    - レート制限エラーの特別処理
    - _Requirements: 4.1, 4.2_

- [ ] 9. 統合テストの作成
  - [ ] 9.1 コメント編集の E2E フローテスト
    - Mock Webhook → DiscordActions → Store の連携テスト
    - メッセージの削除と新規作成の確認
    - マッピング更新の確認
    - _Requirements: 1.1, 1.2, 1.4, 5.1_
  
  - [ ] 9.2 コメント削除の E2E フローテスト
    - Mock Webhook → DiscordActions → Store の連携テスト
    - メッセージ削除の確認
    - マッピング削除の確認
    - _Requirements: 2.1, 2.2, 5.1_

- [ ] 10. メトリクス収集の実装
  - [ ] 10.1 同期処理のメトリクス記録
    - 処理時間の測定コードを追加
    - 成功/失敗カウントの記録
    - _Requirements: 6.1, 6.4_
  
  - [ ] 10.2 ログ出力の改善
    - 構造化ログの実装
    - 適切なログレベルの設定
    - _Requirements: 6.1, 6.2, 6.3, 6.5_

- [ ] 11. メモリ管理の最適化
  - EnhancedStore に古いマッピングのクリーンアップ機能を追加
  - 定期的なクリーンアップのスケジューリング
  - メモリ使用量の監視
  - _Requirements: 5.4_

- [ ] 12. 全機能の結合と最終テスト
  - [ ] 12.1 Webhook イベントハンドラーへの統合
    - index.ts の setupWebhookHandlers で edited/deleted イベントを登録
    - 適切なハンドラーメソッドへのルーティング
    - _Requirements: 1.1, 2.1_
  
  - [ ] 12.2 動作確認用の統合テスト
    - 実際の Webhook payload での動作確認
    - エラーケースの動作確認
    - パフォーマンス要件の確認
    - _Requirements: 5.1, 5.2_