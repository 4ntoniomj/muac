# Spec: Rotación de Cuentas Antigravity Pro

## Purpose
Gestionar la rotación y alternancia automática y manual de credenciales de cuentas Google AI / Antigravity Pro en base al consumo de cuota de 5 horas y semanal.

## Requirements

### Requirement: Detección y Sincronización de Credenciales
El sistema debe leer y escribir credenciales en Linux Secret Service (D-Bus) en el servicio 'gemini' y usuario 'antigravity'.

#### Scenario: Sincronización exitosa
- **WHEN** Se activa una cuenta en el sistema
- **THEN** Se actualiza el Secret Service mediante el puente Python para que `agy` use la cuenta seleccionada.

### Requirement: Rotación Automática por Agotamiento
El sistema debe detectar el agotamiento de cuota y conmutar a la cuenta con mayor tiempo o porcentaje disponible en el pool.

#### Scenario: Cuota agotada en 5h o semanal
- **WHEN** La cuenta actual tiene remaining_fraction menor al umbral (por defecto 0.05) o responde 429
- **THEN** Se conmuta a la siguiente cuenta habilitada en `in_rotation_pool`.
