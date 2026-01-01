# 🏢 Bina Yönetim Sistemi (Apartment Management System)

Modern, "Premium Dark" temalı, yönetici ve site sakinleri için geliştirilmiş, **Django** tabanlı kapsamlı bir bina yönetim platformu.

![Bina Yönetim Dashboard](https://via.placeholder.com/800x400?text=Premium+Dark+Dashboard)

## 🚀 Özellikler (Features)

### 👨‍💼 Yönetici Paneli (Manager Dashboard)
- **Aidat Takibi**: 
  - Aylık aidat veya özel (demirbaş, onarım) ödeme oluşturma.
  - **Otomatik Finans Entegrasyonu**: Aidat "Ödendi" yapıldığında otomatik olarak gelirlere işlenir.
  - **Gelişmiş Arşivleme**: Ödeme durumundan bağımsız olarak aidatları arşivleme/aktif etme.
- **Finansal Raporlar**:
  - Gelir/Gider grafikleri (Chart.js).
  - Tarih aralığına göre filtreleme.
  - PDF Rapor çıktısı alma.
- **Üye Yönetimi**: Yeni kayıt olan sakinleri onaylama/reddetme.
- **Duyurular**: Önem derecesine göre duyuru yayınlama ve arşivleme.
- **Mesajlaşma**: Sakinlerden gelen mesajları okuma ve cevaplama.

### 🏠 Sakin Paneli (Resident Dashboard)
- **Ödeme Geçmişi**:
  - Aktif borçları ve geçmiş ödemeleri ayrı sekmelerde görüntüleme.
  - Toplam ödenen tutar takibi.
- **Bina Durumu**: Binanın toplam gelir/gider ve kasa durumunu şeffaf bir şekilde görme.
- **İletişim**: Yöneticiye mesaj gönderme ve yanıtları takip etme.
- **Kişisel Profil**: Telefon ve şifre bilgilerini güncelleyebilme.

## 🛠️ Teknolojiler (Tech Stack)

- **Backend**: Python, Django, Django REST Framework (DRF).
- **Database**: PostgreSQL (Production) / SQLite (Local).
- **Frontend**: HTML5, CSS3 (Premium Dark Theme), Vanilla JavaScript.
- **Media**: Cloudinary (Dosya depolama).
- **Diğer**: Chart.js (Grafikler), jsPDF (Raporlama).

## ⚙️ Kurulum (Setup)

Projesi yerel ortamınızda çalıştırmak için:

1. **Repoyu Klonlayın**
   ```bash
   git clone https://github.com/username/bina-yonetim.git
   cd bina-yonetim-main
   ```

2. **Sanal Ortamı Kurun ve Aktif Edin**
   ```bash
   python -m venv env
   # Windows
   .\env\Scripts\activate
   # Mac/Linux
   source env/bin/activate
   ```

3. **Gerekli Paketleri Yükleyin**
   ```bash
   pip install -r requirements.txt
   ```

4. **Veritabanını Hazırlayın**
   ```bash
   python manage.py makemigrations
   python manage.py migrate
   ```

5. **Sunucuyu Başlatın**
   ```bash
   python manage.py runserver
   ```
   Tarayıcıda `http://127.0.0.1:8000/` adresine gidin.

## 🔑 Kullanıcı Rolleri

- **Yönetici (Manager)**: Tüm sisteme tam erişim.
- **Sakin (Resident)**: Sadece kendi ödemelerini ve bina duyurularını görür.

---
*Geliştirildi: 2026*
