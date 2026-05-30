# EcoVigía 🌱📱

¡Hola! Este es el código fuente de **EcoVigía**, una aplicación móvil enfocada en el monitoreo, la educación y la conservación del Humedal de Techo. 

Este proyecto hace parte de mi trabajo de grado en la **Uniagustiniana** y busca acercar a la comunidad al cuidado del medio ambiente a través de la tecnología.

## ¿Qué vas a encontrar aquí? 🔍

La app tiene varios módulos clave:
- **Dashboard:** Un resumen rápido de las alertas y el estado general del humedal.
- **Monitoreo:** Mapas interactivos (usando `leaflet`) para visualizar puntos de interés y métricas ambientales en tiempo real.
- **Educación y Cultura:** Secciones dedicadas a enseñar sobre la biodiversidad local (flora y fauna) y promover buenas prácticas ambientales.
- **Participación Ciudadana:** Un espacio para que los usuarios registrados puedan reportar novedades e involucrarse activamente.
- **Asistente Virtual:** Un chatbot impulsado por IA para responder preguntas frecuentes sobre el ecosistema.

## Stack Tecnológico 🛠️

Elegí una arquitectura moderna y ágil para que la app fluya sin problemas tanto en web como en dispositivos móviles:
- **Frontend:** React 19 con TypeScript y Vite. Para los estilos usé TailwindCSS.
- **Mobile:** Capacitor, que me permitió empaquetar la app web como un APK nativo para Android.
- **Backend y Auth:** Supabase nos facilita la vida con la base de datos en tiempo real y la gestión de usuarios.
- **Mapas:** Leaflet.

## ¿Cómo levantar el proyecto en tu máquina? 🚀

Para realizar ajustes o cambios a tu medida, los pasos son súper sencillos:

1. Instala las dependencias del proyecto:
   ```bash
   npm install
   ```
2. Configura tus variables de entorno. Necesitarás un archivo `.env.local` con tus credenciales de Supabase y tu `GEMINI_API_KEY` para el chatbot.
3. Inicia el servidor de desarrollo local:
   ```bash
   npm run dev
   ```

Si lo que quieres es probar la versión móvil para Android:
```bash
npm run build
npx cap sync android
npx cap open android
```

---
*Desarrollado con mucha dedicación para aportar nuestro granito de arena al cuidado de nuestros humedales.*
*Desarrolladores Carlos Eduardo Cruz - Juan Esteban Leon.* 🦆🍃
