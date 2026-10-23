from io import BytesIO
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image
from rest_framework.test import APITestCase
from rest_framework import status
from django.urls import reverse
from .degradation import degradation_breakdown
from .models import Pet, TreeSpecies


class PetAndTreeSpeciesApiTests(APITestCase):
	def setUp(self):
		self.user = get_user_model().objects.create_user(
			username='owner',
			email='owner@example.com',
			password='test-password',
		)
		self.other_user = get_user_model().objects.create_user(
			username='other',
			email='other@example.com',
			password='test-password',
		)
		self.client.force_authenticate(self.user)

	def test_user_can_create_and_list_only_their_pets(self):
		Pet.objects.create(user=self.other_user, name='Other pet', species='Cat', weight_kg=4)

		response = self.client.post(reverse('pet_list_create'), {
			'name': 'Milo',
			'species': 'Cat',
			'breed': 'Mixed',
			'weight_kg': 4.5,
		})

		self.assertEqual(response.status_code, status.HTTP_201_CREATED)
		self.assertEqual(Pet.objects.get(pk=response.data['id']).user, self.user)

		response = self.client.get(reverse('pet_list_create'))
		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertEqual([pet['name'] for pet in response.data], ['Milo'])

	def test_user_can_upload_pet_photo_and_profile_details(self):
		image_buffer = BytesIO()
		Image.new('RGB', (1, 1), color='white').save(image_buffer, format='PNG')
		photo = SimpleUploadedFile(
			'pet.png',
			image_buffer.getvalue(),
			content_type='image/png',
		)

		response = self.client.post(reverse('pet_list_create'), {
			'name': 'Milo',
			'species': 'Cat',
			'breed': 'Mixed',
			'weight_kg': 4.5,
			'age_years': 8,
			'birth_date': '2018-04-12',
			'death_date': '2026-09-01',
			'photo': photo,
		}, format='multipart')

		self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
		self.assertTrue(response.data['photo'])
		pet = Pet.objects.get(pk=response.data['id'])
		self.assertEqual(pet.breed, 'Mixed')
		self.assertEqual(response.data['age_years'], 8)
		self.assertTrue(pet.photo.name)

	def test_pet_age_is_calculated_from_birth_and_death_dates(self):
		response = self.client.post(reverse('pet_list_create'), {
			'name': 'Milo',
			'species': 'Cat',
			'weight_kg': 4.5,
			'birth_date': '2018-12-20',
			'death_date': '2026-12-19',
		})

		self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
		self.assertEqual(response.data['age_years'], 7)

	def test_pet_death_date_cannot_precede_birth_date(self):
		response = self.client.post(reverse('pet_list_create'), {
			'name': 'Milo',
			'species': 'Cat',
			'weight_kg': 4.5,
			'birth_date': '2018-04-12',
			'death_date': '2018-04-11',
		})

		self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
		self.assertIn('death_date', response.data)

	def test_user_cannot_access_another_users_pet(self):
		pet = Pet.objects.create(user=self.other_user, name='Other pet', species='Cat', weight_kg=4)

		response = self.client.patch(reverse('pet_detail', args=[pet.pk]), {'name': 'Changed'})

		self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
		pet.refresh_from_db()
		self.assertEqual(pet.name, 'Other pet')

	def test_user_can_delete_their_pet(self):
		pet = Pet.objects.create(user=self.user, name='Milo', species='Cat', weight_kg=4.5)

		response = self.client.delete(reverse('pet_detail', args=[pet.pk]))

		self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
		self.assertFalse(Pet.objects.filter(pk=pet.pk).exists())

	def test_user_cannot_delete_another_users_pet(self):
		pet = Pet.objects.create(user=self.other_user, name='Other pet', species='Cat', weight_kg=4)

		response = self.client.delete(reverse('pet_detail', args=[pet.pk]))

		self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
		self.assertTrue(Pet.objects.filter(pk=pet.pk).exists())

	def test_user_can_clear_optional_pet_profile_fields(self):
		pet = Pet.objects.create(
			user=self.user,
			name='Milo',
			species='Cat',
			weight_kg=4.5,
			age_years=8,
			birth_date='2018-04-12',
			death_date='2026-09-01',
		)

		response = self.client.patch(
			reverse('pet_detail', args=[pet.pk]),
			{'age_years': '', 'birth_date': '', 'death_date': ''},
			format='multipart',
		)

		self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
		pet.refresh_from_db()
		self.assertIsNone(pet.birth_date)
		self.assertIsNone(pet.death_date)
		self.assertEqual(pet.age_years, 8)
		self.assertIsNone(response.data['age_years'])

	def test_tree_species_are_public_and_include_recommendation_fields(self):
		tree = TreeSpecies.objects.create(
			title='Pine',
			growth_rate='Medium',
			care_level='Low',
			lifespan='100 years',
			recommended_climate='Temperate',
			recommended_soil='Loam',
		)
		self.client.force_authenticate(user=None)

		response = self.client.get(reverse('tree_species_list'))

		self.assertEqual(response.status_code, status.HTTP_200_OK)
		tree_data = next(item for item in response.data if item['id'] == tree.id)
		self.assertEqual(tree_data['recommended_climate'], 'Умеренный')

	def test_tree_species_recommended_climates_are_localized_and_deduplicated(self):
		tree = TreeSpecies.objects.create(
			title='Pine',
			growth_rate='Medium',
			care_level='Low',
			lifespan='100 years',
			recommended_climate='Умеренный, Континентальный, Северный, Temperate, Continental, Northern',
			recommended_soil='Loam',
		)

		response = self.client.get(reverse('tree_species_list'))

		tree_data = next(item for item in response.data if item['id'] == tree.id)
		self.assertEqual(tree_data['recommended_climate'], 'Умеренный, Континентальный, Северный')

	def test_tree_species_recommended_soils_are_localized_and_deduplicated(self):
		tree = TreeSpecies.objects.create(
			title='Pine',
			growth_rate='Medium',
			care_level='Low',
			lifespan='100 years',
			recommended_climate='Temperate',
			recommended_soil='Песчаная, Суглинок, Sandy, Loam',
		)

		response = self.client.get(reverse('tree_species_list'))

		tree_data = next(item for item in response.data if item['id'] == tree.id)
		self.assertEqual(tree_data['recommended_soil'], 'Песчаная, Суглинок')

	def test_seeded_tree_catalog_covers_every_form_climate(self):
		climate_names = ('Южный', 'Умеренный', 'Континентальный', 'Северный')
		for climate in climate_names:
			with self.subTest(climate=climate):
				response = self.client.get(reverse('tree_species_list'))
				self.assertEqual(response.status_code, status.HTTP_200_OK)
				self.assertTrue(
					any(climate in tree['recommended_climate'].split(', ') for tree in response.data),
					f'No seeded trees available for climate {climate}',
				)

	def test_calculation_selects_a_tree_matching_climate_and_soil(self):
		response = self.client.post(reverse('calculate'), {
			'weight': 8,
			'scenario': 'Memorial tree',
			'region': 'South',
			'climate': 'Южный',
			'soil': 'Чернозём',
			'lighting': 'Sunny',
		})

		self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
		self.assertIsNotNone(response.data['recommended_tree'])
		self.assertIn('Южный', response.data['recommended_tree']['recommended_climate'])
		self.assertIn('Чернозём', response.data['recommended_tree']['recommended_soil'])

	def test_calculation_saves_required_fields_and_owns_linked_pet(self):
		pet = Pet.objects.create(user=self.user, name='Milo', species='Cat', weight_kg=4.5)
		TreeSpecies.objects.create(
			title='Pine',
			growth_rate='Medium',
			care_level='Low',
			lifespan='100 years',
			recommended_climate='Temperate',
			recommended_soil='Loam',
		)

		response = self.client.post(reverse('calculate'), {
			'weight': 4.5,
			'scenario': 'Memorial tree',
			'region': 'Northwest',
			'climate': 'Temperate',
			'soil': 'Loam',
			'lighting': 'Partial shade',
			'pet_id': pet.id,
		})

		self.assertEqual(response.status_code, status.HTTP_201_CREATED)
		self.assertEqual(response.data['pet'], pet.id)
		self.assertEqual(response.data['water_proximity'], 'Нет')
		self.assertEqual(response.data['care_level_pref'], '')
		self.assertEqual(response.data['desired_growth_time'], '')
		self.assertEqual(response.data['weight_kg'], 4.5)
		self.assertEqual(response.data['estimated_degradation_months'], 5.4)
		self.assertEqual(response.data['degradation_breakdown'], {
			'base_months': 6.0,
			'weight_kg': 4.5,
			'k_weight': 0.9,
			'k_soil': 1.0,
			'k_climate': 1.0,
			'total_months': 5.4,
		})

	def test_degradation_model_applies_weight_soil_and_climate_factors(self):
		self.assertEqual(
			degradation_breakdown(5, 'Чернозём', 'Южный')['total_months'],
			4.9,
		)
		self.assertEqual(
			degradation_breakdown(20, 'Глинистая', 'Северный')['total_months'],
			10.1,
		)
		self.assertEqual(
			degradation_breakdown(20.1, 'Суглинок', 'Умеренный')['total_months'],
			7.2,
		)

	def test_calculation_rejects_unknown_soil_or_climate(self):
		payload = {
			'weight': 4.5,
			'scenario': 'Memorial tree',
			'region': 'Northwest',
			'climate': 'Unknown climate',
			'soil': 'Loam',
			'lighting': 'Partial shade',
		}
		response = self.client.post(reverse('calculate'), payload)
		self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
		self.assertIn('climate', response.data)

		payload['climate'] = 'Temperate'
		payload['soil'] = 'Unknown soil'
		response = self.client.post(reverse('calculate'), payload)
		self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
		self.assertIn('soil', response.data)

	def test_calculation_climate_must_match_a_known_region(self):
		response = self.client.post(reverse('calculate'), {
			'weight': 8,
			'scenario': 'Memorial tree',
			'region': 'Москва',
			'climate': 'Северный',
			'soil': 'Суглинок',
			'lighting': 'Sunny',
		})

		self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
		self.assertIn('climate', response.data)

	def test_calculation_water_proximity_is_yes_or_no(self):
		response = self.client.post(reverse('calculate'), {
			'weight': 8,
			'scenario': 'Memorial tree',
			'region': 'Москва',
			'climate': 'Умеренный',
			'soil': 'Суглинок',
			'lighting': 'Sunny',
			'water_proximity': 'Рядом есть пруд',
		})

		self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
		self.assertIn('water_proximity', response.data)

	def test_pdf_passport_contains_saved_calculation_and_pet_data(self):
		pet = Pet.objects.create(
			user=self.user,
			name='Milo',
			species='Cat',
			breed='Mixed',
			weight_kg=4.5,
			age_years=8,
		)
		calculation_response = self.client.post(reverse('calculate'), {
			'weight': 4.5,
			'scenario': 'Memorial tree',
			'region': 'Northwest',
			'climate': 'Temperate',
			'soil': 'Loam',
			'lighting': 'Partial shade',
			'water_proximity': 'Да',
			'care_level_pref': 'Low',
			'desired_growth_time': 'Medium',
			'comment': 'A quiet place',
			'pet_id': pet.id,
		})
		self.assertEqual(calculation_response.status_code, status.HTTP_201_CREATED)

		response = self.client.get(reverse('download_pdf', args=[calculation_response.data['id']]))

		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertEqual(response['Content-Type'], 'application/pdf')
		self.assertIn(b'%PDF', response.content)
		self.assertIn(b'/ToUnicode', response.content)
		self.assertIn(b'memorial-', response['Content-Disposition'].encode())
