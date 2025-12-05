from django.urls import path
from .views import (
    RegisterView,
    MeView,
    pending_members,
    approve_member,
    reject_member,
    list_members,
    member_detail,
    transactions,
    announcements,
    update_announcement,
    delete_announcement,
    resident_dashboard,
    resident_dues,
    resident_payment_notify,
    list_all_dues,
    list_payment_notifications,

    # EKLEDİKLERİM 🔥
    create_monthly_dues,
    approve_payment_notification,
    reject_payment_notification,
)
from .auth_views import EmailTokenObtainPairView
from .views import ManagerDashboardView

urlpatterns = [
    # Kayıt ve kimlik doğrulama
    path("register/", RegisterView.as_view(), name="register"),
    path("auth/token/", EmailTokenObtainPairView.as_view(), name="token_obtain"),
    path("me/", MeView.as_view(), name="me"),

    # Yönetici işlemleri
    path("manager/pending/", pending_members),
    path("manager/approve/<int:user_id>/", approve_member),
    path("manager/reject/<int:user_id>/", reject_member),

    # Üye listeleme
    path("manager/members/", list_members),
    path("manager/member/<int:user_id>/", member_detail),

    # Finans
    path("transactions/", transactions),

    # Duyurular
    path("announcements/", announcements),
    path("announcements/<int:ann_id>/", update_announcement),
    path("announcements/<int:ann_id>/delete/", delete_announcement),

    # Yönetici dashboard
    path("manager/dashboard/", ManagerDashboardView.as_view()),

    # Sakin (resident)
    path("resident/dashboard/", resident_dashboard),
    path("resident/dues/", resident_dues),
    path("resident/payment-notify/", resident_payment_notify),

    # Aidat & Bildirim listeleri
    path("manager/dues/", list_all_dues),
    path("manager/payment-notifications/", list_payment_notifications),

    # 🔥 Aidat oluşturma (FRONTEND'DE VAR)
    path("manager/dues/create-monthly/", create_monthly_dues),

    # 🔥 Ödeme onay
    path("manager/payment-notification/<int:notif_id>/approve/", approve_payment_notification),

    # 🔥 Ödeme red
    path("manager/payment-notification/<int:notif_id>/reject/", reject_payment_notification),
]
