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
)
from .auth_views import EmailTokenObtainPairView
from .views import ManagerDashboardView

urlpatterns = [
    # Kayıt ve kimlik doğrulama
    path("register/", RegisterView.as_view(), name="register"),
    path("auth/token/", EmailTokenObtainPairView.as_view(), name="token_obtain"),
    path("me/", MeView.as_view(), name="me"),

    # Yönetici işlemleri
    path("manager/pending/", pending_members, name="pending_members"),
    path("manager/approve/<int:user_id>/", approve_member, name="approve_member"),
    path("manager/reject/<int:user_id>/", reject_member, name="reject_member"),

    # Üye listeleme ve detay görüntüleme
    path("manager/members/", list_members, name="list_members"),
    path("manager/member/<int:user_id>/", member_detail, name="member_detail"),

    # Finansal işlemler
    path("transactions/", transactions, name="transactions"),

    # Duyurular
    path("announcements/", announcements, name="announcements"),
    path("announcements/<int:ann_id>/", update_announcement, name="update_announcement"),
    path("announcements/<int:ann_id>/delete/", delete_announcement, name="delete_announcement"),

    # Yönetici dashboard
    path("manager/dashboard/", ManagerDashboardView.as_view(), name="manager_dashboard"),

    # Sakin (resident) endpointleri
    path("resident/dashboard/", resident_dashboard, name="resident_dashboard"),
    path("resident/dues/", resident_dues, name="resident_dues"),
]
