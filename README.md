# MeNewLab

Simulación interactiva del método de Euler aplicada al movimiento unidimensional (con restricciones a gravedad y resistencia del aire).

La aplicación está construida únicamente con HTML, CSS y JavaScript.

### Uso

Validar el JavaScript:

```bash
make check
```

Abrir la aplicación (linux/MacOS):

```bash
make open
```

Inicializar un servidor local:

```bash
make run
```

Ir a [http://localhost:8000](http://localhost:8000) o en su defecto al puerto de uso:

```bash
make serve PORT=8080
```

## Estructura:

```text
.
├── index.html       # Interfaz, controles y elementos de las gráficas
├── style.css        # Diseño visual y distribución responsiva
├── simulation.js    # Física, método de Euler, gráficas y animación
├── Makefile         # Comandos de validación y ejecución
└── README.md        # Documentación del proyecto
```

## Método de Euler

En cada paso de tiempo se conocen la posición (x_n), la velocidad (v_n) y la aceleración (a_n). El siguiente estado se calcula mediante:

```text
xₙ₊₁ = xₙ + vₙ Δt
vₙ₊₁ = vₙ + aₙ Δt
```

La aceleración se vuelve a calcular usando la nueva velocidad. Reducir `Δt` normalmente mejora la aproximación, aunque aumenta el número de pasos.

## Modelos disponibles

### 1. Resistencia cuadrática

```text
a = −k₁ v²
```

### 2. Resistencia lineal

```text
a = −k₂ v
```

### 3. Gravedad y resistencia cuadrática

```text
a = g − k₁ v²
```

### 4. Gravedad y resistencia lineal

```text
a = g − k₂ v
```

En los cuatro casos matemáticos, la posición y la velocidad se calculan con Euler y se comparan con la solución analítica cuando está disponible.

Importante: en los casos (1) y (2), si (v_0=0) y no existe gravedad, el cuerpo permanece en reposo:

```text
v(t) = 0
x(t) = x₀
```

Todos los modelos se visualizan sobre un eje vertical con sentido positivo hacia arriba y sentido negativo hacia abajo. La aplicación permite introducir una velocidad inicial descendente; internamente esa velocidad tiene signo negativo. Si se usa (v_0=0) en los modelos (1) y (2), la pelota permanece arriba porque la resistencia no puede iniciar el movimiento.

## Gráficas

El ejecutable muestra:

- posición frente al tiempo, (x(t));
- velocidad frente al tiempo, (v(t));
- velocidad frente a posición, (v(x));
- coeficiente de arrastre de una esfera frente al número de Reynolds, (C_A(Re)).

Las líneas de Euler y analítica se muestran juntas para estudiar el error numérico. El modo Dragon no tiene una solución analítica cerrada porque la densidad del aire cambia con la altura; por eso en ese modo se muestra únicamente la solución numérica.

## Número de Reynolds

El régimen del flujo se estima mediante:

```text
Re = v D ρ / μ
```

La interpretación utilizada en la interfaz es:

- `Re < 1`: régimen lineal, dominado por la viscosidad;
- `Re > 1`: régimen cuadrático, dominado por efectos inerciales.

Para una esfera, la aplicación usa una curva educativa aproximada de (C_A) en función de (Re). En un estudio mas formal, habría que considerar rugosidad, compresibilidad, número de Mach y el régimen de flujo.

## Parámetros físicos

Para una esfera de diámetro (D), masa (m), densidad del aire (ho), viscosidad dinámica (mu) y coeficiente de arrastre (C_A), se calculan los coeficientes de aceleración como:

```text
k₁ = ρ C_A π D² / (8m)
k₂ = 3πDμ / m
```

La división entre la masa es necesaria porque la aplicación trabaja con aceleración y no directamente con fuerza.

La interfaz incluye presets para un balón de fútbol, un grano de polen y la cápsula Dragon. El balón usa el caso (3), resistencia cuadrática más gravedad, y el polen usa el caso (4), resistencia lineal más gravedad; ambos parten del reposo. En estos casos, la rapidez aumenta mientras la aceleración neta hacia abajo disminuye al acercarse a la velocidad terminal. La lectura “Aceleración vertical (↓ +)” usa positivo hacia abajo, como las ecuaciones de la guía.

Los modelos sin gravedad no representan una caída desde el reposo. En los casos (1) y (2), con (v_0=0), la pelota permanece quieta; con una velocidad inicial descendente distinta de cero, el arrastre la frena. Esto conserva las ecuaciones de la guía y evita añadir gravedad de manera implícita.

Al activar “Usar coeficiente calculado físicamente”, el programa selecciona (k_1) o (k_2) según el modelo elegido. De esta forma, la comparación entre el balón y el polen no utiliza artificialmente el mismo valor de (k).

## Modelo Dragon

El modo Dragon representa una cápsula esférica que desciende verticalmente desde una altura inicial. La densidad atmosférica se aproxima mediante:

```text
ρ(h) = ρ₀ exp(−m₀ g h / (kB T))
```

En cada paso de la implementacion de Euler se actualizan:

1. la posición vertical;
2. la altura restante;
3. la densidad local;
4. el número de Reynolds;
5. el coeficiente de arrastre;
6. la aceleración;
7. la velocidad.

El panel de régimen permite observar si la velocidad local es suficientemente pequeña para que `Re < 1` y el comportamiento lineal sea una aproximación razonable. Durante una reentrada normal, la velocidad suele producir valores de Reynolds mucho mayores que uno, por lo que el régimen cuadrático es generalmente más relevante.

## Limitaciones del modelo

El modo Dragon no representa una reentrada aeroespacial completa porque no incluye:

- variación realista de temperatura con la altura;
- velocidad del sonido y número de Mach;
- calentamiento aerodinámico;
- orientación de la cápsula;
- atmósfera estándar completa;
- variación de (C_A) con Mach y configuración;
- rotación de la Tierra;
- despliegue del paracaídas.

Su objetivo es mostrar cómo una integración de Euler puede incorporar una densidad variable y cómo el régimen de arrastre depende de Reynolds.

Como problema abierto a futuro de esta implementacion esta reconsiderar la situacion de Dragon a una escala industrial que soporte la reentrada aeroespacial completa.

## Verificación

El proyecto no usa dependencias de Node. La comprobación básica disponible es:

```bash
make check
```

Este comando verifica la sintaxis de `simulation.js` y que los tres archivos principales existan.
