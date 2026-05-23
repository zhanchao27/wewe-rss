import sqlite3
import os
import time
import sys

# 设置编码
sys.stdout.reconfigure(encoding='utf-8')

# 数据库路径
db_path = r"D:\Trae_info_collection_app\wewe-rss\wewe-rss\apps\server\data\dev.db"

# 确保目录存在
os.makedirs(os.path.dirname(db_path), exist_ok=True)

# 如果数据库文件存在，先删除（重新创建）
if os.path.exists(db_path):
    os.remove(db_path)

# 连接数据库
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

print("=" * 60)
print("wewe-rss 测试数据生成脚本")
print("=" * 60)
print()

try:
    # 创建表结构
    print("[1/3] 正在创建表结构...")
    
    # accounts 表
    cursor.execute('''
        CREATE TABLE accounts (
            id TEXT PRIMARY KEY,
            token TEXT,
            name TEXT,
            status INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME
        )
    ''')
    
    # feeds 表
    cursor.execute('''
        CREATE TABLE feeds (
            id TEXT PRIMARY KEY,
            mp_name TEXT,
            mp_cover TEXT,
            mp_intro TEXT,
            status INTEGER DEFAULT 1,
            sync_time INTEGER DEFAULT 0,
            update_time INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME,
            has_history INTEGER DEFAULT 1
        )
    ''')
    
    # articles 表
    cursor.execute('''
        CREATE TABLE articles (
            id TEXT PRIMARY KEY,
            mp_id TEXT,
            title TEXT,
            pic_url TEXT,
            publish_time INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME
        )
    ''')
    
    print("OK: 表结构创建成功")
    print()
    
    # 插入测试账号
    cursor.execute('''
        INSERT INTO accounts (id, token, name, status) VALUES
        ('test_account_1', 'test_token_123456', '测试账号', 1)
    ''')
    
    # 插入测试公众号（3个）
    current_time = int(time.time())
    cursor.execute('''
        INSERT INTO feeds (id, mp_name, mp_cover, mp_intro, status, sync_time, update_time, has_history) VALUES
        ('mp_001', '科技前沿', 'https://picsum.photos/100/100?random=1', '专注科技领域最新资讯', 1, ?, ?, 1),
        ('mp_002', '美食天下', 'https://picsum.photos/100/100?random=2', '分享美食食谱与烹饪技巧', 1, ?, ?, 1),
        ('mp_003', '旅行日记', 'https://picsum.photos/100/100?random=3', '记录旅行中的美好时光', 1, ?, ?, 1)
    ''', (current_time, current_time) * 3)
    
    # 插入测试文章（每公众号3篇，共9篇）
    articles_data = [
        # 科技前沿
        ('art_001', 'mp_001', '2024年人工智能发展趋势展望', 'https://picsum.photos/400/250?random=1', current_time),
        ('art_002', 'mp_001', '量子计算突破：新算法大幅提升效率', 'https://picsum.photos/400/250?random=2', current_time),
        ('art_003', 'mp_001', '自动驾驶技术迎来新里程碑', 'https://picsum.photos/400/250?random=3', current_time),
        # 美食天下
        ('art_004', 'mp_002', '家常红烧肉的正宗做法', 'https://picsum.photos/400/250?random=4', current_time),
        ('art_005', 'mp_002', '夏日清凉甜品推荐', 'https://picsum.photos/400/250?random=5', current_time),
        ('art_006', 'mp_002', '零基础烘焙入门指南', 'https://picsum.photos/400/250?random=6', current_time),
        # 旅行日记
        ('art_007', 'mp_003', '云南大理深度游攻略', 'https://picsum.photos/400/250?random=7', current_time),
        ('art_008', 'mp_003', '西藏自驾游注意事项', 'https://picsum.photos/400/250?random=8', current_time),
        ('art_009', 'mp_003', '海岛度假最佳目的地推荐', 'https://picsum.photos/400/250?random=9', current_time),
    ]
    
    cursor.executemany('''
        INSERT INTO articles (id, mp_id, title, pic_url, publish_time) VALUES
        (?, ?, ?, ?, ?)
    ''', articles_data)
    
    conn.commit()
    
    print("OK: 测试数据生成成功！")
    print()
    print(f"数据库位置: {db_path}")
    print()
    print("测试数据包含:")
    print("  - 1 个测试账号")
    print("  - 3 个公众号")
    print("  - 9 篇文章")
    print()
    print("接下来可以启动服务测试防封号逻辑:")
    print("  cd D:\\Trae_info_collection_app\\wewe-rss\\wewe-rss")
    print("  pnpm install")
    print("  pnpm run dev")
    
except Exception as e:
    print(f"ERROR: 测试数据生成失败: {e}")
    conn.rollback()
    
finally:
    conn.close()
    
print()
print("=" * 60)