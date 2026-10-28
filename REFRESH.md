# Vista previa del ranking

La propuesta agrega `preview.html` para revisar un diseño con categorías agrupadas en un menú y Total MLA como vista inicial. Carga el `index.html` existente en la misma rama; no reemplaza su snapshot.

El lector consume `data/daily.json` (ayer, últimos 7 días y stock diario) y `data/hoy.json` (día actual). Esos archivos aún no se generan automáticamente. Los horarios previstos son 09:00 y cada 30 minutos, respectivamente, en Argentina. El origen de datos y sus credenciales se configuran en Fury.

Cada archivo contiene `schema_version: 1`, `kind` (`daily` o `hoy`), `generated_at` con zona horaria, `dates` (`hoy`, `ayer`, `week_start`, ISO de fecha) y `rows`. Las filas llevan `period`, `panel`, `item_id` sin prefijo MLA, `title`, `brand`, `seller`, `subcombo`, `categoria`, `nsi`, `nmv`, `precio` y opcionalmente `stock`.

El productor debe validar toda la respuesta antes de reemplazar el último archivo válido. La fecha debe corresponder a la consulta, incluso si la ejecución cruza medianoche. El lector rechaza períodos o métricas inválidos, muestra la hora de cada actualización y conserva el snapshot si falla la conexión. Hot Sale permanece histórico. Las diferencias de ranking se muestran sin valor hasta incorporar una comparación validada.

Esta propuesta no activa horarios ni cambia la página principal. Falta validar el recorrido completo en Fury y revisar la vista previa antes de incorporar los assets a `index.html`.
