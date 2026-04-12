VENV = venv
PYTHON = $(VENV)/bin/python
PIP = $(VENV)/bin/pip

.PHONY: install run clean

install:
	python3 -m venv $(VENV)
	$(PIP) install -r backend/requirements.txt

run:
	$(PYTHON) backend/app.py

clean:
	rm -rf $(VENV) __pycache__
