from rest_framework import serializers
from .degradation import CLIMATE_FACTORS, SOIL_FACTORS, degradation_breakdown
from .models import CapsuleCalculation, Pet, TreeSpecies
from zones.models import EcoZone


def display_climates(value):
    climate_names = {
        'temperate': 'Умеренный',
        'continental': 'Континентальный',
        'northern': 'Северный',
        'north': 'Северный',
        'southern': 'Южный',
        'south': 'Южный',
    }
    climates = []
    for climate in value.split(','):
        normalized = climate.strip()
        if not normalized:
            continue
        displayed = climate_names.get(normalized.casefold(), normalized)
        if displayed.casefold() not in {item.casefold() for item in climates}:
            climates.append(displayed)
    return ', '.join(climates)


def display_soils(value):
    soil_names = {
        'sandy': 'Песчаная',
        'loam': 'Суглинок',
        'clay': 'Глинистая',
        'black soil': 'Чернозём',
    }
    soils = []
    for soil in value.split(','):
        normalized = soil.strip()
        if not normalized:
            continue
        displayed = soil_names.get(normalized.casefold(), normalized)
        if displayed.casefold() not in {item.casefold() for item in soils}:
            soils.append(displayed)
    return ', '.join(soils)


class TreeSpeciesSerializer(serializers.ModelSerializer):
    recommended_climate = serializers.SerializerMethodField()
    recommended_soil = serializers.SerializerMethodField()

    def get_recommended_climate(self, tree):
        return display_climates(tree.recommended_climate)

    def get_recommended_soil(self, tree):
        return display_soils(tree.recommended_soil)

    class Meta:
        model = TreeSpecies
        fields = [
            'id',
            'title',
            'growth_rate',
            'care_level',
            'lifespan',
            'recommended_climate',
            'recommended_soil',
            'image',
        ]


class PetSerializer(serializers.ModelSerializer):
    age_years = serializers.IntegerField(source='age_at_death_years', read_only=True, allow_null=True)

    def to_internal_value(self, data):
        normalized_data = {field: data.get(field) for field in data}
        for field in ('birth_date', 'death_date'):
            if normalized_data.get(field) == '':
                normalized_data[field] = None
        return super().to_internal_value(normalized_data)

    def validate(self, attrs):
        birth_date = attrs.get('birth_date', getattr(self.instance, 'birth_date', None))
        death_date = attrs.get('death_date', getattr(self.instance, 'death_date', None))
        if birth_date and death_date and death_date < birth_date:
            raise serializers.ValidationError({
                'death_date': 'Дата ухода не может быть раньше даты рождения.',
            })
        return attrs

    def validate_photo(self, value):
        if value and value.size > 10 * 1024 * 1024:
            raise serializers.ValidationError('Размер фотографии не должен превышать 10 МБ.')
        return value

    class Meta:
        model = Pet
        fields = [
            'id',
            'name',
            'species',
            'breed',
            'weight_kg',
            'age_years',
            'birth_date',
            'death_date',
            'photo',
        ]


class CalculationRequestSerializer(serializers.Serializer):
    weight = serializers.FloatField(required=False, default=10, min_value=0.1)
    scenario = serializers.CharField(max_length=100)
    region = serializers.CharField(max_length=100)
    climate = serializers.CharField(max_length=100)
    soil = serializers.CharField(max_length=100)
    lighting = serializers.CharField(max_length=100)
    water_proximity = serializers.ChoiceField(
        choices=(('Да', 'Да'), ('Нет', 'Нет')),
        required=False,
        default='Нет',
    )
    care_level_pref = serializers.CharField(max_length=100, required=False, allow_blank=True, default='')
    desired_growth_time = serializers.CharField(max_length=100, required=False, allow_blank=True, default='')
    comment = serializers.CharField(required=False, allow_blank=True, default='')
    pet_id = serializers.IntegerField(required=False, allow_null=True)

    def validate_climate(self, value):
        if value.strip().casefold() not in CLIMATE_FACTORS:
            raise serializers.ValidationError('Выберите поддерживаемый климатический тип.')
        return value

    def validate_soil(self, value):
        if value.strip().casefold() not in SOIL_FACTORS:
            raise serializers.ValidationError('Выберите поддерживаемый тип почвы.')
        return value

    def validate(self, attrs):
        region_climates = set(
            EcoZone.objects.filter(is_active=True, region=attrs['region'])
            .exclude(climate='')
            .values_list('climate', flat=True)
        )
        if len(region_climates) == 1:
            region_climate = next(iter(region_climates))
            if attrs['climate'].strip().casefold() != region_climate.casefold():
                raise serializers.ValidationError({
                    'climate': 'Климат определяется выбранным регионом.',
                })
        elif len(region_climates) > 1:
            raise serializers.ValidationError({
                'region': 'Для выбранного региона не настроен единственный климат.',
            })
        return attrs

    def validate_pet_id(self, value):
        request = self.context['request']
        if value is not None and not request.user.is_authenticated:
            raise serializers.ValidationError('Для привязки питомца необходимо войти в аккаунт.')
        if value is not None and not Pet.objects.filter(pk=value, user=request.user).exists():
            raise serializers.ValidationError('Питомец не найден в вашем аккаунте.')
        return value

class CalculationSerializer(serializers.ModelSerializer):
    recommended_tree = TreeSpeciesSerializer(read_only=True)
    degradation_breakdown = serializers.SerializerMethodField()

    def get_degradation_breakdown(self, calculation):
        weight = calculation.weight_kg
        if weight is None and calculation.pet_id:
            weight = calculation.pet.weight_kg
        if weight is None:
            return None
        return degradation_breakdown(weight, calculation.soil_type, calculation.climate)

    class Meta:
        model = CapsuleCalculation
        fields = '__all__'