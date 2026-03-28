"""
生成自簽名 SSL 憑證 (用於開發環境的 HTTPS)
"""
from cryptography import x509
from cryptography.x509.oid import NameOID
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization
import datetime
import socket

def get_local_ip():
    """取得本機 IP 位址"""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except:
        return "192.168.1.1"

def generate_self_signed_cert():
    """生成自簽名憑證"""
    print("🔐 開始生成自簽名 SSL 憑證...")
    
    # 生成私鑰
    private_key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=2048,
        backend=default_backend()
    )
    
    # 取得本機 IP
    local_ip = get_local_ip()
    print(f"📍 偵測到本機 IP: {local_ip}")
    
    # 建立憑證主體
    subject = issuer = x509.Name([
        x509.NameAttribute(NameOID.COUNTRY_NAME, u"TW"),
        x509.NameAttribute(NameOID.STATE_OR_PROVINCE_NAME, u"Taiwan"),
        x509.NameAttribute(NameOID.LOCALITY_NAME, u"Taipei"),
        x509.NameAttribute(NameOID.ORGANIZATION_NAME, u"Inventory Management"),
        x509.NameAttribute(NameOID.COMMON_NAME, u"localhost"),
    ])
    
    # 建立憑證
    cert = x509.CertificateBuilder().subject_name(
        subject
    ).issuer_name(
        issuer
    ).public_key(
        private_key.public_key()
    ).serial_number(
        x509.random_serial_number()
    ).not_valid_before(
        datetime.datetime.utcnow()
    ).not_valid_after(
        # 憑證有效期 1 年
        datetime.datetime.utcnow() + datetime.timedelta(days=365)
    ).add_extension(
        x509.SubjectAlternativeName([
            x509.DNSName(u"localhost"),
            x509.DNSName(u"127.0.0.1"),
            x509.IPAddress(ipaddress.IPv4Address(u"127.0.0.1")),
            x509.IPAddress(ipaddress.IPv4Address(local_ip)),
            x509.DNSName(local_ip),
        ]),
        critical=False,
    ).sign(private_key, hashes.SHA256(), default_backend())
    
    # 寫入私鑰
    with open("cert.key", "wb") as f:
        f.write(private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.TraditionalOpenSSL,
            encryption_algorithm=serialization.NoEncryption()
        ))
    print("✅ 已建立私鑰: cert.key")
    
    # 寫入憑證
    with open("cert.pem", "wb") as f:
        f.write(cert.public_bytes(serialization.Encoding.PEM))
    print("✅ 已建立憑證: cert.pem")
    
    print("\n🎉 SSL 憑證生成完成！")
    print(f"\n📱 現在您可以使用 HTTPS 連線：")
    print(f"   - 電腦: https://127.0.0.1:5000")
    print(f"   - 手機: https://{local_ip}:5000")
    print(f"\n⚠️  注意事項：")
    print(f"   1. 瀏覽器會顯示「不安全」警告（因為是自簽名憑證）")
    print(f"   2. 需要手動點擊「繼續前往」或「接受風險」")
    print(f"   3. iOS Safari: 點擊「顯示詳細資訊」→「造訪此網站」")
    print(f"   4. Android Chrome: 點擊「進階」→「繼續前往網站」")
    print(f"\n🔧 重新啟動 Flask 應用程式以啟用 HTTPS")

if __name__ == '__main__':
    import ipaddress
    try:
        generate_self_signed_cert()
    except Exception as e:
        print(f"\n❌ 錯誤: {e}")
        print("\n💡 請確認已安裝必要套件:")
        print("   pip install cryptography")
