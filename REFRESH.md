# Ranking Electro MLA

La portada agrupa las categorías en un menú y abre Total MLA. `snapshot.html` conserva el HTML original y su archivo histórico original. `preview.html` usa los mismos assets que la portada.

El lector consume `data/daily.json` (ayer, últimos 7 días y stock diario) y `data/hoy.json` (día actual). Fury genera ambos archivos: diario a las 09:00 y Hoy cada 30 minutos, zona America/Argentina/Buenos_Aires. El lector vuelve a cargar ambos cada 30 minutos. Una actualización diaria atrasada se indica explícitamente; sus fechas nunca se sustituyen por las del calendario sin datos nuevos.

Cada archivo contiene `schema_version: 2`, `kind` (`daily` o `hoy`), `generated_at` con zona horaria, `dates` (`hoy`, `ayer`, `week_start`, ISO de fecha) y `rows`. Las filas llevan `period`, `panel`, `item_id` sin prefijo MLA, `title`, `brand`, `seller`, `subcombo`, `categoria`, `nsi`, `nmv`, `precio` y opcionalmente `stock`.

El productor valida la respuesta antes de reemplazar el último archivo válido. La fecha procede de la consulta, incluso si cruza medianoche. El lector rechaza períodos o métricas inválidos y muestra la hora de cada actualización. La vista de Cyber Monday reemplaza el evento histórico y nunca reutiliza sus ventas.

La variación compara Ayer con Anteayer, la ventana de últimos siete días con la misma ventana desplazada un día y Hoy con Ayer al cierre. Se calcula por panel e ítem y respeta la métrica seleccionada (NSI/NMV), dentro del Top 50 independiente de la métrica seleccionada. `previous_rank_nsi`, `previous_rank_nmv` y `comparison_available` proceden de la consulta diaria; Hoy utiliza el ranking de Ayer del archivo diario, solo si corresponde a la fecha correcta. ▲/▼ indica posiciones ganadas/perdidas, NEW indica entrada al Top 50 y — significa empate o referencia no disponible (explicada en el tooltip). Cambiar de métrica recalcula la variación.

Los nodos BigQuery de ambos flujos reintentan hasta cinco veces con cinco segundos entre intentos ante fallas transitorias. Una saturación prolongada del proyecto compartido puede superar esos intentos; la hora visible y el control de frescura permiten detectarla sin presentar datos viejos como nuevos.

Cyber Monday abarca del 2 al 11 de noviembre de 2026 inclusive. La vista tiene acumulado y D1–D10, por categoría, con NSI/NMV y CSV. El diario incluye los períodos `cyber_acum` y `cyber_d1` a `cyber_d10`, únicamente de días cerrados, más `event` con `start_date`, `end_date` y `through_date`. El 2/11 se incorpora el 3/11 a las09:00; el cierre completo se publica el12/11. Antes del inicio se muestra Aún no comenzó; los días futuros no llevan ventas. El stock corresponde al snapshot diario, no al día histórico de venta.

Desde el02/11, el productor calcula rank(NSI) y rank_nmv sobre todo el universo antes de recortar. Publica la unión de ambos Top50, hasta100ítems por panel/período; el lector selecciona los50 de la métrica elegida. La vista NSI y la vista NMV pueden contener ítems diferentes. Las posiciones anteriores también corresponden al Top50 de cada métrica. Las unidades estimadas positivas menores a1 siguen habilitadas para el ranking por ventas. El campo nmv usa TGMV_LC de Planning y nsi usa TSI; ambos conservan la definición de la fuente.

Monitores usa exclusivamente el dominio `COMPUTER_MONITORS`, confirmado en la lista DOM ID de la referencia de Planning. Se añade como categoría independiente en Hoy, Ayer, últimos7d y Cyber Monday. La vista se crea desde la estructura de Televisores, sin copiar ventas históricas, y luego carga únicamente filas del panel `monitores`. No incluye monitores de audio, bebé, seguridad ni accesorios.
