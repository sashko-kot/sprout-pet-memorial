from django.db import migrations, models


SEEDED_ZONES = {
    'Эко-парк «Северный»': {
        'region': 'Санкт-Петербург',
        'climate': 'Умеренный',
        'near_water': True,
    },
    'Зелёный мемориальный парк': {
        'region': 'Москва',
        'climate': 'Умеренный',
        'near_water': True,
    },
    'Лес памяти «Исток»': {
        'region': 'Московская область',
        'climate': 'Умеренный',
        'near_water': False,
    },
    'Эко-парк «Южный»': {
        'region': 'Краснодарский край',
        'climate': 'Южный',
        'near_water': True,
    },
}

DEMO_ZONES = [
    {
        'name': 'Демо-парк у Истринского водохранилища',
        'zone_type': 'Демо-парк',
        'address': 'Московская область, берег Истринского водохранилища',
        'latitude': 55.916,
        'longitude': 36.849,
        'region': 'Московская область',
        'climate': 'Умеренный',
        'near_water': True,
        'is_demo': True,
        'has_care_service': False,
        'rules': 'Демонстрационные координаты у водоёма. Это не подтверждённая площадка для посадки.',
        'is_active': True,
    },
    {
        'name': 'Демо-парк у Оби',
        'zone_type': 'Демо-парк',
        'address': 'г. Новосибирск, берег реки Оби',
        'latitude': 55.0084,
        'longitude': 82.9357,
        'region': 'Новосибирская область',
        'climate': 'Континентальный',
        'near_water': True,
        'is_demo': True,
        'has_care_service': False,
        'rules': 'Демонстрационные координаты у реки. Это не подтверждённая площадка для посадки.',
        'is_active': True,
    },
    {
        'name': 'Демо-парк у Онежского озера',
        'zone_type': 'Демо-парк',
        'address': 'г. Петрозаводск, берег Онежского озера',
        'latitude': 61.7849,
        'longitude': 34.3469,
        'region': 'Республика Карелия',
        'climate': 'Северный',
        'near_water': True,
        'is_demo': True,
        'has_care_service': False,
        'rules': 'Демонстрационные координаты у озера. Это не подтверждённая площадка для посадки.',
        'is_active': True,
    },
]


def add_location_metadata(apps, schema_editor):
    EcoZone = apps.get_model('zones', 'EcoZone')
    manager = EcoZone.objects.using(schema_editor.connection.alias)

    for name, metadata in SEEDED_ZONES.items():
        manager.filter(name=name).update(**metadata, is_demo=True)

    for zone in DEMO_ZONES:
        manager.get_or_create(
            name=zone['name'],
            address=zone['address'],
            defaults=zone,
        )


def remove_location_metadata(apps, schema_editor):
    EcoZone = apps.get_model('zones', 'EcoZone')
    manager = EcoZone.objects.using(schema_editor.connection.alias)

    for zone in DEMO_ZONES:
        manager.filter(name=zone['name'], address=zone['address']).delete()
    for name in SEEDED_ZONES:
        manager.filter(name=name).update(
            region='',
            climate='',
            near_water=False,
            is_demo=False,
        )


class Migration(migrations.Migration):

    dependencies = [
        ('zones', '0002_seed_eco_zones'),
    ]

    operations = [
        migrations.AddField(
            model_name='ecozone',
            name='region',
            field=models.CharField(blank=True, max_length=100),
        ),
        migrations.AddField(
            model_name='ecozone',
            name='climate',
            field=models.CharField(blank=True, max_length=50),
        ),
        migrations.AddField(
            model_name='ecozone',
            name='near_water',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='ecozone',
            name='is_demo',
            field=models.BooleanField(default=False),
        ),
        migrations.RunPython(add_location_metadata, remove_location_metadata),
    ]
