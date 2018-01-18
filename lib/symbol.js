const {Emitter, CompositeDisposable, Disposable} = require('via');
// const _ = require('underscore-plus');
const axios = require('axios');

const Helpers = require('./helpers');
const url = 'https://bittrex.com/api/v2.0';

module.exports = class Symbol {
    static all(){
        return axios.get(`${url}/pub/markets/GetMarketSummaries`).then(response => response.data.result);
    }

    constructor(params, websocket){
        const market = params.Market, summary = params.Summary;

        this.disposables = new CompositeDisposable();
        this.emitter = new Emitter();
        this.websocket = websocket;

        this.base = market.MarketCurrency;
        this.quote = market.BaseCurrency;
        this.id = market.MarketName; //Please note, this is backwards on Bittrex (they are incorrect)
        this.name = `${this.base}-${this.quote}`;
        this.exchange = 'bittrex';
        this.categories = ['Bittrex'];
        this.description = 'Bittrex';
        this.available = market.IsActive;
        this.marginEnabled = false;

        this.identifier = 'BITTREX:' + this.name;

        this.baseMinSize = market.MinTradeSize;
        this.baseMaxSize = 0;
        this.baseIncrement = 0;
        this.basePrecision = 8;

        this.quoteMinPrice = 0;
        this.quoteMaxPrice = 0;
        this.quoteIncrement = 0;
        this.quotePrecision = 8;

        this.granularity = 60000; //Smallest candlestick size available
        this.precision = 8; //Number of decimal places to support
        this.minNotional = 0;

        this.aggregation = 2; //Number of decimal places to round to / group by for display purposes

        let last = summary.Last;

        while(!isNaN(last) && last > 0 && last < 1){
            this.aggregation++;
            last *= 10;
        }
    }

    data({granularity, start, end}){
        if(!Helpers.timeframes[granularity]){
            //TODO, eventually implement a method to allow for a wider variety of time frames
            throw new Error(`Invalid timeframe requested.`);
        }

        //TODO Figure out what the hell the _ is for and use the start and end timestamps appropriately
        const params = {marketName: this.id, tickInterval: Helpers.timeframes[granularity]};
        return axios.get(`${url}/pub/market/GetTicks`, {params}).then(response => response.data.result.map(Helpers.data));
    }

    history(){
        return axios.get(`${url}/aggTrades`, {params: {symbol: this.id}}).then(response => response.data.map(Helpers.history));
    }

    orderbook(callback){
        //Get the orderbook via an HTTP request and fire a snapshot event if we are still subscribed
        //TODO Check to make sure we're still subscribed before firing the callback to nowhere
        axios.get(`${url}/depth`, {params: {symbol: this.id}})
        .then(result => callback({type: 'snapshot', bids: result.data.bids, asks: result.data.asks}))
        .catch(() => {}); //TODO Somehow handle this error

        return this.websocket.subscribe(`${this.id.toLowerCase()}@depth`, message => {
            const changes = [];

            for(const bid of message.b) changes.push(['buy', bid[0], bid[1]]);
            for(const ask of message.a) changes.push(['sell', ask[0], ask[1]]);

            callback({type: 'update', changes});
        });
    }

    matches(callback){
        //TODO Verify ticker integrity by checking against the sequence number
        return this.websocket.subscribe(`${this.id.toLowerCase()}@aggTrade`, message => callback(Helpers.matches(message)));
    }

    ticker(callback){
        return new Disposable(() => {});
        return this.matches(callback);
    }
}
