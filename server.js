var express = require("express");
var cors = require("cors");
var axios = require("axios");

var app = express();

app.use(express.json());
app.use(cors());
app.options("*", cors());

var masterToken = "", masterInfo, slaveInfo;
var pastPosition = [], position = [], pastPending = [], pending = [];
var masterAccId;
var connectedSlave = [];
var slaveToken = [];
var slaveAccId = [];
var openPrice, stopPrice;
var masterPositionId = [], slavePositionID = [], masterPendingID = [], slavePendingID = [];
var deleteLots;

app.post("/data", async (req, res) => {
    slaveToken = [];
    slaveAccId = [];
    try {
        const { master, slave } = req.body;
        masterInfo = master;
        slaveInfo = slave;
        connectedSlave.push(slave[0])
        const masterresp = await axios.post("https://demo.tradelocker.com/backend-api/auth/jwt/token", {
            email: master.email,
            password: master.password,
            server: master.server
        }).then((data) => {
            masterToken = data.data.accessToken;
        });
        Promise.all(
            connectedSlave.map(async (slaved) => {
                let token = await axios.post("https://demo.tradelocker.com/backend-api/auth/jwt/token", {
                    email: slaved.email,
                    password: slaved.password,
                    server: slaved.server
                });
                slaveToken.push(token.data.accessToken);
                let accId = await getMasterAccnum(token.data.accessToken, slaved.accnum);
                slaveAccId.push(accId);
            })
        ).then(() => {
            if (masterToken && connectedSlave.length === slaveToken.length) {
                console.log("good");
                res.status(200).send("success");
            }
        })

        masterAccId = await getMasterAccnum(masterToken, master.accnum);

        await axios.get(`https://demo.tradelocker.com/backend-api/trade/accounts/${master.accnum}/positions`, {
            headers: {
                'Authorization': `Bearer ${masterToken}`,
                'accNum': masterAccId,
                'Content-Type': 'application/json'
            }
        })
            .then((response) => {
                pastPosition = response.data["d"]["positions"]
                console.log(pastPosition)
            })
            .catch((error) => {
                // Handle any errors
                console.error(error);
            });

        await axios.get(`https://demo.tradelocker.com/backend-api/trade/accounts/${master.accnum}/orders`, {
            headers: {
                'Authorization': `Bearer ${masterToken}`,
                'accNum': masterAccId,
                'Content-Type': 'application/json'
            }
        })
            .then((pendingResponse) => {
                pastPending = pendingResponse.data["d"]["orders"]
                console.log(pastPending)
            })
            .catch((error) => {
                console.error(error);
            });

        const intervalId = setInterval(async () => {
            try {
                await Promise.all([
                    await axios.get(`https://demo.tradelocker.com/backend-api/trade/accounts/${master.accnum}/positions`, {
                        headers: {
                            'Authorization': `Bearer ${masterToken}`,
                            'accNum': masterAccId,
                            'Content-Type': 'application/json'
                        }
                    })
                        .then((response) => {
                            position = response.data["d"]["positions"];
                        }),

                    await axios.get(`https://demo.tradelocker.com/backend-api/trade/accounts/${master.accnum}/orders`, {
                        headers: {
                            'Authorization': `Bearer ${masterToken}`,
                            'accNum': masterAccId,
                            'Content-Type': 'application/json'
                        }
                    })
                        .then((pendingResponse) => {
                            pending = pendingResponse.data["d"]["orders"];
                        })
                ]);
            } catch (error) {
                console.error(error);
            }
        }, 3000);
    } catch (error) {
        console.log(error)
    }
});

app.get("/status", async (req, res) => {
    if (position.length > pastPosition.length && pastPosition.length != 0) {
        res.status(200).send("Postion Opened")
        console.log("Two Position Opened")
        position.map(async item => {
            const res = pastPosition.find(past => past[0] === item[0]);
            if (!res) {
                try {
                    const response = await axios.get(`https://demo.tradelocker.com/backend-api/trade/accounts/${masterInfo.accnum}/ordersHistory`, {
                        headers: {
                            'Authorization': `Bearer ${masterToken}`,
                            'accNum': masterAccId,
                            'Content-Type': 'application/json'
                        }
                    });
                    const orderHistory = response.data["d"]["ordersHistory"];
                    masterPositionId.push(position[0][0]);
                    console.log(masterPositionId);
                    for (const history of orderHistory) {
                        if (history[16] === item[0]) {
                            console.log(history[16])
                            await Promise.all(slaveToken.map(async (slaveTokens, index) => {
                                try {
                                    const slaveResponse = await axios.post(`https://demo.tradelocker.com/backend-api/trade/accounts/${connectedSlave[index].accnum}/orders`,
                                        {
                                            "expireDate": 0,
                                            "price": 0,
                                            "qty": history[3],
                                            "routeId": history[2],
                                            "side": history[4],
                                            "stopLoss": history[17],
                                            "stopLossType": "absolute",
                                            "stopPrice": 0,
                                            "takeProfit": history[19],
                                            "takeProfitType": "absolute",
                                            "trStopOffset": 0,
                                            "tradableInstrumentId": history[1],
                                            "type": "market",
                                            "validity": "IOC"
                                        },
                                        {
                                            headers: {
                                                'Authorization': `Bearer ${slaveTokens}`,
                                                'accNum': slaveAccId[index],
                                                'Content-Type': 'application/json'
                                            }
                                        })
                                    console.log("OPENED");
                                    console.log(slaveResponse.data);
                                    console.log(slaveResponse.data["d"]["orderId"]);
                                    try {
                                        const slavePositionRes = await axios.get(`https://demo.tradelocker.com/backend-api/trade/accounts/${connectedSlave[index].accnum}/ordersHistory`, {
                                            headers: {
                                                'Authorization': `Bearer ${slaveTokens}`,
                                                'accNum': slaveAccId[index],
                                                'Content-Type': 'application/json'
                                            }
                                        })
                                        const slaveOrderHistory = slavePositionRes.data["d"]["ordersHistory"];
                                        if (slavePositionID[index] === undefined) {
                                            slavePositionID[index] = [];
                                        }
                                        slavePositionID[index].push(slaveOrderHistory[0][16]);
                                        console.log("SLAVE==============>", slavePositionID[index]);
                                    }
                                    catch (error) {
                                        console.log(error)
                                    }
                                }
                                catch (error) {
                                    console.log(error)
                                }
                            }
                            ))
                        }
                    };
                } catch (error) {
                    console.error(error);
                }
            }
        });
        pastPosition = position;
    }

    else if (position.length == 1 && pastPosition.length == 0) {
        res.status(200).send("Postion Opened");
        console.log("One Position Opened");
        try {
            const response = await axios.get(`https://demo.tradelocker.com/backend-api/trade/accounts/${masterInfo.accnum}/ordersHistory`, {
                headers: {
                    'Authorization': `Bearer ${masterToken}`,
                    'accNum': masterAccId,
                    'Content-Type': 'application/json'
                }
            });
            const orderHistory = response.data["d"]["ordersHistory"];
            masterPositionId.push(position[0][0]);
            console.log(masterPositionId);
            for (const history of orderHistory) {
                if (history[16] === position[0][0]) {
                    slaveToken.map(async (slaveTokens, index) => {
                        try {
                            console.log("History==================>", history);
                            console.log("SlaveTokens==================>", slaveTokens);
                            const slaveResponse = await axios.post(`https://demo.tradelocker.com/backend-api/trade/accounts/${connectedSlave[index].accnum}/orders`,
                                {
                                    "expireDate": 0,
                                    "price": 0,
                                    "qty": history[3],
                                    "routeId": history[2],
                                    "side": history[4],
                                    "stopLoss": history[17],
                                    "stopLossType": "absolute",
                                    "stopPrice": 0,
                                    "takeProfit": history[19],
                                    "takeProfitType": "absolute",
                                    "trStopOffset": 0,
                                    "tradableInstrumentId": history[1],
                                    "type": "market",
                                    "validity": "IOC"
                                },
                                {
                                    headers: {
                                        'Authorization': `Bearer ${slaveTokens}`,
                                        'accNum': slaveAccId[index],
                                        'Content-Type': 'application/json'
                                    }
                                })
                            console.log(slaveResponse.data);
                            console.log(slaveResponse.data["d"]["orderId"]);
                            try {
                                const slavePositionRes = await axios.get(`https://demo.tradelocker.com/backend-api/trade/accounts/${connectedSlave[index].accnum}/ordersHistory`, {
                                    headers: {
                                        'Authorization': `Bearer ${slaveTokens}`,
                                        'accNum': slaveAccId[index],
                                        'Content-Type': 'application/json'
                                    }
                                })
                                const slaveOrderHistory = slavePositionRes.data["d"]["ordersHistory"];
                                if (slavePositionID[index] === undefined) {
                                    slavePositionID[index] = [];
                                }
                                slavePositionID[index].push(slaveOrderHistory[0][16]);
                                console.log(slaveOrderHistory[0][16]);
                            }
                            catch (error) {
                                console.log(error)
                            }
                        }
                        catch (error) {
                            console.log(error)
                        }
                    }
                    )
                }
            };
        } catch (error) {
            console.error(error);
        }
        pastPosition = position;
    }

    else if (pending.length == 1 && pastPending.length == 0) {
        res.status(200).send("Pending Order Opened");
        console.log("One Pending Order Opened");
        masterPendingID.push(pending[0][0]);
        if (pending[0][5] === "stop") {
            openPrice = "0.0";
            stopPrice = pending[0][10];
        }
        if (pending[0][5] === "limit") {
            openPrice = pending[0][9];
            stopPrice = "0.0";
        }
        console.log("OpenPrice==================>", openPrice, "stopPrice===========================>", stopPrice);
        slaveToken.map(async (slaveTokens, index) => {
            try {
                const pendingRes = await axios.post(`https://demo.tradelocker.com/backend-api/trade/accounts/${connectedSlave[index].accnum}/orders`,
                    {
                        "expireDate": 0,
                        "price": openPrice,
                        "qty": pending[0][3],
                        "routeId": pending[0][2],
                        "side": pending[0][4],
                        "stopLoss": pending[0][17],
                        "stopLossType": "absolute",
                        "stopPrice": stopPrice,
                        "takeProfit": pending[0][19],
                        "takeProfitType": "absolute",
                        "trStopOffset": 0,
                        "tradableInstrumentId": pending[0][1],
                        "type": pending[0][5],
                        "validity": "GTC"
                    },
                    {
                        headers: {
                            'Authorization': `Bearer ${slaveTokens}`,
                            'accNum': slaveAccId[index],
                            'Content-Type': 'application/json'
                        }
                    })
                console.log("Pending OPENED");
                console.log("PendingID================>", pendingRes.data["d"]["orderId"]);
                if (slavePendingID[index] === undefined) {
                    slavePendingID[index] = [];
                }
                slavePendingID[index].push(pendingRes.data["d"]["orderId"]);
                console.log(slavePendingID);
            }
            catch (error) {
                console.log(error)
            }
        })
        pastPending = pending;
    }

    else if (pending.length > pastPending.length && pastPending.length != 0) {
        res.status(200).send("Pending Order Opened");
        console.log("Two Pending Order Opened");
        await Promise.all(pending.map(async item => {
            const pendingRes = pastPending.find(past => past[0] === item[0]);
            if (!pendingRes) {
                console.log("item==================>", item);
                if (item[5] === "stop") {
                    openPrice = "0.0";
                    stopPrice = item[10];
                }
                if (item[5] === "limit") {
                    openPrice = item[9];
                    stopPrice = "0.0";
                }
                masterPendingID.push(item[0]);
                await Promise.all(slaveToken.map(async (slaveTokens, index) => {
                    try {
                        const slavePendingRes = await axios.post(`https://demo.tradelocker.com/backend-api/trade/accounts/${connectedSlave[index].accnum}/orders`,
                            {
                                "expireDate": 0,
                                "price": openPrice,
                                "qty": item[3],
                                "routeId": item[2],
                                "side": item[4],
                                "stopLoss": item[17],
                                "stopLossType": "absolute",
                                "stopPrice": stopPrice,
                                "takeProfit": item[19],
                                "takeProfitType": "absolute",
                                "trStopOffset": 0,
                                "tradableInstrumentId": item[1],
                                "type": item[5],
                                "validity": "GTC"
                            },
                            {
                                headers: {
                                    'Authorization': `Bearer ${slaveTokens}`,
                                    'accNum': slaveAccId[index],
                                    'Content-Type': 'application/json'
                                }
                            })
                        console.log("Pending OPENED");
                        if (slavePendingID[index] === undefined) {
                            slavePendingID[index] = [];
                        }
                        slavePendingID[index].push(slavePendingRes.data["d"]["orderId"]);
                        console.log(slavePendingID);
                    }
                    catch (error) {
                        console.log(error)
                    }
                }))
            }
        }))
        pastPending = pending;
    }

    else if (position.length < pastPosition.length) {
        console.log("Postion Closed");
        res.status(200).send("Market Order Closed");
        console.log("masterPositionId=================>", masterPositionId);
        pastPosition.map(async pastItem => {
            const deleteRes = position.find(positions => positions[0] === pastItem[0]);
            if (!deleteRes) {
                console.log("DeletedPosition====================>", pastItem[0]);
                let deletedIndex = masterPositionId.findIndex(masterPositionIds => masterPositionIds === pastItem[0]);
                console.log(deletedIndex);
                try {
                    const response = await axios.get(`https://demo.tradelocker.com/backend-api/trade/accounts/${masterInfo.accnum}/ordersHistory`, {
                        headers: {
                            'Authorization': `Bearer ${masterToken}`,
                            'accNum': masterAccId,
                            'Content-Type': 'application/json'
                        }
                    })

                    const masterOrderHistory = response.data["d"]["ordersHistory"];

                    await masterOrderHistory.forEach(masterOrderHistories => {
                        if (masterOrderHistories[16] === pastItem[0]) {
                            deletedLots = masterOrderHistories[3];
                            console.log(deletedLots);
                        }
                    });
                    slaveToken.forEach(async (slaveTokens, index) => {
                        console.log("deletedSlavePostionID===========>", slavePositionID[index][deletedIndex]);
                        try {
                            console.log("ACCNUM==================>", slaveAccId[index]);
                            await axios.delete(`https://demo.tradelocker.com/backend-api/trade/positions/${slavePositionID[index][deletedIndex]}`,
                                {
                                    headers: {
                                        'Authorization': `Bearer ${slaveTokens}`,
                                        'accNum': slaveAccId[index],
                                        'Content-Type': 'application/json'
                                    }
                                },
                                {
                                    "qty": deletedLots
                                })
                        }
                        catch (error) {
                            console.log(error);
                        }
                    });
                }
                catch (error) {
                    console.log(error);
                }
            }
        })
        pastPosition = position;
    }

    else if (pending.length < pastPending.length) {
        res.status(200).send("Pending Order Closed");
        pastPending.map(async pastPendings => {
            const deletePes = pending.find(pendings => pendings[0] === pastPendings[0]);
            if (!deletePes) {
                let deltedPenddingIndex = masterPendingID.findIndex(masterPendingsID => masterPendingsID === pastPendings[0]);
                slaveToken.forEach(async (slaveTokens, index) => {
                    try {
                        await axios.delete(`https://demo.tradelocker.com/backend-api/trade/orders/${slavePendingID[index][deltedPenddingIndex]}`,
                            {
                                headers: {
                                    'Authorization': `Bearer ${slaveTokens}`,
                                    'accNum': slaveAccId[index],
                                    'Content-Type': 'application/json'
                                }
                            }
                        )
                    }
                    catch (error) {
                        console.log(error);
                    }
                })
            }
        })
        pastPending = pending;
        console.log("Pending Close");
    }

    else {
        res.status(200).send("Position")
    };
})

app.post('/deleteSlave', async (req, res) => {
    connectedSlave = connectedSlave.filter(slave => slave.email !== req.body.email);
    const index = connectedSlave.findIndex(slave => slave.email !== req.body.email);
    slaveToken = slaveToken.filter((token, tokenIndex) => tokenIndex !== index);
    console.log(connectedSlave, slaveToken);
    res.send('deleted!');
});

app.listen(8080, () => {
    console.log("Server is running at http://localhost:8080/");
});

async function getMasterAccnum(token, accid) {
    const config = {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    }
    var master_num;
    var res = await axios.get('https://demo.tradelocker.com/backend-api/auth/jwt/all-accounts', config);
    var ids = res.data.accounts;
    ids.forEach(id => {
        if (id.id === accid) master_num = id.accNum
    })
    return master_num
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
