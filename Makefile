.DEFAULT_GOAL := help

PORT ?= 8000
PYTHON ?= python3

.PHONY: help check open serve

help:
	@echo "Comandos disponibles:"
	@echo "  make check       Verifica la sintaxis y los archivos principales"
	@echo "  make open        Abre index.html en macOS"
	@echo "  make serve       Inicia un servidor local en el puerto $(PORT)"
	@echo "  make serve PORT=8080  Inicia el servidor en otro puerto"

check:
	@test -f index.html || (echo "Falta index.html" && exit 1)
	@test -f style.css || (echo "Falta style.css" && exit 1)
	@test -f simulation.js || (echo "Falta simulation.js" && exit 1)
	@node --check simulation.js
	@echo "Verificación completada correctamente."

open:
	@open index.html

serve:
	@$(PYTHON) -m http.server $(PORT)
