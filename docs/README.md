# ドキュメントインデックス

GitHub Issues Discord Threads Bot プロジェクトのドキュメントへようこそ。このディレクトリには、カテゴリ別に整理されたすべてのプロジェクトドキュメントが含まれています。

## 📚 ドキュメント構造

### 📖 [/guides](./guides/)
ボットのセットアップと使用のためのユーザー向けガイドとチュートリアル。

- **[QUICKSTART.md](./guides/QUICKSTART.md)** - 素早く始めるためのクイックセットアップガイド
- **[SETUP_GUIDE_EC2.md](./guides/SETUP_GUIDE_EC2.md)** - AWS EC2 の詳細なデプロイガイド
- **[CONFIG.md](./guides/CONFIG.md)** - config.json の完全なリファレンス
- **[MIGRATION.md](./guides/MIGRATION.md)** - シングルからマルチリポジトリ版への移行ガイド

### 📋 [/planning](./planning/)
技術計画と開発ドキュメント。

- **[requirements.md](./planning/requirements.md)** - 正式な要件仕様（EARS 形式）
- **[design.md](./planning/design.md)** - 技術設計とアーキテクチャドキュメント
- **[tasks.md](./planning/tasks.md)** - 実装タスクの分解と追跡
- **[SDD.md](./planning/SDD.md)** - ソフトウェア設計ドキュメントテンプレート
- **[MULTI_REPO_PLAN.md](./planning/MULTI_REPO_PLAN.md)** - マルチリポジトリ拡張計画

### 🗄️ [/legacy](./legacy/)
オリジナルのシングルリポジトリ版のドキュメント。

- **[README.legacy.md](./legacy/README.legacy.md)** - オリジナルプロジェクトの README

## 🎯 クイックナビゲーション

### ユーザー向け
- **初めての方** → [QUICKSTART.md](./guides/QUICKSTART.md) から始める
- **AWS でデプロイ** → [SETUP_GUIDE_EC2.md](./guides/SETUP_GUIDE_EC2.md) を参照
- **v1 からアップグレード** → [MIGRATION.md](./guides/MIGRATION.md) に従う
- **設定の詳細** → [CONFIG.md](./guides/CONFIG.md) を確認

### 開発者向け
- **要件を理解** → [requirements.md](./planning/requirements.md) を読む
- **システムアーキテクチャ** → [design.md](./planning/design.md) を確認
- **コントリビューション** → [tasks.md](./planning/tasks.md) で未完了作業を確認

### メンテナー向け
- **新機能の計画** → [SDD.md](./planning/SDD.md) テンプレートを使用
- **歴史的コンテキスト** → [README.legacy.md](./legacy/README.legacy.md) を参照

## 📝 ドキュメント標準

新しいドキュメントを追加する場合：

1. **配置場所**: 適切なサブディレクトリにドキュメントを配置
   - ユーザーガイド → `/guides`
   - 技術仕様 → `/planning`
   - 非推奨ドキュメント → `/legacy`

2. **命名規則**: 視認性のため説明的な大文字の名前を使用
   - 良い例: `DEPLOYMENT_GUIDE.md`
   - 避ける: `guide.md`

3. **フォーマット**: Markdown のベストプラクティスに従う
   - 明確な見出し階層
   - シンタックスハイライト付きのコード例
   - 構造化データのための表
   - 関連ドキュメントへのリンク

4. **メンテナンス**: ドキュメントを最新に保つ
   - 機能が変更されたら更新
   - 非推奨セクションを明確にマーク
   - 最終更新日を含める

## 🔄 バージョン履歴

- **v2.0.0** - マルチリポジトリサポート（現在）
- **v1.0.0** - シングルリポジトリ版（[legacy](./legacy/) を参照）

## 📞 ヘルプを得る

- **Issues**: [GitHub Issues](https://github.com/office-sanmarlok/GitHub-Issues-Discord-Threads-Bot/issues)
- **メインドキュメント**: [README.md](../README.md)

---

*最終更新: 2025年1月*