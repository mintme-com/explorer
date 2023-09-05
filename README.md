# Webchain Explorer

<img src="public/img/explorer-logo.png" alt="Webchain Explorer logo" height="200" />

## Installation

Clone the repo

`git clone https://github.com/webchain-network/explorer`

Download [Nodejs and npm](https://docs.npmjs.com/getting-started/installing-node "Nodejs install") if you don't have them

Install dependencies:

`npm install`

Install mongodb:

Debian based distro Linux: `sudo apt-get install -y mongodb-org`

## Populate the DB

This will fetch and parse the entire blockchain.

Review your configuration file: `cat config.json`

The `config.json` file must looks as follow

Settings:
```{
    "nodeAddr":     "localhost",
    "gethPort":     39573,
    "wsPort":       8546,
    "startBlock":   0,
    "endBlock":     "latest",
    "quiet":        false,
    "syncAll":      true,
    "patch":        true,
    "patchBlocks":  100,
    "bulkSize":     100,
    "settings": {
        "symbol": "WEB",
        "name": "Webchain",
        "description": "Webchain Block Explorer allows you to search through the blockchain. Enter a wallet address, transaction hash, block hash or block number.",
        "keywords": "Block Height, Block Time, Network Hashrate, Difficulty, Transaction hash, Block Explorer, block number, block hash, wallet address",
        "author": "Webchain project",
        "contact": "mailto:support@webchain.network",
        "about": "This is an open source Webchain Explorer.",
        "facebook": "http://facebook.com/thewebchain",
        "twitter": "https://twitter.com/TheWebchain",
        "github": "https://github.com/webchain-network",
        "linkedin": "https://www.linkedin.com/company/webchain-blockchain",
        "reddit": "https://www.reddit.com/r/Webchain",
        "telegram_group": "https://t.me/joinchat/Hzio4lCr-95bHcbB1-RX9Q",
        "telegram_channel": "https://www.t.me/webchainnetwork",
        "discord": "https://discord.gg/uuZXhCn",
        "gitter": "https://gitter.im/webchain-network/public",
        "logo": "img/explorer-logo.png",
        "customCss": "green-haze.min.css",
        "copyright": "2018-2019 &copy; Webchain explorer.",
        "useRichList": true,
        "useFiat": false,
        "poweredbyCustom": "Powered by <a href=\"https://github.com/webchain-network/explorer\" target=\"_blank\">Webchain explorer</a>",
        "miners": {
         },
        "analytics-code": "UA-1111111-00",
        "path": "/explorer/"
    }
}

```

| Name  | Explanation |
|-------------|-----|
| `nodeAddr` | Your node API RPC address. |
| `wsPort` | Your node API WS (Websocket) port. (RPC HTTP port is deprecated on Web3 1.0 see https://web3js.readthedocs.io/en/1.0/web3.html#value) |
| `startBlock` | This is the start block of the blockchain, should always be 0 if you want to sync the whole Webchain. |
| `endBlock` | This is usually the 'latest'/'newest' block in the blockchain, this value gets updated automatically, and will be used to patch missing blocks if the whole app goes down. |
| `quiet` | Suppress some messages. (admittedly still not quiet) |
| `syncAll` | If this is set to true at the start of the app, the sync will start syncing all blocks from lastSync, and if lastSync is 0 it will start from whatever the endBlock or latest block in the blockchain is. |
| `patch` | If set to true and below value is set, sync will iterated through the # of blocks specified. |
| `patchBlocks` | If `patch` is set to true, the amount of block specified will be check from the latest one. |


### Configure MongoDB

In view of system security, most of mongoDB Admin has setup security options, So, You need to setup mongodb auth informations.
Switch to the built-in admin database:

```
$ mongo
$ > use admin
```

1. Create an administrative user  (if you have already admin or root of mongodb account, then skip it)

```
# make admin auth and role setup
$ > db.createUser( { user: "admin", pwd: "<Enter a secure password>", roles: ["root"] } )
```

And, You can make Explorer's "explorerDB" database with db user accounts "explorer" and password "some_pass_code".

```
$ > use explorerDB
$ > db.createUser( { user: "explorer", pwd: "<Enter a secure password>", roles: ["dbOwner"] } )
$ > quit()
```

Above dbuser explorer will full access explorerDB and cluster setting will be well used on monitoring the multiple sharding and replication of multiple mongodb instances.
Enable database authorization in the MongoDB configuration file /etc/mongodb.conf by appending the following lines:

```
auth=true
```

Restart MongoDB and verify the administrative user created earlier can connect:

```
$ sudo service mongodb restart
$ mongo -u admin -p your_password --authenticationDatabase=admin
```

If everything is configured correctly the Mongo Shell will connect and

```
$ > show dbs
```
will show db informations.


### Run

The below will start both the web-gui and sync.js (which populates MongoDB with blocks/transactions).

`npm start`

You can leave sync.js running without app.js and it will sync and grab blocks based on config.json parameters

`npm run sync`

Enabling stats requires running a separate process:

`npm run stats`

Enabling richlist requires running a separate process:

`npm run rich`

You can configure intervals (how often a new data point is pulled) and range (how many blocks to go back) with the following:

`RESCAN=100:7700000 node tools/stats.js` (New data point every 100 blocks. Go back 7,700,000 blocks).

## Configuring system service for webchain-explorer

Create a service file at `/etc/systemd/system` with suffix `.service` e.g.: `sudo touch /etc/systemd/system/webchain-explorer.service` and put the following content on it:

```[Unit]
Description=Webchain explorer
After=network.target

[Service]
User=<user_owner_of_explorer_folder>
Group=<your_nginx_group>

Environment=MONGO_URI=mongodb://blockDB_user:<MONGO_PASSWORD>@127.0.0.1/blockDB
Environment=PATH=<PATH OF NODE BINARY>:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

Type=simple
Restart=on-failure
WorkingDirectory=<PATH OF EXPLORER>
ExecStart=<PATH OF NODE>/bin/npm run start

[Install]
WantedBy=multi-user.target
```
Note you need to change `User` `Group`, `ExecStart`, `WorkingDirectory` and `Environment` (path and mongo_uri) and set the correspond values of your system. Note: User and Group must match with owner and group of your explorer folder.

save changes and run `systemctl daemon-reload` `systemctl start webchain-explorer`

## Nginx node proxy configuration

Create a new nginx conf file in order to proxy pass the node explorer app in nginx (by default `app.js` runs on port 3000). Add the following lines to the new nginx conf (Note you must to change alias value):
``` 
listen <your ip>;
server_name  <your.webchain.explorer.hosts.example>   
.
.
.
location /explorer {
        location /explorer {
            expires 10m;
            alias /path/of/webchain-explorer/public;
            try_files $uri @nodeproxy;
        }

    }

    location @nodeproxy {
        expires 10m;
        rewrite /explorer/(.*) /$1  break;
        proxy_pass http://127.0.0.1:3000;
        proxy_redirect     off;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
```
After that run `systemctl reload nginx`

Test it on your browser!

## Docker installation

Set `nodeAddr` in `config.json` to `host.docker.internal`

Run `docker-compose up`
