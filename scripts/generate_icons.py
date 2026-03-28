"""
生成 PWA 所需的圖示檔案
"""
from PIL import Image, ImageDraw, ImageFont
import os

def create_app_icon(size, output_path):
    """建立應用程式圖示"""
    # 建立一個藍色背景的圖片
    img = Image.new('RGB', (size, size), color='#0d6efd')
    draw = ImageDraw.Draw(img)
    
    # 計算圖示元素的大小
    padding = size // 10
    
    # 繪製白色邊框
    border_width = max(2, size // 40)
    draw.rectangle(
        [padding, padding, size - padding, size - padding],
        outline='white',
        width=border_width
    )
    
    # 繪製工具箱圖案 (簡單的幾何形狀)
    box_padding = size // 4
    box_top = size // 3
    box_bottom = size * 2 // 3
    
    # 主要方塊 (工具箱)
    draw.rectangle(
        [box_padding, box_top, size - box_padding, box_bottom],
        fill='white',
        outline='white'
    )
    
    # 手把
    handle_width = size // 3
    handle_height = size // 12
    handle_left = (size - handle_width) // 2
    handle_top = box_top - handle_height // 2
    
    draw.rounded_rectangle(
        [handle_left, handle_top, handle_left + handle_width, handle_top + handle_height],
        radius=handle_height // 2,
        fill='white',
        outline='white'
    )
    
    # 在中間繪製文字 "倉" (如果尺寸夠大)
    if size >= 192:
        try:
            # 嘗試使用系統字體
            font_size = size // 6
            # Windows 系統字體
            font_paths = [
                'C:/Windows/Fonts/msjh.ttc',  # 微軟正黑體
                'C:/Windows/Fonts/mingliu.ttc',  # 細明體
                'C:/Windows/Fonts/kaiu.ttf',  # 標楷體
            ]
            
            font = None
            for font_path in font_paths:
                if os.path.exists(font_path):
                    try:
                        font = ImageFont.truetype(font_path, font_size)
                        break
                    except:
                        continue
            
            if font:
                text = "倉"
                # 使用 textbbox 取得文字邊界框
                bbox = draw.textbbox((0, 0), text, font=font)
                text_width = bbox[2] - bbox[0]
                text_height = bbox[3] - bbox[1]
                
                text_x = (size - text_width) // 2
                text_y = (box_top + box_bottom - text_height) // 2 - bbox[1]
                
                draw.text((text_x, text_y), text, fill='#0d6efd', font=font)
        except Exception as e:
            print(f"無法繪製文字: {e}")
    
    # 儲存圖片
    img.save(output_path, 'PNG')
    print(f"✅ 已建立圖示: {output_path} ({size}x{size})")

def main():
    """主程式"""
    static_dir = 'static'
    
    # 確保 static 目錄存在
    if not os.path.exists(static_dir):
        os.makedirs(static_dir)
    
    print("🎨 開始生成 PWA 圖示...")
    
    # 生成 192x192 圖示
    create_app_icon(192, os.path.join(static_dir, 'icon-192.png'))
    
    # 生成 512x512 圖示
    create_app_icon(512, os.path.join(static_dir, 'icon-512.png'))
    
    # 生成 favicon (可選)
    try:
        icon_192 = Image.open(os.path.join(static_dir, 'icon-192.png'))
        favicon = icon_192.resize((32, 32), Image.Resampling.LANCZOS)
        favicon.save(os.path.join(static_dir, 'favicon.ico'), format='ICO')
        print(f"✅ 已建立 favicon: {os.path.join(static_dir, 'favicon.ico')}")
    except Exception as e:
        print(f"⚠️  無法生成 favicon: {e}")
    
    print("\n🎉 所有圖示生成完成！")
    print("📱 現在您可以在手機瀏覽器中看到「安裝應用程式」的提示了。")

if __name__ == '__main__':
    main()
