const axios = require('axios');

async function testWebhook() {
    const payload = {
        object: 'page',
        entry: [
            {
                id: '1073025599216413',
                time: Date.now(),
                changes: [
                    {
                        value: {
                            created_time: Math.floor(Date.now() / 1000),
                            leadgen_id: 'TEST_LEAD_' + Date.now(),
                            page_id: '1073025599216413',
                            form_id: '24973126822363867'
                        },
                        field: 'leadgen'
                    }
                ]
            }
        ]
    };

    try {
        console.log('Sending mock webhook POST...');
        const res = await axios.post('http://localhost:4000/webhook', payload);
        console.log('Webhook Response:', res.status);
        console.log('Now wait 2 seconds for background processing...');

        await new Promise(r => setTimeout(r, 2000));
        console.log('Done.');
    } catch (err) {
        console.error('Webhook test failed:', err.message);
    }
}

testWebhook();
