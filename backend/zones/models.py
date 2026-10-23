from django.db import models

class EcoZone(models.Model):
    name = models.CharField(max_length=150)  # Эко-парк "Северный"
    zone_type = models.CharField(max_length=100)  # Официальный мемориальный лес
    address = models.CharField(max_length=255)  # г. СПб, 12 км
    latitude = models.FloatField()
    longitude = models.FloatField()
    region = models.CharField(max_length=100, blank=True)
    climate = models.CharField(max_length=50, blank=True)
    near_water = models.BooleanField(default=False)
    is_demo = models.BooleanField(default=False)
    has_care_service = models.BooleanField(default=True)  # Доступен уход за саженцами
    rules = models.TextField()
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.name