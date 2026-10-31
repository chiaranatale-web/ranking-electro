# Ranking Electro MLA

La portada agrupa las categorías en un menú y abre Total MLA. `snapshot.html` conserva el HTML original y su archivo histórico de Hot Sale. `preview.html` usa los mismos assets que la portada.

El lector consume `data/daily.json` (ayer, últimos 7 días y stock diario) y `data/hoy.json` (día actual). Fury genera ambos archivos: diario a las 09:00 y Hoy cada 30 minutos, zona America/Argentina/Buenos_Aires. El lector vuelve a cargar ambos cada 30 minutos. Una actualización diaria atrasada se indica explícitamente; sus fechas nunca se sustituyen por las del calendario sin datos nuevos.

Cada archivo contiene `schema_version: 1`, `kind` (`daily` o `hoy`), `generated_at` con zona horaria, `dates` (`hoy`, `ayer`, `week_start`, ISO de fecha) y `rows`. Las filas llevan `period`, `panel`, `item_id` sin prefijo MLA, `title`, `brand`, `seller`, `subcombo`, `categoria`, `nsi`, `nmv`, `precio` y opcionalmente `stock`.

El productor valida la respuesta antes de reemplazar el último archivo válido. La fecha procede de la consulta, incluso si cruza medianoche. El lector rechaza períodos o métricas inválidos y muestra la hora de cada actualización. Hot Sale permanece histórico.

La variación compara Ayer con Anteayer, la ventana de últimos siete días con la misma ventana desplazada un día y Hoy con Ayer al cierre. Se calcula por panel e ítem y respeta la métrica seleccionada (NSI/NMV), dentro del Top 50 de NSI mostrado por el tablero. `previous_rank_nsi`, `previous_rank_nmv` y `comparison_available` proceden de la consulta diaria; Hoy utiliza el ranking de Ayer del archivo diario, solo si corresponde a la fecha correcta. ▲/▼ indica posiciones ganadas/perdidas, NEW indica entrada al Top 50 y — significa empate o referencia no disponible (explicada en el tooltip). Cambiar de métrica recalcula la variación.

El nodo BigQuery diario reintenta hasta cinco veces con cinco segundos entre intentos ante fallas transitorias. Una saturación prolongada del proyecto compartido puede superar esos intentos; la hora visible y el control de frescura permiten detectarla sin presentar datos viejos como nuevos.
