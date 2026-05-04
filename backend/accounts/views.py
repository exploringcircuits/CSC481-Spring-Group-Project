import json
from django.http import JsonResponse
from django.contrib.auth.models import User
from django.views.decorators.csrf import csrf_exempt

# Registration endpoint — creates a new user in Django's default auth_user table.
# @csrf_exempt is used here for local development only.
@csrf_exempt
def api_register(request):
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            username = data.get('username')
            password = data.get('password')
        except json.JSONDecodeError:
            return JsonResponse({'error': 'Invalid JSON format sent.'}, status=400)

        # Validate that both fields were provided
        if not username or not password:
            return JsonResponse({'error': 'Username and password are required.'}, status=400)

        # Check if the username already exists in the database
        if User.objects.filter(username=username).exists():
            return JsonResponse({'error': 'Username already taken.'}, status=409)

        # create_user handles password hashing automatically
        User.objects.create_user(username=username, password=password)

        return JsonResponse({'message': 'User created successfully.'}, status=201)

    return JsonResponse({'error': 'Only POST requests are allowed for registration.'}, status=405)