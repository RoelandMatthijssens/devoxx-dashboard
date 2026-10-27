PYTHON ?= python3
PORT ?= 8000
HOST ?= localhost

.PHONY: serve
serve:
	@echo "Serving Devoxx schedule at http://$(HOST):$(PORT)/"
	$(PYTHON) -m http.server $(PORT) --bind $(HOST)
