from django.contrib import admin
from .models import User, Building

@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ('email', 'role', 'building', 'approved', 'is_active')
    list_filter = ('role', 'approved', 'building')
    search_fields = ('email', 'first_name', 'last_name')

@admin.register(Building)
class BuildingAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'address')
    search_fields = ('name',)
