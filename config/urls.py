from django.contrib import admin
from django.urls import path, include
from django.http import HttpResponse
from core.views_frontend import (
    login_page,
    register_page,
    dashboard_resident,
    dashboard_manager,
)

def home(request):
    return HttpResponse("<h2>Bina Yönetim Sistemi Çalışıyor ✅</h2>")

urlpatterns = [
    path("", home, name="home"),
    path("admin/", admin.site.urls),
    path("api/", include("core.urls")),
    path("login/", login_page, name="login"),
    path("register/", register_page, name="register"),
    path("dashboard/", dashboard_resident, name="dashboard"),
    path("manager-dashboard/", dashboard_manager, name="manager-dashboard"),
]
