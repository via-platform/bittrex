const crypto = require('crypto');
const axios = require('axios');
const url = 'https://bittrex.com/api/v2.0';

const Helpers = {
    timeframes: {6e4: 'oneMin', 3e5: 'fiveMin', 18e5: 'thirtyMin', 36e5: 'hour', 864e5: 'day'},
    key: config => {
        if(!config.apiKey || !config.apiSecret){
            throw new Error('Missing a required parameter. API key and secret are both required fields.');
        }

        return JSON.stringify([config.apiKey, config.apiSecret]);
    },
    sign: ({key, secret}, data = {}) => {
        // debugger;
        data.timestamp = Date.now();
        const query = Object.entries(data).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
        data.signature = crypto.createHmac('sha256', secret).update(query).digest('hex');

        return data;
    },
    request: (keys, method, path, data) => {
        const signed = Helpers.sign(keys, data);

        return axios({
            method,
            url: url + path,
            params: signed,
            headers: {
                'X-MBX-APIKEY': keys.key
            }
        });
    },
    status: status => {
        if(['NEW', 'PARTIALLY_FILLED'].includes(status)){
            return 'working';
        }

        return status.toLowerCase();
    },
    data: d => ({date: new Date(d.T), open: d.O, high: d.H, low: d.L, close: d.C, volume: d.BV}),
    position: d => ({balance: parseFloat(d.balance), hold: parseFloat(d.hold)}),
    matches: d => ({date: new Date(d.E), price: parseFloat(d.p), size: parseFloat(d.q), side: d.m ? 'sell' : 'buy', id: d.a}),
    history: d => ({date: new Date(d.T), price: parseFloat(d.p), size: parseFloat(d.q), side: d.m ? 'sell' : 'buy', id: d.a}),
    symbol: id => via.symbols.findByExchange('binance').filter(s => s.id === id)
};

module.exports = Helpers;
