from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from calculator.models import CapsuleCalculation, Pet, TreeSpecies
from zones.models import EcoZone
from .models import PlantedTree, TreeCareLog


class PlantingApiTests(APITestCase):
	def setUp(self):
		user_model = get_user_model()
		self.user = user_model.objects.create_user(
			username='owner',
			email='owner@example.com',
			password='test-password',
		)
		self.other_user = user_model.objects.create_user(
			username='other',
			email='other@example.com',
			password='test-password',
		)
		self.pet = Pet.objects.create(
			user=self.user,
			name='Milo',
			species='Cat',
			weight_kg=4.5,
		)
		self.other_pet = Pet.objects.create(
			user=self.other_user,
			name='Luna',
			species='Cat',
			weight_kg=3.0,
		)
		self.tree_species = TreeSpecies.objects.create(
			title='Pine',
			growth_rate='Medium',
			care_level='Low',
			lifespan='100 years',
			recommended_climate='Temperate',
			recommended_soil='Loam',
		)
		self.zone = EcoZone.objects.create(
			name='North Park',
			zone_type='Memorial forest',
			address='North district',
			latitude=60.0,
			longitude=30.0,
			rules='Follow park rules',
		)
		self.calculation = self.create_calculation(self.user, self.pet)
		self.other_calculation = self.create_calculation(self.other_user, self.other_pet)
		self.client.force_authenticate(self.user)

	def create_calculation(self, user, pet):
		return CapsuleCalculation.objects.create(
			user=user,
			pet=pet,
			memorial_scenario='Memorial tree',
			region='Northwest',
			climate='Temperate',
			soil_type='Loam',
			lighting='Partial shade',
			water_proximity='Near water',
			care_level_pref='Low',
			desired_growth_time='Medium',
		)

	def planting_payload(self, calculation=None, pet=None):
		return {
			'calculation': (calculation or self.calculation).id,
			'pet': (pet or self.pet).id,
			'tree_species': self.tree_species.id,
			'eco_zone': self.zone.id,
			'planting_date': '2026-05-10',
			'location_details': 'Memorial path, plot A-12',
		}

	def test_user_can_create_and_list_only_their_plantings(self):
		other_tree = PlantedTree.objects.create(
			calculation=self.other_calculation,
			pet=self.other_pet,
			tree_species=self.tree_species,
			eco_zone=self.zone,
			planting_date='2026-05-10',
			location_details='Other plot',
		)

		create_response = self.client.post(
			reverse('planting_list_create'),
			self.planting_payload(),
		)

		self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
		self.assertEqual(create_response.data['calculation'], self.calculation.id)

		list_response = self.client.get(reverse('planting_list_create'))
		self.assertEqual(list_response.status_code, status.HTTP_200_OK)
		self.assertEqual(len(list_response.data), 1)
		self.assertNotEqual(list_response.data[0]['id'], other_tree.id)

	def test_user_can_create_planting_on_their_own_plot_without_an_eco_zone(self):
		payload = self.planting_payload()
		payload['eco_zone'] = None
		payload['location_details'] = 'Собственный участок'

		response = self.client.post(reverse('planting_list_create'), payload, format='json')

		self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
		self.assertIsNone(response.data['eco_zone'])
		self.assertEqual(response.data['location_details'], 'Собственный участок')

	def test_user_cannot_create_planting_for_another_users_records(self):
		response = self.client.post(
			reverse('planting_list_create'),
			self.planting_payload(self.other_calculation, self.other_pet),
		)

		self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
		self.assertFalse(PlantedTree.objects.exists())

	def test_user_can_delete_planting_and_its_care_logs(self):
		planted_tree = PlantedTree.objects.create(
			calculation=self.calculation,
			pet=self.pet,
			tree_species=self.tree_species,
			eco_zone=self.zone,
			planting_date='2026-05-10',
			location_details='Memorial path, plot A-12',
		)
		TreeCareLog.objects.create(
			planted_tree=planted_tree,
			event_date='2026-10-23',
			title='Inspection',
		)

		response = self.client.delete(reverse('planting_detail', args=[planted_tree.pk]))

		self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
		self.assertFalse(PlantedTree.objects.filter(pk=planted_tree.pk).exists())
		self.assertFalse(TreeCareLog.objects.exists())

	def test_user_cannot_delete_another_users_planting(self):
		planted_tree = PlantedTree.objects.create(
			calculation=self.other_calculation,
			pet=self.other_pet,
			tree_species=self.tree_species,
			eco_zone=self.zone,
			planting_date='2026-05-10',
			location_details='Other plot',
		)

		response = self.client.delete(reverse('planting_detail', args=[planted_tree.pk]))

		self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
		self.assertTrue(PlantedTree.objects.filter(pk=planted_tree.pk).exists())

	def test_deleting_pet_removes_its_planting_and_care_logs(self):
		planted_tree = PlantedTree.objects.create(
			calculation=self.calculation,
			pet=self.pet,
			tree_species=self.tree_species,
			eco_zone=self.zone,
			planting_date='2026-05-10',
			location_details='Memorial path, plot A-12',
		)
		TreeCareLog.objects.create(
			planted_tree=planted_tree,
			event_date='2026-10-23',
			title='Inspection',
		)

		response = self.client.delete(reverse('pet_detail', args=[self.pet.pk]))

		self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
		self.assertFalse(PlantedTree.objects.filter(pk=planted_tree.pk).exists())
		self.assertFalse(TreeCareLog.objects.exists())

	def test_care_log_can_target_owned_planting(self):
		planted_tree = PlantedTree.objects.create(
			calculation=self.calculation,
			pet=self.pet,
			tree_species=self.tree_species,
			eco_zone=self.zone,
			planting_date='2026-05-10',
			location_details='Memorial path, plot A-12',
		)

		response = self.client.post(reverse('add_log'), {
			'planted_tree': planted_tree.id,
			'event_date': '2026-10-23',
			'title': 'Inspection',
			'description': 'Tree is healthy',
		})

		self.assertEqual(response.status_code, status.HTTP_201_CREATED)
		self.assertEqual(response.data['planted_tree'], planted_tree.id)
		self.assertEqual(TreeCareLog.objects.count(), 1)

	def test_care_log_cannot_target_another_users_planting(self):
		planted_tree = PlantedTree.objects.create(
			calculation=self.other_calculation,
			pet=self.other_pet,
			tree_species=self.tree_species,
			eco_zone=self.zone,
			planting_date='2026-05-10',
			location_details='Other plot',
		)

		response = self.client.post(reverse('add_log'), {
			'planted_tree': planted_tree.id,
			'event_date': '2026-10-23',
			'title': 'Inspection',
		})

		self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
		self.assertFalse(TreeCareLog.objects.exists())
