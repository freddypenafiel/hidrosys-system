# 🌐 Guía para Subir a GitHub y Desplegar en la Web (Gratis)

El backend de este sistema está desarrollado en **Node.js** con base de datos **PostgreSQL**. Por lo tanto, no se puede alojar en GitHub Pages tradicional (ya que este último solo sirve sitios web estáticos y no ejecuta base de datos). 

Sin embargo, he configurado el proyecto con **Render Blueprints**, lo que te permite desplegarlo de manera **100% gratuita** y en un solo clic conectado a tu GitHub.

---

## 🛠️ PASO 1: Subir tu Código a GitHub

1. Instala **Git** en tu computadora (si no lo tienes).
2. Abre la terminal en la carpeta del proyecto (`hidrosys-system/`) y ejecuta:
```bash
# Inicializar repositorio
git init

# Agregar los archivos (el archivo .gitignore omitirá el .env con tus claves locales)
git add .

# Primer commit
git commit -m "feat: setup hidrosys system v3.0 with postgres"
```

3. Crea un repositorio **Público o Privado** en tu cuenta de GitHub (ej. llamado `hidrosys-system`).
4. Vincula tu repositorio local con GitHub y súbelo:
```bash
git branch -M main
git remote add origin https://github.com/TU_USUARIO/hidrosys-system.git
git push -u origin main
```

---

## 🚀 PASO 2: Desplegar en Render (Servidor + DB Gratis)

**Render** ofrece hosting gratuito para Node.js y bases de datos PostgreSQL. Sigue estos sencillos pasos:

1. Entra a **[render.com](https://render.com/)** y regístrate (puedes iniciar sesión con tu cuenta de GitHub).
2. En el panel principal de Render, haz clic en **New** (Nuevo) y selecciona **Blueprint**.
3. Conecta tu cuenta de GitHub y selecciona el repositorio de `hidrosys-system`.
4. Render leerá el archivo `render.yaml` que he configurado en tu proyecto y creará automáticamente:
   - 💻 Un **Servicio Web** en Node.js para Express y el Frontend.
   - 🗄️ Una **Base de datos PostgreSQL** vinculada.
5. Haz clic en **Apply** (Aplicar).

¡Listo! Render se encargará de configurar las variables de entorno, crear la base de datos de manera segura en la web, e instalar todo. En unos minutos te dará un enlace público como `https://hidrosys-system.onrender.com` totalmente operativo.

---

## 📂 Archivos de Configuración Creados para Producción:
- **`Procfile`**: Indica al servidor en la nube cómo iniciar la aplicación.
- **`render.yaml`**: Archivo de orquestación que configura automáticamente la base de datos PostgreSQL de producción en Render sin que tengas que hacer configuraciones manuales.
