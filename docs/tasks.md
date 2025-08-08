# Discord コマンド機能 実装タスク

## 実装タスクリスト

- [ ] 1. コマンド基盤の構築
  - [ ] 1.1 BaseCommand 抽象クラスの作成
    - src/commands/BaseCommand.ts を作成
    - execute メソッド、エラーハンドリング、レスポンス送信の共通実装
    - _要件: 4, 6_
  
  - [ ] 1.2 CommandManager クラスの実装
    - src/commands/CommandManager.ts を作成
    - スラッシュコマンドの登録メソッドを実装
    - プレフィックスコマンドの解析と実行メソッドを実装
    - _要件: 10_
  
  - [ ] 1.3 コマンド関連の型定義作成
    - src/types/commandTypes.ts を作成
    - CommandContext, CommandArgs, CommandResult インターフェースを定義
    - CommandErrorType enum を定義
    - _要件: 4, 6_

- [ ] 2. 設定管理の拡張
  - [ ] 2.1 ConfigPersistence クラスの実装
    - src/managers/ConfigPersistence.ts を作成
    - ファイルロック機構を実装
    - config.json の安全な読み書きメソッドを実装
    - バックアップとロールバック機能を実装
    - _要件: 5, 7_
  
  - [ ] 2.2 ConfigManager の拡張
    - src/config/ConfigManager.ts を修正
    - addMapping と removeMapping メソッドを追加
    - forum_category_id と command_settings のバリデーションを追加
    - _要件: 1, 5_
  
  - [ ] 2.3 BotConfig インターフェースの更新
    - src/interfaces.ts を修正
    - forum_category_id と command_settings フィールドを追加
    - RepositoryMapping に created_at と created_by フィールドを追加
    - _要件: 1, 5_

- [ ] 3. 動的マッピング管理の実装
  - [ ] 3.1 DynamicMappingManager クラスの作成
    - src/managers/DynamicMappingManager.ts を作成
    - リポジトリ検証メソッドを実装（GitHub API 使用）
    - フォーラムチャンネル作成メソッドを実装
    - _要件: 1, 8_
  
  - [ ] 3.2 MultiStore の動的操作メソッド追加
    - src/store/MultiStore.ts を修正
    - addMapping メソッドを実装（実行時のストア追加）
    - removeMapping メソッドを実装（実行時のストア削除）
    - _要件: 5_
  
  - [ ] 3.3 初期同期機能の実装
    - DynamicMappingManager に syncExistingIssues メソッドを追加
    - 全 Issue を取得して Discord スレッドを作成
    - 非同期処理で進捗をログ出力
    - _要件: 1.8, 8.4_

- [ ] 4. WatchCommand の実装
  - [ ] 4.1 WatchCommand クラスの作成
    - src/commands/WatchCommand.ts を作成
    - BaseCommand を継承して execute メソッドを実装
    - _要件: 1_
  
  - [ ] 4.2 引数の検証とパース
    - owner と repo パラメータの検証ロジックを実装
    - 入力サニタイゼーションを実装
    - _要件: 1.1, 6_
  
  - [ ] 4.3 監視開始フローの実装
    - リポジトリ存在確認
    - 重複チェック
    - チャンネル作成とマッピング保存
    - 成功/エラーメッセージの生成
    - _要件: 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_

- [ ] 5. UnwatchCommand の実装
  - [ ] 5.1 UnwatchCommand クラスの作成
    - src/commands/UnwatchCommand.ts を作成
    - BaseCommand を継承して execute メソッドを実装
    - _要件: 2_
  
  - [ ] 5.2 監視停止フローの実装
    - マッピング存在確認
    - チャンネル削除オプションの処理
    - config.json からの削除
    - MultiStore からの削除
    - _要件: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

- [ ] 6. ListCommand の実装
  - [ ] 6.1 ListCommand クラスの作成
    - src/commands/ListCommand.ts を作成
    - BaseCommand を継承して execute メソッドを実装
    - _要件: 3_
  
  - [ ] 6.2 一覧表示の実装
    - 監視中リポジトリの取得
    - Discord Embed でのフォーマット
    - 空の場合のメッセージ処理
    - _要件: 3.1, 3.2, 3.3, 3.4_

- [ ] 7. Bot クラスへの統合
  - [ ] 7.1 CommandManager の初期化
    - src/index.ts の Bot クラスを修正
    - CommandManager インスタンスの作成と初期化
    - _要件: 9, 10_
  
  - [ ] 7.2 メッセージイベントハンドラーの拡張
    - messageCreate イベントでプレフィックスコマンドを処理
    - Bot からのメッセージも処理するように修正
    - _要件: 10.1, 10.2, 10.3_
  
  - [ ] 7.3 スラッシュコマンドの登録
    - client ready イベントでコマンドを登録
    - interactionCreate イベントハンドラーを追加
    - _要件: 9, 10.4_

- [ ] 8. エラーハンドリングとリトライ機構
  - [ ] 8.1 CommandError クラスの実装
    - src/error/CommandError.ts を作成
    - エラータイプごとのユーザーメッセージ生成
    - _要件: 6_
  
  - [ ] 8.2 RetryStrategy クラスの実装
    - src/utils/RetryStrategy.ts を作成
    - 指数バックオフでのリトライロジック
    - _要件: 6.3, 8.5_
  
  - [ ] 8.3 TransactionManager クラスの実装
    - src/utils/TransactionManager.ts を作成
    - 操作のトランザクション管理とロールバック
    - _要件: 6.5, 7.1_

- [ ] 9. レート制限管理
  - [ ] 9.1 RateLimiter クラスの実装
    - src/utils/RateLimiter.ts を作成
    - API 呼び出しのレート制限チェック
    - _要件: 6.2, 6.3, 8.5_
  
  - [ ] 9.2 コマンドへのレート制限統合
    - 各コマンドにレート制限チェックを追加
    - 制限到達時の適切なエラーメッセージ
    - _要件: 6.2, 8.5_

- [ ] 10. 非同期処理の最適化
  - [ ] 10.1 SyncQueue クラスの実装
    - src/utils/SyncQueue.ts を作成
    - 初期同期のキューイング処理
    - _要件: 8.3_
  
  - [ ] 10.2 進捗レポート機能の追加
    - 同期進捗を定期的にログ出力
    - 長時間処理時のステータス更新
    - _要件: 6.4, 8.3_

- [ ] 11. 入力検証とサニタイゼーション
  - [ ] 11.1 InputValidator クラスの実装
    - src/utils/InputValidator.ts を作成
    - GitHub リポジトリ名/オーナー名の検証
    - 入力のサニタイゼーション
    - _要件: 1.1, 1.2, 6_

- [ ] 12. ユニットテストの作成
  - [ ] 12.1 コマンドのテスト作成
    - src/commands/__tests__/WatchCommand.test.ts を作成
    - src/commands/__tests__/UnwatchCommand.test.ts を作成
    - src/commands/__tests__/ListCommand.test.ts を作成
    - 正常系と異常系のテストケース
    - _要件: 1, 2, 3_
  
  - [ ] 12.2 マネージャーのテスト作成
    - src/managers/__tests__/DynamicMappingManager.test.ts を作成
    - src/managers/__tests__/ConfigPersistence.test.ts を作成
    - モック化とエッジケースのテスト
    - _要件: 5, 7_
  
  - [ ] 12.3 ユーティリティのテスト作成
    - src/utils/__tests__/RetryStrategy.test.ts を作成
    - src/utils/__tests__/RateLimiter.test.ts を作成
    - src/utils/__tests__/InputValidator.test.ts を作成
    - _要件: 6, 8_

- [ ] 13. 統合テストの作成
  - [ ] 13.1 コマンドフロー全体のテスト
    - src/__tests__/integration/commandFlow.test.ts を作成
    - watch → list → unwatch の完全なサイクルテスト
    - _要件: 1, 2, 3_
  
  - [ ] 13.2 エラーシナリオのテスト
    - src/__tests__/integration/errorScenarios.test.ts を作成
    - 各種エラーケースの統合テスト
    - ロールバック動作の確認
    - _要件: 6, 7_

- [ ] 14. ログとメトリクスの強化
  - [ ] 14.1 コマンド実行ログの追加
    - 各コマンドに詳細なログ出力を追加
    - 成功/失敗のメトリクス記録
    - _要件: 6, 8_
  
  - [ ] 14.2 HealthMonitor の拡張
    - src/monitoring/HealthMonitor.ts を修正
    - コマンド実行メトリクスの追加
    - 同期状況のヘルスチェック
    - _要件: 8_

- [ ] 15. 設定ファイルのマイグレーション
  - [ ] 15.1 既存 config.json の更新スクリプト作成
    - scripts/migrateConfig.ts を作成
    - 既存設定に新フィールドを追加
    - バックアップを作成してから更新
    - _要件: 5, 7_

- [ ] 16. ドキュメント更新
  - [ ] 16.1 コマンド使用方法のコメント追加
    - 各コマンドクラスに JSDoc コメントを追加
    - 使用例と引数の説明を記載
    - _要件: 1, 2, 3_