import sqlite3
import os
import json
import sys

# 设置编码
sys.stdout.reconfigure(encoding='utf-8')

# 数据库路径
db_path = r"D:\Trae_info_collection_app\wewe-rss\wewe-rss\apps\server\data\dev.db"

# 导出目录
export_dir = r"D:\Trae_info_collection_app\wewe-rss\wewe-rss\export"
os.makedirs(export_dir, exist_ok=True)

# 连接数据库
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row  # 返回字典格式
cursor = conn.cursor()

print("=" * 60)
print("wewe-rss 文章导出脚本")
print("=" * 60)
print()

try:
    # 查询公众号列表
    cursor.execute("SELECT * FROM feeds WHERE status = 1")
    feeds = [dict(row) for row in cursor.fetchall()]
    print(f"找到 {len(feeds)} 个公众号")

    # 查询文章列表
    cursor.execute("SELECT * FROM articles ORDER BY mp_id, publish_time DESC")
    articles = [dict(row) for row in cursor.fetchall()]
    print(f"找到 {len(articles)} 篇文章")
    print()

    # 导出全部数据（包含公众号和文章）
    export_data = {
        "export_time": os.path.getmtime(db_path),
        "feeds": feeds,
        "articles": articles
    }

    # 导出完整数据 JSON
    full_export_path = os.path.join(export_dir, "wewe-rss_full_export.json")
    with open(full_export_path, 'w', encoding='utf-8') as f:
        json.dump(export_data, f, ensure_ascii=False, indent=2)
    print(f"✓ 完整数据已导出: {full_export_path}")

    # 按公众号分组导出
    grouped_data = {}
    for feed in feeds:
        feed_id = feed['id']
        feed_name = feed['mp_name']
        feed_articles = [a for a in articles if a['mp_id'] == feed_id]
        grouped_data[feed_id] = {
            "feed_info": feed,
            "articles": feed_articles
        }

        # 每个公众号单独导出一个 JSON 文件
        feed_export_path = os.path.join(export_dir, f"{feed_name}_articles.json")
        with open(feed_export_path, 'w', encoding='utf-8') as f:
            json.dump({
                "feed_info": feed,
                "articles": feed_articles
            }, f, ensure_ascii=False, indent=2)
        print(f"✓ {feed_name} 的 {len(feed_articles)} 篇文章已导出")

    # 导出仅文章列表（简洁版）
    articles_only_path = os.path.join(export_dir, "articles_only.json")
    with open(articles_only_path, 'w', encoding='utf-8') as f:
        json.dump(articles, f, ensure_ascii=False, indent=2)
    print(f"✓ 仅文章列表已导出: {articles_only_path}")

    print()
    print("=" * 60)
    print("导出完成！")
    print(f"导出目录: {export_dir}")
    print()
    print("导出文件:")
    print("  - wewe-rss_full_export.json  (完整数据)")
    print("  - articles_only.json         (仅文章列表)")
    print("  - [公众号名称]_articles.json (按公众号分组)")

except Exception as e:
    print(f"✗ 导出失败: {e}")

finally:
    conn.close()