# Ranking Electro MLA

El sitio consume data/daily.json (ayer, últimos siete días y stock) y data/hoy.json (día actual). Fury genera un único JSON por consulta y actualiza cada archivo en forma independiente. La vista muestra la hora de cada actualización y conserva el último contenido disponible si falla una carga. Hoy requiere fecha argentina del día actual.

La propuesta visual agrupa las categorías en un menú y abre Total MLA. preview.html permite revisarla antes de conectar la portada. snapshot.html conserva el HTML original, incluido el archivo histórico de Hot Sale. Las diferencias de ranking quedan sin valor hasta incorporar una comparación validada.

Horarios previstos: diario a las 09:00 y Hoy cada 30 minutos, zona America/Argentina/Buenos_Aires. La activación y las credenciales se administran en Fury.
