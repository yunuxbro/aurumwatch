# AurumWatch LK
Daily gold buying and pricing risk monitor for small Sri Lankan jewellers. ModelX 2.0.

## Setup
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt

## Load data
python src/ingest_world.py
python src/ingest_fx.py
python src/check_data.py
