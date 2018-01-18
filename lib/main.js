const axios = require('axios');
const {CompositeDisposable, Disposable} = require('via');
const Websocket = require('./websocket');
const Symbol = require('./symbol');
const Account = require('./account');

class Bittrex {
    constructor(){}

    async activate(){
        this.disposables = new CompositeDisposable();
        this.websocket = new Websocket();

        const symbols = await Symbol.all();

        for(const symbol of symbols){
            this.disposables.add(via.symbols.add(new Symbol(symbol, this.websocket)));
        }

        const accounts = await via.accounts.loadAccountsFromStorage('bittrex');

        for(const account of accounts){
            this.disposables.add(via.accounts.activate(new Account(account, this.websocket)));
        }
    }

    deactivate(){
        this.websocket.destroy();
        this.disposables.dispose();
        this.disposables = null;
    }

    async account(config){
        const account = await via.accounts.add({name: config.accountName, exchange: 'bittrex', key: Helpers.key(config)});
        this.disposables.add(via.accounts.activate(new Account(account, this.websocket)));
    }

    title(){
        return 'Bittrex';
    }


    matches(symbol, callback){
        return this.websocket.subscribe(symbol.metadata.id, events => {
            for(const e of events){
                if(e[0] === 't'){
                    callback({
                        date: new Date(parseInt(e[5]) * 1000),
                        size: parseFloat(e[4]),
                        price: parseFloat(e[3]),
                        side: (e[2] === 1) ? 'buy' : 'sell',
                        id: e[1]
                    });
                }
            }
        });
    }

    ticker(symbol, callback){
        return new Disposable(() => {});
        return this.matches(symbol, callback);
    }

    orderbook(symbol, callback){
        return this.websocket.subscribe(symbol.metadata.id, events => {
            const changes = [];

            for(const e of events){
                const [type] = e;

                if(type === 'i'){
                    const [asks, bids] = e[1].orderBook;
                    callback({type: 'snapshot', bids: Object.entries(bids), asks: Object.entries(asks)});
                }else if(type === 'o'){
                    const side = e[1] === 1 ? 'buy' : 'sell';
                    changes.push([side, e[2], e[3]]);
                }
            }

            if(changes.length){
                //Batch changes until the end, rather than updating the book one change at a time
                callback({type: 'update', changes});
            }
        });
    }

    history(symbol){
        const params = {
            command: 'returnTradeHistory',
            currencyPair: symbol.name.split('-').join('_')
        };

        return axios.get(base, {params})
        .then(response => response.data.map(datum => {
            return {
                date: new Date(datum.date),
                id: datum.globalTradeID,
                price: parseFloat(datum.rate),
                size: parseFloat(datum.amount),
                side: datum.type
            };
        }));
    }
}

module.exports = new Bittrex();
