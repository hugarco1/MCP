import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import z from "zod";


// Para iniciar el servidor
// npx -y tsx main.ts

// Para iniciar el servidor con un inspector
// npx -y @modelcontextprotocol/inspector npx -y tsx main.ts




// 1. Crear el servidor MCP
// Es la interfaz que permite a los clientes interactuar con el modelo de lenguaje
const server = new McpServer({
    name: 'Demo',
    version: '1.0.0'
});



// 2. Definir las herramientas
// Las herramientas le permiten al LLM(GPT, Gemini, Claude) realizar acciones a traves de tu servidor
server.tool(
    'fetch-weather',    // Título de la herramienta
    'Tool to fetch the weather of a city',  // Descripción de la herramienta
    {
        city: z.string().describe('City name')  // Parametros que puede recibir la herramienta
    },
    // Datos que devuelve la herramienta
    async ({ city }) => {
        const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${city}&count=10&language=en&format=json`);   // API para obtener la latitud y longitud de la ciudad
        const data = await response.json();

        // Si no se encuentra información de la ciudad, se devuelve un mensaje
        if (data.results.length === 0) {
            return {
                content: [
                    {
                        type: 'text',
                        text: `No se encontró información del clima para la ciudad ${city}`
                    }
                ]
            };
        }

        const { latitude, longitude } = data.results[0];
        const weatherResponse = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,is_day,precipitation,rain&forecast_days=1`); // API para obtener el clima actual en una longitud y latitud específicas
        const weatherData = await weatherResponse.json();

        return {
                content: [
                {
                    type: 'text',
                    text: JSON.stringify(weatherData, null, 2)
                }
            ]
        };
    }
);



// 3. Escuchar las conexiones
const transport = new StdioServerTransport();
await server.connect(transport);