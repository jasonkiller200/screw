# services/dashboard_service.py

from models.inventory import CurrentInventory, InventoryTransaction
from models.part import Part, PartWarehouseLocation, WarehouseLocation, Warehouse
from models.weekly_order import WeeklyOrderCycle, OrderRegistration
from extensions import db
from sqlalchemy import func, case, extract, or_
from datetime import datetime, timedelta, date
from collections import defaultdict
import pandas as pd

# 交易類型配置
TRANSACTION_TYPE_CONFIG = {
    'inbound': {
        'INBOUND': {'label': '週期訂單', 'color': '#007bff'},
        'IN_TRANSFER': {'label': '調撥入庫', 'color': '#17a2b8'},
        'IN_RETURN': {'label': '退貨入庫', 'color': '#6c757d'}
    },
    'outbound': {
        'OUT_WORK_ORDER': {'label': '工單領用', 'color': '#dc3545'},
        'OUT_TRANSFER': {'label': '調撥出庫', 'color': '#fd7e14'},
        'OUT_AFTER_SALES': {'label': '售後服務', 'color': '#ffc107'},
        'OUT_SCRAP': {'label': '報廢', 'color': '#6c757d'}
    }
}

class DashboardService:
    def get_dashboard_data(self, timespan='daily', time_range='week'):
        """
        主方法，協調所有數據的獲取與計算
        
        Args:
            timespan: 趨勢圖的時間粒度 ('daily', 'weekly', 'monthly')
            time_range: KPI 的時間範圍 ('today', 'week', 'month', 'quarter')
        """
        kpi_data = self._get_kpi_data(time_range=time_range)
        trend_data = self._get_trend_data(timespan)
        top_items = self._get_top_checkout_items()
        stock_alerts = self._get_stock_alerts()

        return {
            "kpi": kpi_data,
            "trend_chart": trend_data,
            "top_checkout_items": top_items,
            "stock_alerts": stock_alerts,
            "time_range": time_range  # 回傳當前時間範圍
        }

    def _get_kpi_data(self, time_range='week'):
        """
        計算所有頂部 KPI 卡片的數據
        
        Args:
            time_range: 時間範圍 ('today', 'week', 'month', 'quarter')
        """
        
        stock_status_query = db.session.query(
            func.count(func.distinct(PartWarehouseLocation.part_id)).label('parts_with_location_count'),
            func.count(PartWarehouseLocation.part_id).label('total_part_locations')
        ).select_from(PartWarehouseLocation)
        stock_status = stock_status_query.first()

        # 計算儲位總數 (所有倉庫儲位)
        total_locations_count = db.session.query(func.count(WarehouseLocation.id)).scalar()

        total_stock_quantity = db.session.query(func.sum(CurrentInventory.quantity_on_hand)).scalar()

        alert_status = db.session.query(
            func.count(case((CurrentInventory.available_quantity <= 0, 1))).label('out_of_stock_count'),
            func.count(case(((CurrentInventory.available_quantity > 0) & (CurrentInventory.reorder_point > 0) & (CurrentInventory.available_quantity <= CurrentInventory.reorder_point), 1))).label('low_stock_count')
        ).first()

        # 使用新的時間範圍計算方法
        today = date.today()
        start_date, end_date = self._calculate_time_range(time_range, today)
        
        # 計算上一個時間段（用於趨勢比較）
        prev_start, prev_end = self._calculate_previous_period(time_range, start_date)

        # 保留舊的 get_weekly_turnover 函數用於計算上一期數據
        def get_weekly_turnover(start_date, end_date):
            turnover = db.session.query(
                func.sum(case((InventoryTransaction.transaction_type.like('IN_%'), InventoryTransaction.quantity), else_=0)).label('total_in'),
                func.sum(case((InventoryTransaction.transaction_type.like('OUT_%'), func.abs(InventoryTransaction.quantity)), else_=0)).label('total_out')
            ).filter(
                InventoryTransaction.transaction_date >= start_date,
                InventoryTransaction.transaction_date < (end_date + timedelta(days=1))
            ).first()
            return turnover.total_in or 0, turnover.total_out or 0

        # 獲取上一期數據（用於趨勢計算）
        prev_in, prev_out = get_weekly_turnover(prev_start, prev_end)

        def calculate_trend(current, previous):
            if previous == 0:
                return 100 if current > 0 else 0
            return round(((current - previous) / previous) * 100, 2)

        # 獲取當前時間範圍的入庫和出庫分類統計
        inbound_breakdown, current_in_total = self._get_transaction_breakdown(
            start_date, end_date, 'inbound'
        )
        outbound_breakdown, current_out_total = self._get_transaction_breakdown(
            start_date, end_date, 'outbound'
        )

        # 計算趨勢（使用新的總計值與上一期比較）
        inbound_trend = calculate_trend(current_in_total, prev_in)
        outbound_trend = calculate_trend(current_out_total, prev_out)

        # 計算待辦事項統計
        # 1. 待審查週期訂單 (狀態為 registered 的申請項目)
        pending_reviews = db.session.query(func.count(OrderRegistration.id)).filter(
            OrderRegistration.status == 'registered'
        ).scalar() or 0

        # 2. 待入庫品項總量 (狀態為 approved 或 partially_received 但未完全入庫且有指定儲位的項目筆數)
        pending_inbound_items = db.session.query(func.count(OrderRegistration.id)).filter(
            OrderRegistration.status.in_(['approved', 'partially_received']),  # 包含部分入庫的項目
            OrderRegistration.quantity > OrderRegistration.quantity_received,
            OrderRegistration.warehouse_location_id.isnot(None)  # 排除未指定儲位的項目
        ).scalar() or 0

        # 3. 計算月度庫存周轉率 (本月出庫總量 / 平均庫存)
        # 獲取本月開始日期
        today = date.today()
        first_day_of_month = today.replace(day=1)
        
        # 計算本月出庫總量
        monthly_outbound = db.session.query(
            func.sum(func.abs(InventoryTransaction.quantity))
        ).filter(
            InventoryTransaction.transaction_type.like('OUT_%'),
            InventoryTransaction.transaction_date >= first_day_of_month
        ).scalar() or 0

        # 計算平均庫存 (簡化為當前總庫存，實際應該用月初和月末的平均值)
        current_total_inventory = total_stock_quantity or 1  # 避免除零錯誤
        
        # 庫存周轉率 = 出庫量 / 平均庫存
        monthly_turnover_rate = round((monthly_outbound / current_total_inventory) * 100, 2) if current_total_inventory > 0 else 0

        return {
            'total_locations_count': total_locations_count or 0,
            'parts_with_location_count': stock_status.parts_with_location_count or 0,
            'total_part_locations': stock_status.total_part_locations or 0,
            'total_stock_quantity': int(total_stock_quantity or 0),
            'low_stock_count': alert_status.low_stock_count or 0,
            'out_of_stock_count': alert_status.out_of_stock_count or 0,
            'weekly_stock_in': {
                'total': current_in_total,
                'trend': inbound_trend,
                'breakdown': inbound_breakdown
            },
            'weekly_stock_out': {
                'total': current_out_total,
                'trend': outbound_trend,
                'breakdown': outbound_breakdown
            },
            'pending_reviews': pending_reviews,
            'pending_inbound_items': pending_inbound_items,
            'monthly_turnover_rate': monthly_turnover_rate
        }

    def _get_transaction_breakdown(self, start_date, end_date, direction='inbound'):
        """
        獲取指定時間範圍內的交易分類統計
        
        Args:
            start_date: 開始日期
            end_date: 結束日期
            direction: 'inbound' 或 'outbound'
        
        Returns:
            tuple: (breakdown_list, total_quantity)
        """
        if direction == 'inbound':
            # 入庫類型統計 - 包含 INBOUND 和 IN_* 類型
            type_filter = or_(
                InventoryTransaction.transaction_type == 'INBOUND',
                InventoryTransaction.transaction_type.like('IN_%')
            )
            config = TRANSACTION_TYPE_CONFIG['inbound']
        else:
            # 出庫類型統計 - OUT_* 類型
            type_filter = InventoryTransaction.transaction_type.like('OUT_%')
            config = TRANSACTION_TYPE_CONFIG['outbound']
        
        # 查詢各類型數量
        results = db.session.query(
            InventoryTransaction.transaction_type,
            func.sum(func.abs(InventoryTransaction.quantity)).label('quantity')
        ).filter(
            type_filter,
            InventoryTransaction.transaction_date >= start_date,
            InventoryTransaction.transaction_date < (end_date + timedelta(days=1))
        ).group_by(InventoryTransaction.transaction_type).all()
        
        # 計算總量
        total = sum(r.quantity for r in results if r.quantity)
        
        # 格式化結果
        breakdown = []
        for trans_type, quantity in results:
            if trans_type in config and quantity:
                percentage = round((quantity / total * 100), 1) if total > 0 else 0
                breakdown.append({
                    'type': trans_type,
                    'label': config[trans_type]['label'],
                    'quantity': int(quantity),
                    'percentage': percentage,
                    'color': config[trans_type]['color']
                })
        
        # 按數量排序（由大到小）
        breakdown.sort(key=lambda x: x['quantity'], reverse=True)
        
        return breakdown, int(total) if total else 0

    def _calculate_time_range(self, time_range, reference_date):
        """
        計算時間範圍的開始和結束日期
        
        Args:
            time_range: 'today', 'week', 'month', 'quarter'
            reference_date: 參考日期（通常是今天）
        
        Returns:
            tuple: (start_date, end_date)
        """
        if time_range == 'today':
            return reference_date, reference_date
        
        elif time_range == 'week':
            start_of_week = reference_date - timedelta(days=reference_date.weekday())
            return start_of_week, reference_date
        
        elif time_range == 'month':
            start_of_month = reference_date.replace(day=1)
            return start_of_month, reference_date
        
        elif time_range == 'quarter':
            quarter_month = ((reference_date.month - 1) // 3) * 3 + 1
            start_of_quarter = reference_date.replace(month=quarter_month, day=1)
            return start_of_quarter, reference_date
        
        else:
            # 預設為本週
            start_of_week = reference_date - timedelta(days=reference_date.weekday())
            return start_of_week, reference_date

    def _calculate_previous_period(self, time_range, current_start):
        """
        計算上一個時間段（用於趨勢比較）
        
        Args:
            time_range: 時間範圍類型
            current_start: 當前時間段的開始日期
        
        Returns:
            tuple: (prev_start, prev_end)
        """
        if time_range == 'today':
            # 上一天
            prev_start = current_start - timedelta(days=1)
            prev_end = prev_start
        
        elif time_range == 'week':
            # 上週
            prev_start = current_start - timedelta(days=7)
            prev_end = current_start - timedelta(days=1)
        
        elif time_range == 'month':
            # 上個月
            if current_start.month == 1:
                prev_start = current_start.replace(year=current_start.year - 1, month=12, day=1)
            else:
                prev_start = current_start.replace(month=current_start.month - 1, day=1)
            prev_end = current_start - timedelta(days=1)
        
        elif time_range == 'quarter':
            # 上一季（簡化計算：往前推 90 天）
            prev_start = current_start - timedelta(days=90)
            prev_end = current_start - timedelta(days=1)
        
        else:
            # 預設為上週
            prev_start = current_start - timedelta(days=7)
            prev_end = current_start - timedelta(days=1)
        
        return prev_start, prev_end


    def _get_trend_data(self, timespan):
        """
        根據時間範圍計算趨勢數據。
        - timespan: 'daily', 'weekly', 'monthly'
        """
        today = date.today()
        
        if timespan == 'daily':
            num_periods = 7
            start_date = today - timedelta(days=num_periods - 1)
            group_format = '%Y-%m-%d'
            freq = 'D'
        elif timespan == 'weekly':
            num_periods = 5
            start_date = today - timedelta(weeks=num_periods - 1)
            start_date -= timedelta(days=start_date.weekday())
            group_format = '%Y-%U'
            freq = 'W-MON'
        elif timespan == 'monthly':
            num_periods = 5
            start_date = (today.replace(day=1) - timedelta(days=1)).replace(day=1)
            for _ in range(num_periods - 2):
                 start_date = (start_date - timedelta(days=1)).replace(day=1)
            group_format = '%Y-%m'
            freq = 'MS'
        else:
            return {}

        deltas_query = db.session.query(
            func.strftime(group_format, InventoryTransaction.transaction_date).label('period'),
            func.sum(InventoryTransaction.quantity).label('net_change')
        ).filter(
            InventoryTransaction.transaction_date >= start_date
        ).group_by('period').all()
        
        period_deltas = {row.period: int(row.net_change) for row in deltas_query}

        turnover_query = db.session.query(
            func.strftime(group_format, InventoryTransaction.transaction_date).label('period'),
            func.sum(case((InventoryTransaction.transaction_type.like('IN_%'), InventoryTransaction.quantity), else_=0)).label('total_in'),
            func.sum(case((InventoryTransaction.transaction_type.like('OUT_%'), func.abs(InventoryTransaction.quantity)), else_=0)).label('total_out')
        ).filter(
            InventoryTransaction.transaction_date >= start_date
        ).group_by('period').all()

        period_turnover = {row.period: {'in': int(row.total_in or 0), 'out': int(row.total_out or 0)} for row in turnover_query}

        current_total_stock = db.session.query(func.sum(CurrentInventory.quantity_on_hand)).scalar() or 0
        
        date_index = pd.date_range(start=start_date, end=today, freq=freq)
        
        if timespan == 'weekly':
            period_labels = [d.strftime('%Y-%U') for d in date_index]
        else:
            period_labels = [d.strftime(group_format) for d in date_index]

        closing_stocks = {}
        running_stock = current_total_stock
        
        for i in range(len(period_labels) - 1, -1, -1):
            label = period_labels[i]
            if i == len(period_labels) - 1:
                closing_stocks[label] = int(running_stock)
            else:
                next_label = period_labels[i+1]
                closing_stocks[label] = closing_stocks[next_label] - period_deltas.get(next_label, 0)

        result = {
            'labels': [],
            'total_stock_trend': [],
            'inbound_data': [],
            'outbound_data': []
        }

        for label in period_labels:
            result['labels'].append(label)
            result['total_stock_trend'].append(closing_stocks.get(label, 0))
            result['inbound_data'].append(period_turnover.get(label, {}).get('in', 0))
            result['outbound_data'].append(period_turnover.get(label, {}).get('out', 0))
            
        return result

    def _get_top_checkout_items(self, limit=5):
        """計算過去30天出庫頻率最高的品項。"""
        thirty_days_ago = datetime.now() - timedelta(days=30)

        top_items = db.session.query(
            Part.id,
            Part.part_number,
            Part.name,
            func.count(InventoryTransaction.id).label('checkout_count')
        ).join(Part, InventoryTransaction.part_id == Part.id)\
        .filter(
            InventoryTransaction.transaction_type.like('OUT_%'),
            InventoryTransaction.transaction_date >= thirty_days_ago
        ).group_by(Part.id, Part.part_number, Part.name)\
        .order_by(func.count(InventoryTransaction.id).desc())\
        .limit(limit).all()

        return [
            {
                'part_id': item.id,
                'part_number': item.part_number,
                'part_name': item.name,
                'count': item.checkout_count
            } for item in top_items
        ]

    def _get_stock_alerts(self, limit=10):
        """獲取低庫存與缺貨的品項列表。"""
        
        alerts_query = db.session.query(
            Part.part_number,
            Part.name,
            CurrentInventory.available_quantity,
            CurrentInventory.reorder_point,
            WarehouseLocation.location_code,
            Warehouse.name.label('warehouse_name')
        ).join(Part, CurrentInventory.part_id == Part.id)\
        .join(WarehouseLocation, CurrentInventory.warehouse_location_id == WarehouseLocation.id)\
        .join(Warehouse, WarehouseLocation.warehouse_id == Warehouse.id)\
        .filter(
            # 缺貨 (available_quantity <= 0) 或者 低庫存 (有設定再訂購點且低於再訂購點)
            db.or_(
                CurrentInventory.available_quantity <= 0,  # 缺貨項目，不論是否有設定再訂購點
                db.and_(
                    CurrentInventory.reorder_point > 0,
                    CurrentInventory.available_quantity <= CurrentInventory.reorder_point
                )  # 有設定再訂購點且低於再訂購點的低庫存項目
            )
        )

        severity_order = case(
            (CurrentInventory.available_quantity <= 0, 0),
            else_= (CurrentInventory.available_quantity / CurrentInventory.reorder_point)
        )
        
        alerts = alerts_query.order_by(severity_order.asc()).limit(limit).all()

        return [
            {
                'part_number': alert.part_number,
                'part_name': alert.name,
                'location_code': alert.location_code,
                'warehouse_name': alert.warehouse_name,
                'location_display': f"{alert.warehouse_name} - {alert.location_code}",
                'available_quantity': alert.available_quantity,
                'reorder_point': alert.reorder_point,
                'status': '缺貨' if alert.available_quantity <= 0 else '低庫存'
            } for alert in alerts
        ]
