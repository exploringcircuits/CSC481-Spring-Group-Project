from django.urls import path, include
from django.contrib import admin
from .views import home, register_view, login_view, logout_view
urlpatterns = [
   path('', home, name='home'),
    path('register/', register_view, name='register'),
    path('login/', login_view, name='login'),
]