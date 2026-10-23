from rest_framework import generics, permissions, serializers
from rest_framework.views import APIView
from rest_framework.response import Response
from .models import PlantedTree, TreeCareLog
from .serializers import PlantedTreeSerializer, TreeCareLogSerializer


class PlantedTreeListCreateView(generics.ListCreateAPIView):
    serializer_class = PlantedTreeSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return PlantedTree.objects.filter(
            calculation__user=self.request.user,
        ).order_by('id')


class PlantedTreeDetailView(generics.DestroyAPIView):
    serializer_class = PlantedTreeSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return PlantedTree.objects.filter(calculation__user=self.request.user)


class UserDashboardView(APIView):
    """Эндпоинт личного кабинета (Макет 5)"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        tree = PlantedTree.objects.filter(calculation__user=request.user).first()
        if not tree:
            return Response({"message": "Активных посадок не найдено"}, status=404)
        
        serializer = PlantedTreeSerializer(tree)
        return Response(serializer.data)

class AddCareLogView(generics.CreateAPIView):
    """Добавление записи в дневник роста"""
    serializer_class = TreeCareLogSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        planted_tree = serializer.validated_data.get('planted_tree')
        if planted_tree is None:
            user_trees = PlantedTree.objects.filter(calculation__user=self.request.user)
            if not user_trees.exists():
                raise serializers.ValidationError(
                    "У вашего аккаунта нет зарегистрированных посадок деревьев."
                )
            if user_trees.count() > 1:
                raise serializers.ValidationError({
                    'planted_tree': 'Укажите ID посадки, к которой относится запись.'
                })
            planted_tree = user_trees.first()

        serializer.save(planted_tree=planted_tree)