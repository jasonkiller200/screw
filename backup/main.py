import kivy
from kivy.app import App
from kivy.uix.boxlayout import BoxLayout
from kivy.uix.gridlayout import GridLayout
from kivy.uix.label import Label
from kivy.uix.textinput import TextInput
from kivy.uix.button import Button
from kivy.uix.scrollview import ScrollView
from kivy.uix.popup import Popup
from kivy.network.urlrequest import UrlRequest
import json
from functools import partial
from kivy.core.text import LabelBase
from kivy.resources import resource_add_path
import os

# --- Font Setup for Traditional Chinese ---
# This is necessary to display Chinese characters correctly.
# We are adding the Windows Fonts directory to Kivy's search path
# and registering Microsoft JhengHei as the default font.
if os.name == 'nt': # Check if the OS is Windows
    font_path = 'C:/Windows/Fonts'
    if os.path.exists(os.path.join(font_path, 'msjh.ttc')):
        resource_add_path(font_path)
        LabelBase.register(name='Roboto', fn_regular='msjh.ttc')
    else:
        print("Warning: 'msjh.ttc' not found. Chinese characters may not display correctly.")

# IMPORTANT: Replace with your computer's actual IP address if it changes.
API_BASE_URL = "http://192.168.50.171:5000"

class HardwareScannerApp(App):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.current_part_number = None
        self.last_order_quantity = None
        self.current_part_info = {}
        self.pending_orders = [] # This will act as our "shopping cart"

    def build(self):
        self.title = "五金零件訂購APP"
        
        # Main layout
        main_layout = BoxLayout(orientation='vertical', padding=10, spacing=10)
        
        # --- Top Search Area ---
        # Use a fixed height for the top area to prevent it from being pushed off-screen
        search_area = BoxLayout(orientation='vertical', size_hint_y=None, height=350, spacing=5)
        search_area.add_widget(Label(text="五金零件訂購APP", font_size=32, size_hint_y=None, height=50))
        self.part_number_input = TextInput(hint_text='輸入或掃描零件品號', size_hint_y=None, height=40, font_size=20, multiline=False)
        search_button = Button(text='查詢零件', size_hint_y=None, height=50, font_size=20)
        search_button.bind(on_press=self.search_part)
        self.status_label = Label(text='請輸入零件品號以開始', size_hint_y=None, height=40)
        self.part_info_label = Label(text='', size_hint_y=None, height=40)
        self.last_order_label = Label(text='', size_hint_y=None, height=20) # New label for last order
        
        search_area.add_widget(self.part_number_input)
        search_area.add_widget(search_button)
        search_area.add_widget(self.status_label)
        search_area.add_widget(self.part_info_label)
        search_area.add_widget(self.last_order_label) # Add new label to layout

        # --- Add to List UI (initially hidden) ---
        self.add_item_layout = BoxLayout(orientation='vertical', size_hint_y=None, height=110, spacing=5, disabled=True, opacity=0)
        add_input_layout = BoxLayout(size_hint_y=None, height=40)
        self.order_unit_label = Label(text='訂購數量:', size_hint_x=0.4) # Dynamic label
        add_input_layout.add_widget(self.order_unit_label)
        self.order_quantity_input = TextInput(hint_text='例如: 5', multiline=False, input_type='number', size_hint_x=0.6)
        add_input_layout.add_widget(self.order_quantity_input)
        add_to_list_button = Button(text='加入訂購清單')
        add_to_list_button.bind(on_press=self.add_item_to_list)
        self.add_item_layout.add_widget(add_input_layout)
        self.add_item_layout.add_widget(add_to_list_button)
        search_area.add_widget(self.add_item_layout)

        # --- Pending Orders Display Area ---
        # This area will now fill the remaining vertical space
        pending_area = BoxLayout(orientation='vertical', spacing=5)
        pending_area.add_widget(Label(text="待訂購清單", font_size=24, size_hint_y=None, height=40))
        
        self.pending_orders_layout = GridLayout(cols=1, spacing=5, size_hint_y=None)
        self.pending_orders_layout.bind(minimum_height=self.pending_orders_layout.setter('height'))
        
        scroll_view = ScrollView(size_hint=(1, 1))
        scroll_view.add_widget(self.pending_orders_layout)
        pending_area.add_widget(scroll_view)

        # --- Confirmation Buttons ---
        confirm_buttons_layout = BoxLayout(size_hint_y=None, height=50, spacing=10)
        confirm_button = Button(text='確認並送出所有訂單')
        confirm_button.bind(on_press=self.confirm_and_send_orders)
        clear_button = Button(text='清空清單')
        clear_button.bind(on_press=self.clear_pending_orders)
        confirm_buttons_layout.add_widget(confirm_button)
        confirm_buttons_layout.add_widget(clear_button)
        pending_area.add_widget(confirm_buttons_layout)

        # Add all areas to main layout
        main_layout.add_widget(search_area)
        main_layout.add_widget(pending_area)
        
        return main_layout

    def search_part(self, instance):
        part_number = self.part_number_input.text.strip()
        if not part_number:
            self.status_label.text = "請輸入品號."
            return
        self.status_label.text = f"查詢中: {part_number}..."
        self.part_info_label.text = ""
        self.last_order_label.text = "" # Reset last order label
        self.add_item_layout.disabled = True
        self.add_item_layout.opacity = 0
        request_url = f"{API_BASE_URL}/api/part/{part_number}"
        UrlRequest(request_url, on_success=self.on_search_success, on_failure=self.on_search_failure, on_error=self.on_search_error)

    def on_search_success(self, request, result):
        self.status_label.text = "查詢成功，請將品項加入下方清單。"
        self.current_part_info = result.get('part_info', {})
        order_history = result.get('order_history', [])
        
        unit = self.current_part_info.get('unit', '個')
        self.part_info_label.text = f"找到品號: {self.current_part_info.get('part_number')} | 位置: {self.current_part_info.get('location')}"
        
        # Update the order unit label
        self.order_unit_label.text = f"訂購數量 ({unit}):"

        # Display last order info and pre-fill quantity
        if order_history:
            last_order = order_history[0]
            last_qty = last_order.get('quantity_ordered')
            last_date = last_order.get('order_date')
            self.last_order_label.text = f"最近訂購: {last_date}, {last_qty} {unit}"
            self.order_quantity_input.text = str(last_qty)
        else:
            self.last_order_label.text = "無歷史訂單紀錄"
            self.order_quantity_input.text = ""

        self.add_item_layout.disabled = False
        self.add_item_layout.opacity = 1

    def add_item_to_list(self, instance):
        try:
            quantity = int(self.order_quantity_input.text)
            if quantity <= 0: raise ValueError()
        except ValueError:
            self.status_label.text = "請輸入有效的正整數。"
            return
        
        part_number = self.current_part_info.get('part_number')
        if not part_number:
            self.status_label.text = "沒有選擇任何零件。"
            return

        # Check if part already in list, if so, update quantity
        for item in self.pending_orders:
            if item['part_number'] == part_number:
                item['quantity'] += quantity
                self.update_pending_orders_display()
                return
        
        # Otherwise, add new item
        new_item = {'part_number': part_number, 'quantity': quantity}
        self.pending_orders.append(new_item)
        self.update_pending_orders_display()
        self.order_quantity_input.text = ""

    def update_pending_orders_display(self):
        self.pending_orders_layout.clear_widgets()
        for item in self.pending_orders:
            pn = item['part_number']
            qty = item['quantity']
            item_row = BoxLayout(size_hint_y=None, height=40)
            item_row.add_widget(Label(text=f"{pn} (數量: {qty})"))
            
            modify_button = Button(text="修改", size_hint_x=0.25)
            modify_button.bind(on_press=partial(self.open_modify_popup, item))
            
            delete_button = Button(text="刪除", size_hint_x=0.25)
            delete_button.bind(on_press=partial(self.delete_pending_item, item))
            
            item_row.add_widget(modify_button)
            item_row.add_widget(delete_button)
            self.pending_orders_layout.add_widget(item_row)

    def delete_pending_item(self, item_to_delete, instance):
        self.pending_orders.remove(item_to_delete)
        self.update_pending_orders_display()

    def open_modify_popup(self, item_to_modify, instance):
        content = BoxLayout(orientation='vertical', spacing=10, padding=10)
        popup_input = TextInput(text=str(item_to_modify['quantity']), input_type='number')
        content.add_widget(Label(text=f"為品號 {item_to_modify['part_number']}\n輸入新的數量:"))
        content.add_widget(popup_input)
        
        save_button = Button(text="儲存")
        content.add_widget(save_button)

        popup = Popup(title="修改數量", content=content, size_hint=(0.8, 0.4))
        
        def save_action(instance):
            try:
                new_qty = int(popup_input.text)
                if new_qty > 0:
                    item_to_modify['quantity'] = new_qty
                else: # if 0 or less, delete it
                    self.pending_orders.remove(item_to_modify)
                self.update_pending_orders_display()
                popup.dismiss()
            except ValueError:
                pass # Or show an error in the popup
        
        save_button.bind(on_press=save_action)
        popup.open()

    def clear_pending_orders(self, instance):
        self.pending_orders.clear()
        self.update_pending_orders_display()

    def confirm_and_send_orders(self, instance):
        if not self.pending_orders:
            self.status_label.text = "訂購清單是空的。"
            return
        
        for item in self.pending_orders:
            payload = json.dumps({
                "part_number": item['part_number'],
                "quantity_ordered": item['quantity']
            })
            headers = {'Content-type': 'application/json', 'Accept': 'application/json'}
            UrlRequest(
                f"{API_BASE_URL}/api/order",
                req_body=payload,
                req_headers=headers,
                on_success=self.on_order_success,
                on_failure=self.on_order_failure,
                on_error=self.on_search_error
            )
        
        self.status_label.text = f"已送出 {len(self.pending_orders)} 筆訂單至後台！"
        self.clear_pending_orders(None)

    def on_order_success(self, request, result):
        # This message is not shown in the UI, but good for debugging
        print(f"訂單成功: {result.get('message')}")

    def on_order_failure(self, request, result):
        # This message is not shown in the UI, but good for debugging
        print(f"訂單失敗: {result.get('error')}")

    def on_search_failure(self, request, result):
        self.status_label.text = f"錯誤: 找不到零件或伺服器問題。"

    def on_search_error(self, request, error):
        self.status_label.text = "錯誤: 無法連線至伺服器。"

if __name__ == '__main__':
    HardwareScannerApp().run()
