from django.conf import settings
from django.conf.urls.static import static
from django.urls import path
from users.views import RegisterView, UserProfileView
from calculator.views import (
    CalculateCapsuleView,
    DownloadPDFPassportView,
    PetDetailView,
    PetListCreateView,
    TreeSpeciesListView,
)
from zones.views import (
    EcoZoneAdminDetailView,
    EcoZoneAdminListCreateView,
    EcoZoneListView,
)
from tracker.views import AddCareLogView, PlantedTreeDetailView, PlantedTreeListCreateView, UserDashboardView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

urlpatterns = [
    # Auth (Экран 4)
    path('api/v1/auth/register/', RegisterView.as_view(), name='register'),
    path('api/v1/auth/login/', TokenObtainPairView.as_view(), name='login'),
    path('api/v1/auth/profile/', UserProfileView.as_view(), name='user_profile'),

    # Calculator (Экран 2)
    path('api/v1/calculator/calculate/', CalculateCapsuleView.as_view(), name='calculate'),
    path('api/v1/calculator/<int:calculation_id>/pdf/', DownloadPDFPassportView.as_view(), name='download_pdf'),
    path('api/v1/calculator/pets/', PetListCreateView.as_view(), name='pet_list_create'),
    path('api/v1/calculator/pets/<int:pk>/', PetDetailView.as_view(), name='pet_detail'),
    path('api/v1/calculator/tree-species/', TreeSpeciesListView.as_view(), name='tree_species_list'),

    # Map / Zones (Экран 3)
    path('api/v1/zones/', EcoZoneListView.as_view(), name='zone_list'),
    path('api/v1/admin/zones/', EcoZoneAdminListCreateView.as_view(), name='admin_zone_list_create'),
    path('api/v1/admin/zones/<int:pk>/', EcoZoneAdminDetailView.as_view(), name='admin_zone_detail'),

    # Dashboard / Tracker (Экран 5)
    path('api/v1/dashboard/', UserDashboardView.as_view(), name='dashboard'),
    path('api/v1/tracker/plantings/', PlantedTreeListCreateView.as_view(), name='planting_list_create'),
    path('api/v1/tracker/plantings/<int:pk>/', PlantedTreeDetailView.as_view(), name='planting_detail'),
    path('api/v1/tracker/logs/add/', AddCareLogView.as_view(), name='add_log'),
    path('api/v1/auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)