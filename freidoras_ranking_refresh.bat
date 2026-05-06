@echo off
set PYTHONUTF8=1
set PATH=C:\Users\cnatale\Git\mingw64\bin;%PATH%
set LOG=C:\Users\cnatale\Claudio\Reportes\freidoras_ranking.log
set HTML=C:\Users\cnatale\Claudio\Reportes\freidoras_ranking.html
set DOC_ID_FILE=C:\Users\cnatale\Claudio\Reportes\freidoras_grid_doc_id.txt

echo [%date% %time%] === Ranking Electro Diario refresh === >> "%LOG%"

python "C:\Users\cnatale\Claudio\Reportes\freidoras_ranking.py" >> "%LOG%" 2>&1
if errorlevel 1 (
    echo [%date% %time%] ERROR: Python script fallo. >> "%LOG%"
    exit /b 1
)

python "C:\Users\cnatale\Claudio\grid_upload.py" "%HTML%" "Ranking Electro Diario - MLA" "%DOC_ID_FILE%" >> "%LOG%" 2>&1

echo [%date% %time%] Refresh completado. >> "%LOG%"