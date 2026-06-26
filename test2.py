import base64, os

# El archivo index.html correcto en base64
data = urllib = __import__('urllib.request', fromlist=['request'])

url = 'https://us-central1-pragma-2c5d1.cloudfunctions.net/api/ping'
try:
    r = __import__('urllib.request', fromlist=['request']).request.urlopen(url)
    print('conexion ok')
except:
    print('sin conexion')

dest = r'C:\Users\ADMIN-15\super-plataforma\dist\index.html'
print('destino:', dest)
print('existe:', os.path.exists(dest))
