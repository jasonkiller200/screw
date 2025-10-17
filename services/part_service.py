import pandas as pd
from io import BytesIO
from models.part import Part, Warehouse
from extensions import db

class PartService:
    @staticmethod
    def import_parts_from_excel(file_stream):
        """
        Handles the batch import of parts from an XLSX file.
        Returns a dictionary with success status, message, and counts.
        """
        try:
            df = pd.read_excel(file_stream)
            
            column_map = {
                '零件編號': 'part_number',
                '名稱': 'name',
                '描述': 'description',
                '單位': 'unit',
                '每盒數量': 'quantity_per_box',
                '儲存位置(倉別代碼:位置代碼, 逗號分隔)': 'locations_str'
            }

            if not all(col in df.columns for col in column_map.keys()): # Corrected line
                missing_cols = [col for col in column_map.keys() if col not in df.columns]
                return {'success': False, 'error': f'Excel 文件缺少必要的欄位: {", ".join(missing_cols)}'}

            df.rename(columns=column_map, inplace=True)

            imported_count = 0
            skipped_count = 0
            errors = []
            
            for index, row in df.iterrows():
                part_number = row.get('part_number')
                name = row.get('name')
                unit = row.get('unit')
                quantity_per_box_raw = row.get('quantity_per_box')
                locations_str = str(row.get('locations_str', ''))

                # Basic validation for required fields
                if pd.isna(part_number) or pd.isna(name) or pd.isna(unit) or pd.isna(quantity_per_box_raw) or not locations_str.strip():
                    skipped_count += 1
                    errors.append(f"第 {index + 2} 行: 缺少必要欄位或儲存位置為空。")
                    continue

                try:
                    quantity_per_box = int(quantity_per_box_raw)
                except (ValueError, TypeError):
                    skipped_count += 1
                    errors.append(f"第 {index + 2} 行: 每盒數量 '{quantity_per_box_raw}' 無效，必須是數字。")
                    continue
                
                # Parse locations string into list of dicts
                locations_data = []
                location_parse_error = False
                for loc_pair_str in locations_str.split(','):
                    parts = [p.strip() for p in loc_pair_str.split(':') if p.strip()]
                    if len(parts) == 2:
                        warehouse_code = parts[0]
                        location_code = parts[1]
                        warehouse = Part.get_warehouse_by_code(warehouse_code)
                        if warehouse:
                            locations_data.append({'warehouse_id': warehouse.id, 'location_code': location_code})
                        else:
                            errors.append(f"第 {index + 2} 行: 找不到倉別代碼 '{warehouse_code}'。")
                            location_parse_error = True
                            break
                    elif parts:
                        errors.append(f"第 {index + 2} 行: 儲存位置格式錯誤 '{loc_pair_str}'，應為 倉別代碼:位置代碼。")
                        location_parse_error = True
                        break
                
                if location_parse_error or not locations_data:
                    skipped_count += 1
                    continue

                # Check for duplicate locations within the submitted data
                seen_locations = set()
                duplicate_location_found = False
                for loc_data in locations_data:
                    location_tuple = (loc_data['warehouse_id'], loc_data['location_code'].lower())
                    if location_tuple in seen_locations:
                        errors.append(f"第 {index + 2} 行: 儲存位置重複：倉庫ID {loc_data['warehouse_id']} 的位置代碼 '{loc_data['location_code']}' 已存在於提交的列表中。")
                        duplicate_location_found = True
                        break
                    seen_locations.add(location_tuple)
                
                if duplicate_location_found:
                    skipped_count += 1
                    continue

                # Attempt to create the part
                result = Part.create(
                    part_number=part_number,
                    name=name,
                    description=row.get('description', ''),
                    unit=unit,
                    quantity_per_box=quantity_per_box,
                    locations_data=locations_data
                )
                
                if result['success']:
                    imported_count += 1
                else:
                    skipped_count += 1
                    if result.get('error') == 'location_conflict':
                        conflict_details = result.get('conflicts', [])
                        conflict_msg = "倉位衝突！"
                        for conflict in conflict_details:
                            conflict_msg += f" 倉庫 {conflict['warehouse']} - 位置 {conflict['location']} 已被零件 {', '.join(conflict['parts'])} 使用。"
                        errors.append(f"第 {index + 2} 行: {conflict_msg}")
                    else:
                        errors.append(f"第 {index + 2} 行: {result.get('error', '零件新增失敗')}")
            
            return {
                'success': True,
                'message': f'成功匯入 {imported_count} 個新零件。跳過 {skipped_count} 個零件。',
                'imported_count': imported_count,
                'skipped_count': skipped_count,
                'errors': errors
            }

        except Exception as e:
            db.session.rollback() # Ensure rollback on any exception during batch processing
            return {'success': False, 'error': f'處理檔案時發生錯誤: {str(e)}'}
