"""
時區工具模組
統一管理所有時區相關的輔助函式，避免在多個模組中重複定義
"""

from datetime import datetime, timezone, timedelta

# 台北時區常數 (UTC+8)
TZ_TAIPEI = timezone(timedelta(hours=8))


def get_taipei_time():
    """取得台北時間 (UTC+8)"""
    return datetime.now(TZ_TAIPEI)
