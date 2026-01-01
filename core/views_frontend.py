from django.shortcuts import render

def login_page(request):
    return render(request, 'pages/login.html')

def register_page(request):
    return render(request, 'pages/register.html')

def dashboard_resident(request):
    return render(request, 'pages/dashboard_resident.html')

def dashboard_manager(request):
    return render(request, 'pages/dashboard_manager.html')
