from django.urls import path
from . import views

urlpatterns = [
    path('register/', views.api_register, name='api_register'),
]