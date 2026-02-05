# Bina Yönetim Sistemi (Apartment Management System)

Modern "Premium Dark" temalı, yönetici ve site sakinleri için geliştirilmiş, **Django** tabanlı kapsamlı bir bina yönetim platformu.

Siteyi canlı görmek için [tıklayabilirsiniz](https://bina-yonetim-ivb9.onrender.com/login/).  

Bu servis ücretsiz bir altyapı kullanıyor, bazı durumlarda çalışmayabilir.

## Özellikler

### Yönetici Paneli
- **Aidat Takibi**: 
  - Aylık aidat veya özel (demirbaş, onarım) ödeme oluşturma.
  - Ödeme "Ödendi" yapıldığında otomatik olarak gelirlere işlenir.
  - Ödeme durumundan bağımsız olarak aidatları arşivleme/aktif etme.
- **Finansal Raporlar**:
  - Gelir/Gider grafikleri (Chart.js)
  - Tarih aralığına göre filtreleme
  - PDF rapor çıktısı alma
- **Üye Yönetimi**: Yeni kayıt olan sakinleri onaylama veya reddetme
- **Duyurular**: Önem derecesine göre duyuru yayınlama ve arşivleme
- **Mesajlaşma**: Sakinlerden gelen mesajları okuma ve cevaplama

### Sakin Paneli
- **Ödeme Geçmişi**:
  - Aktif borçlar ve geçmiş ödemeleri ayrı sekmelerde görüntüleme
  - Toplam ödenen tutar takibi
- **Bina Durumu**: Binanın toplam gelir/gider ve kasa durumunu görme
- **İletişim**: Yöneticiye mesaj gönderme ve yanıtları takip etme
- **Kişisel Profil**: Telefon ve şifre bilgilerini güncelleme

## Teknolojiler

- **Backend**: Python, Django, Django REST Framework
- **Database**: PostgreSQL (Production) / SQLite (Local)
- **Frontend**: HTML5, CSS3 (Premium Dark Theme), Vanilla JavaScript
- **Media**: Cloudinary (Dosya depolama)
- **Diğer**: Chart.js (Grafikler), jsPDF (Raporlama)

## Kurulum

1. **Repoyu Klonlayın**
   ```bash
   git clone https://github.com/username/bina-yonetim.git
   cd bina-yonetim-main
Sanal Ortamı Kurun ve Aktif Edin

python -m venv env
# Windows
.\env\Scripts\activate
# Mac/Linux
source env/bin/activate
Gerekli Paketleri Yükleyin

pip install -r requirements.txt
Veritabanını Hazırlayın

python manage.py makemigrations
python manage.py migrate
Sunucuyu Başlatın

python manage.py runserver
Tarayıcıda http://127.0.0.1:8000/ adresine gidin.

Kullanıcı Rolleri
Yönetici: Tüm sisteme tam erişim

Sakin: Sadece kendi ödemelerini ve bina duyurularını görür

Geliştirildi: 2025
