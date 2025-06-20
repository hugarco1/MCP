import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

async function getToken() {
    try {
        const res = await axios.post('https://id.twitch.tv/oauth2/token', null, {
            params: {
                client_id: process.env.TWITCH_CLIENT_ID,
                client_secret: process.env.TWITCH_CLIENT_SECRET,
                grant_type: 'client_credentials'
            }
        });

        console.log('Access Token:', res.data.access_token);
    } catch (error: any) {
        console.error('Error:', error.response?.data || error.message);
    }
}

getToken();
