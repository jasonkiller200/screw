@echo off
echo Activating virtual environment...
call .\activate_venv.bat

echo Running database migrations...
alembic upgrade head

echo Database update complete.
pause
