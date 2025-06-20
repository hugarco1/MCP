import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import z from "zod";
import * as fs from "fs/promises";
import { fileURLToPath } from "url";
import path from "path";
import axios from 'axios';
import dotenv from 'dotenv';


// Para iniciar el servidor
// npx -y tsx main.ts

// Para iniciar el servidor con un inspector
// npx -y @modelcontextprotocol/inspector npx -y tsx main.ts


// Ruta al archivo JSON
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const filePath = path.resolve(__dirname, 'streamers.json');
dotenv.config({ path: path.resolve(__dirname, '.env') });

// Utilidad: Leer los streamers desde el archivo
async function readStreamers(): Promise<string[]> {
    try {
        const data = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        return [];
    }
}

// Utilidad: Guardar los streamers en el archivo
async function saveStreamers(streamers: string[]): Promise<void> {
    await fs.writeFile(filePath, JSON.stringify(streamers, null, 2), 'utf-8');
}

// Obtener OAuth Token de Twitch
async function getTwitchAccessToken(): Promise<string> {
    try {
        console.log('Client ID:', process.env.TWITCH_CLIENT_ID);
        console.log('Client Secret:', process.env.TWITCH_CLIENT_SECRET);

        const res = await axios.post('https://id.twitch.tv/oauth2/token', null, {
            params: {
                client_id: process.env.TWITCH_CLIENT_ID,
                client_secret: process.env.TWITCH_CLIENT_SECRET,
                grant_type: 'client_credentials'
            }
        });

        if (!res.data.access_token) {
            throw new Error('No access token received from Twitch');
        }

        console.log('Access token obtenido:', res.data.access_token);

        return res.data.access_token;
    } catch (error: any) {
        console.error('Error obtaining Twitch access token:', error.response?.data || error.message);
        throw new Error('Failed to obtain Twitch access token');
    }
}

// Verifica si un streamer está en directo
async function isStreamerLive(streamer: string, accessToken: string): Promise<boolean> {
    try {
        console.log('Usando Client-ID:', process.env.TWITCH_CLIENT_ID);
        console.log('Usando Access Token:', accessToken);

        const res = await axios.get('https://api.twitch.tv/helix/streams', {
            headers: {
                'Client-ID': process.env.TWITCH_CLIENT_ID!,
                'Authorization': `Bearer ${accessToken}`
            },
            params: {
                user_login: streamer.toLowerCase()
            }
        });

        console.log(`Respuesta para ${streamer}:`, res.data);

        return res.data.data.length > 0;
    } catch (error: any) {
        console.error(`❌ Error al verificar si ${streamer} está en directo:`, error.response?.data || error.message);
        throw new Error(`Error al verificar si ${streamer} está en directo`);
    }
}



// 1. Crear el servidor MCP
const server = new McpServer({
    name: 'Streamer Manager',
    version: '1.0.0'
});

// 2. Agregar streamer
server.tool(
    'add-streamer',
    'Adds a new streamer to the list',
    {
        name: z.string().describe('Name of the streamer to add')
    },
    async ({ name }) => {
        const streamers = await readStreamers();
        if (streamers.includes(name)) {
            return {
                content: [
                    {
                        type: 'text',
                        text: `Streamer "${name}" already exists.`
                    }
                ]
            };
        }
        streamers.push(name);
        await saveStreamers(streamers);
        return {
            content: [
                {
                    type: 'text',
                    text: `Streamer "${name}" added.`
                }
            ]
        };
    }
);

// 3. Modificar streamer
server.tool(
    'update-streamer',
    'Updates an existing streamer\'s name',
    {
        oldName: z.string().describe('Current name of the streamer'),
        newName: z.string().describe('New name for the streamer')
    },
    async ({ oldName, newName }) => {
        const streamers = await readStreamers();
        const index = streamers.indexOf(oldName);
        if (index === -1) return {
            content: [
                {
                    type: 'text',
                    text: `Streamer "${oldName}" not found.`
                }
            ]
        };
        streamers[index] = newName;
        await saveStreamers(streamers);
        return {
            content: [
                {
                    type: 'text',
                    text: `Streamer "${oldName}" updated to "${newName}".`
                }
            ]
        };
    }
);

// 4. Eliminar streamer
server.tool(
    'delete-streamer',
    'Deletes a streamer from the list',
    {
        name: z.string().describe('Name of the streamer to delete')
    },
    async ({ name }) => {
        const streamers = await readStreamers();
        const index = streamers.indexOf(name);
        if (index === -1) return {
            content: [
                {
                    type: 'text',
                    text: `Streamer "${name}" not found.`
                }
            ]
        };
        streamers.splice(index, 1);
        await saveStreamers(streamers);
        return {
            content: [
                {
                    type: 'text',
                    text: `Streamer "${name}" deleted.`
                }
            ]
        };
    }
);

// 5. Listar streamers
server.tool(
    'list-streamers',
    'Lists all current streamers',
    {},
    async () => {
        const streamers = await readStreamers();
        return {
            content: [
                {
                    type: 'text',
                    text: streamers.length > 0 ? streamers.join(', ') : 'No streamers available.'
                }
            ]
        };
    }
);

// 6. Verificar si un streamer está en directo
server.tool(
    'check-live-status',
    'Checks if a given streamer is currently live on Twitch and returns stream info if live.',
    {
        name: z.string().describe('Name of the streamer')
    },
    async ({ name }) => {
        const accessToken = await getTwitchAccessToken();

        const res = await axios.get('https://api.twitch.tv/helix/streams', {
            headers: {
                'Client-ID': process.env.TWITCH_CLIENT_ID!,
                'Authorization': `Bearer ${accessToken}`
            },
            params: {
                user_login: name.toLowerCase()
            }
        });

        const data = res.data.data;

        if (data.length > 0) {
            const stream = data[0];
            const url = `https://www.twitch.tv/${stream.user_login}`;
            const thumbnail = stream.thumbnail_url
                .replace('{width}', '640')
                .replace('{height}', '360');

            return {
                content: [
                    {
                        type: 'text',
                        text: `✅ "${stream.user_name}" está en directo en Twitch.\n\n🎮 ${stream.game_name}\n📺 ${stream.title}\n👥 ${stream.viewer_count} espectadores\n🔗 ${url}`,
                        
                    }
                ]
            };
        } else {
            return {
                content: [
                    {
                        type: 'text',
                        text: `❌ "${name}" está desconectado.`
                    }
                ]
            };
        }
    }
);


// 7. Listar todos los streamers en directo
server.tool(
    'list-live-streamers',
    'Returns the list of streamers from your list who are currently live on Twitch',
    {},
    async () => {
        const streamers = await readStreamers();
        if (streamers.length === 0) {
            return {
                content: [
                    {
                        type: 'text',
                        text: 'No streamers in the list.'
                    }
                ]
            };
        }

        const accessToken = await getTwitchAccessToken();
        const liveStreamers: string[] = [];

        for (const name of streamers) {
            const live = await isStreamerLive(name, accessToken);
            if (live) liveStreamers.push(name);
        }

        return {
            content: [
                {
                    type: 'text',
                    text: liveStreamers.length > 0
                        ? `📺 Streamers currently live: ${liveStreamers.join(', ')}`
                        : 'No one is live right now.'
                }
            ]
        };
    }
);

// . Escuchar las conexiones
const transport = new StdioServerTransport();
await server.connect(transport);