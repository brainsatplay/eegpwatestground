
/* TODO
Security - e.g. regex control so scripts can't be pumped in
Data capping. This needs to be implemented Clientside as well so the socket doesnt get used at all for overly large data. Test limits, consider server costs
Maybe buffer new data instead (up to a few hundred samples maybe) and instead of a newData call use a counter to know how much data to send to each subscription. That way no data is lost if updates
    are faster than subscriptions. 
    //By Joshua Brewster, Garrett Flynn (GPL)
*/

const OSCManager = require('./OSCManager.js');
// const RobotManager = require('./RobotManager.js');

class DataServer {
    /**
     * @constructor
     * @alias DataServer
     * @description Class for managing incoming requests to the WebBCI server.
     */

    constructor() {
		this.userData=new Map();
		// this.serverInstances=appnames;
		this.userSubscriptions=[]; //User to user data subscriptions
		this.appSubscriptions=[]; //Synchronous apps (all players receive each other's data)
        this.hostSubscriptions=[]; //Asynchronous apps (host receives all users data, users receive host data only)
        this.subUpdateInterval = 0; //ms
        this.serverTimeout = 60*60*1000; //min*s*ms
        this.mongoClient = undefined;

        this.subscriptionLoop();
	}

	addUser(info, socket=null,availableProps=[]) {

        socket = this.setWSBehavior(info, socket)
        
        if (!this.userData.has(info.id)){
            this.userData.set(info.id, {
                id: info.id,
                username:info.username,
                sessions:[],
                // robot: new RobotManager(),
                sockets: {
                    ws: socket,
                    osc: new OSCManager(socket),
                },
                props: {},
                updatedPropnames: [],
                lastUpdate:Date.now(),
                lastTransmit:0,
                latency:0,
                origins: [info.origin],
            })
            availableProps.forEach((prop,i) => {
                this.userData.get(info.id).props[prop] = '';
            });
        }
        else { 
            let u = this.userData.get(info.id);
            u.lastUpdate = Date.now();
            if(socket.url !== u.sockets.ws.url) { //handle same user on new port
                u.sockets.ws.close();
                u.sockets.ws = socket;
            }
            u.origins.push(info.origin)
            availableProps.forEach((prop,i) => {
                u.props[prop] = '';
            });
        }
    }

    getUserData(id='') {
        return this.userData.get(id);
    }
    
    setWSBehavior(info, socket){

        if (socket != null){

            socket.on('message', (s) => {
                this.processMessage(s);
            });

            socket.on('close', (s) => {
                this.removeUser(info.id)
            });
        }
        return socket
    }

    removeUser(id) {

        let user = this.userData.get(id)
        // Close OSC Sockets
        user.sockets.osc.remove()

        // Remove User Subscriptions
        user.sessions.forEach(sessionId => {
            this.removeUserFromSession(sessionId,id)
        })

        this.userData.delete(id)
    }

    removeUserToUserStream(listener,source,propnames=null) { //delete stream or just particular props
        let found = false;
        let sub = this.userSubscriptions.find((o,i)=>{
            if(o.listener === listener && o.source === source) {
                if(!Array.isArray(propnames)) this.userSubscriptions.splice(i,1);
                else {
                    propnames.forEach((prop) => {
                        let pidx = o.propnames.indexOf(prop);
                        if(pidx > -1) {
                            o.propnames.splice(pidx);
                        }
                    })
                }
                found = true;
                return true;
            }
        });
        return found;
    }

    removeUserFromSession(sessionId='',id='') {
        let found = false;
        let app = this.appSubscriptions.find((o,i) => {
            if(o.id === sessionId) {
                delete o.users[id]
                delete o.spectators[id]
                found = true;
                return o;
            }
        });

        if(!found) {
            app = this.hostSubscriptions.find((o,i) => {
                if(o.id === sessionId) {
                    delete o.users[id]
                    delete o.spectators[id]
                    found = true;
                    return o;
                }
            });
        }

        if (found) {
            // Send Info About User Leaving
            let sessionData =this.getSessionData(sessionId)
            sessionData.userLeft = id
            let allIds = Object.assign({}, app.users)
            allIds = Object.assign(allIds, app.spectators)
            Object.keys(allIds).forEach(u => {
                let filteredObj = this.removeUserData(u, sessionData)
                this.userData.get(u).sockets.ws.send(JSON.stringify(filteredObj));
            })

            // Remove Session from User Info
            let oldSessions = this.userData.get(id).sessions
            let toKeep = []
            oldSessions.forEach((session,i) => {
                if (session !== sessionId){
                    toKeep.push(sessionId)
                }
            })
            this.userData.get(id).sessions = toKeep
        }

        return found;
    }

    removeSessionStream(appname='') {
        let found = false;
        let sub = this.appSubscriptions.find((o,i) => {
            if(o.appname === appname) {
                this.appSubscriptions.splice(i,1);
                found = true;
                return true;
            }
        });
        return found;
    }

    processMessage(msg='') {

        let parsed = JSON.parse(msg);
        if(typeof parsed === 'object' && !Array.isArray(parsed)) { //if we got an object process it as most likely user data
            let hasData = false;
            for(const prop in parsed) {
                if(prop === 'userData') {
                    hasData = true;
                    break;
                }
            }
            if(hasData) {
                this.updateUserData(parsed);
            }
            else if(parsed.id && parsed.cmd) {
                this.processUserCommand(parsed.id,parsed.cmd);
            }
           
        }
        else if (Array.isArray(parsed)) { //handle commands sent as arrays [username,cmd,arg1,arg2]
            this.processUserCommand(parsed[0],parsed.slice(1));  
        }
        else if (typeof parsed === 'string') { //handle string commands with spaces, 'username command arg1 arg2'
            let cmd = parsed.split(' ');
            this.processUserCommand(cmd[0],cmd.slice(1));
        }
    }

    
    processUserCommand(id='',commands=[]) { //Commands should be an array of arguments 
        let u = this.userData.get(id);
        if (u != null) u.lastUpdate = Date.now();
        //u.socket.send(JSON.stringify({msg:commands}));

        if(commands[0] === 'getUsers') {
            let userData = [];
            this.userData.forEach((o) => {
                let filtered = {}
                let propsToGet = ['sessions','username','origins', 'id']

                propsToGet.forEach(p => {
                    filtered[p] = o[p]
                })

                if(commands[1] != null) {
                    if(o.id === commands[1]) {
                        userData.push(filtered);
                    }
                }
                else if(u.sessions.length > 0 && u.sessions.includes(o.appname)) {
                    userData.push(filtered);
                }
                else {
                    userData.push(filtered);
                }
            });
            if(userData.length > 0) u.sockets.ws.send(JSON.stringify({msg:'getUsersResult', userData:userData}))
            else u.sockets.ws.send(JSON.stringify({msg:'usersNotFound', userData:[]}))
        }
        else if(commands[0] === 'getUserData') {
            if(commands[2] === undefined) {
                let u2 = this.getUserData(commands[1]);
                if(u2 === undefined) { u.sockets.ws.send(JSON.stringify({msg:'userNotFound',username:commands[1]})); }
                else {u.sockets.ws.send(JSON.stringify({msg:'getUserDataResult',username: commands[1], userData:u2})); }
            }
            else if (Array.isArray(commands[2])) {
                let d = this.getUserData(commands[1]).props;
                let result = {msg:'getUserDataResult',username:commands[1],props:{}};
                if(d === undefined) { u.sockets.ws.send(JSON.stringify({msg:'userNotFound', username:commands[1]})); }
                else {
                    commands[2].forEach((prop)=> {result.props[prop] = d.props[prop]});
                    u.sockets.ws.send(JSON.stringify(result)); 
                }
            }
        }
        else if (commands[0] === 'setUserStreamSettings') {
            let sub = this.setUserStreamSettings(commands[0],commands[1]);
            if(sub === undefined) {
                u.sockets.ws.send(JSON.stringify({msg:'userNotFound',id:commands[1]}));
            } else {
                u.sockets.ws.send(JSON.stringify({msg:'userSubscriptionInfo',id:commands[1],sessionInfo:sub}));
            }
        }
        else if (commands[0] === 'createSession') {
            let i = this.createAppSubscription(commands[1],commands[2],commands[3]);
            u.sockets.ws.send(JSON.stringify({msg:'sessionCreated',appname:commands[1],sessionInfo:this.appSubscriptions[i]}));
        }
        else if (commands[0] === 'getSessions') { //List sessions with the app name
            let subs = this.getAppSubscriptions(commands[1]);
            if(subs === undefined) {
                u.sockets.ws.send(JSON.stringify({msg:'appNotFound',appname:commands[1]}));
            }
            else {
                u.sockets.ws.send(JSON.stringify({msg:'getSessionsResult',appname:commands[1],sessions:subs}));
            }
        }
        else if (commands[0] === 'getSessionInfo') { //List the app info for the particular ID
            let sub = this.getAppSubscription(commands[1]);
            if(sub === undefined) {
                u.sockets.ws.send(JSON.stringify({msg:'sessionNotFound',id:commands[1]}));
            }
            else {
                u.sockets.ws.send(JSON.stringify({msg:'getSessionInfoResult',id:commands[1],sessionInfo:sub}));
            }
        }
        else if (commands[0] === 'getSessionData') {
            let sessionData = this.getSessionData(commands[1]);
            if(sessionData === undefined) {
                u.sockets.ws.send(JSON.stringify({msg:'sessionNotFound',id:commands[1]}));
            }
            else {
                u.sockets.ws.send(JSON.stringify({msg:'getSessionDataResult',id:commands[1],sessionData:sessionData}));
            }
        }
        else if (commands[0] === 'setSessionSettings') {
            let sub = this.setAppSettings(commands[1],commands[2]);
            if(sub === undefined) {
                u.sockets.ws.send(JSON.stringify({msg:'sessionNotFound',id:commands[1]}));
            } else {
                u.sockets.ws.send(JSON.stringify({msg:'getSessionInfoResult',id:commands[1],sessionInfo:sub}));
            }
        }
        else if (commands[0] === 'createHostedSession') {
            let i = this.createHostSubscription(commands[1],commands[2],commands[3],commands[4],commands[5]);
            u.sockets.ws.send(JSON.stringify({msg:'sessionCreated',appname:commands[1],sessionInfo:this.hostSubscriptions[i]}));
        }
        else if (commands[0] === 'getHostSessions') { //List sessions with the app name
            let subs = this.getHostSubscriptions(commands[1]);
            if(subs === undefined) {
                u.sockets.ws.send(JSON.stringify({msg:'appNotFound',appname:commands[1]}));
            }
            else {
                u.sockets.ws.send(JSON.stringify({msg:'getSessionsResult',appname:commands[1],sessions:subs}));
            }
        }
        else if (commands[0] === 'getHostSessionInfo') { //List the app info for the particular session ID
            let sub = this.getHostSubscription(commands[1]);
            if(sub === undefined) {
                u.sockets.ws.send(JSON.stringify({msg:'sessionNotFound',id:commands[1]}));
            }
            else {
                u.sockets.ws.send(JSON.stringify({msg:'getSessionInfoResult',id:commands[1],sessionInfo:sub}));
            }
        }
        else if (commands[0] === 'getHostSessionData') {
            let sessionData = this.getHostSessionData(commands[1]);
            if(sessionData === undefined) {
                u.sockets.ws.send(JSON.stringify({msg:'sessionNotFound',id:commands[1]}));
            }
            else {
                u.sockets.ws.send(JSON.stringify({msg:'getSessionDataResult',id:commands[1],sessionData:sessionData}));
            }
        }
        else if (commands[0] === 'setHostSessionSettings') {
            let sub = this.setHostAppSettings(commands[0],commands[1]);
            if(sub === undefined) {
                u.sockets.ws.send(JSON.stringify({msg:'sessionNotFound',id:commands[1]}));
            } else {
                u.sockets.ws.send(JSON.stringify({msg:'getSessionInfoResult',id:commands[1],sessionInfo:sub}));
            }
        }
        else if(commands[0] === 'subscribeToUser') {  //User to user stream
            if(commands[3]) this.streamBetweenUsers(id,commands[1],commands[2]);
            else this.streamBetweenUsers(id,commands[1]);
        }
        else if(commands[0] === 'subscribeToSession') { //Join session
            this.subscribeUserToSession(id,commands[1],commands[2]);
        }
        else if(commands[0] === 'subscribeToHostSession') { //Join session
            this.subscribeUserToHostSession(id,commands[1],commands[2],commands[3]);
        }
        else if(commands[0] === 'unsubscribeFromUser') {
            let found = undefined;
            if(commands[2]) found = this.removeUserToUserStream(id,commands[1],commands[2]);
            else found = this.removeUserToUserStream(id,commands[1]);
            if(found) {  u.sockets.ws.send(JSON.stringify({msg:'unsubscribed',id:commands[1],props:commands[2]}));}
            else { u.sockets.ws.send(JSON.stringify({msg:'userNotFound'}));}
        } 
        else if (commands[0] === 'logout') {
            u.sockets.ws.send(JSON.stringify({msg:'logged out'}));
            u.sockets.ws.close();
        }
        else if(commands[0] === 'leaveSession') {
            let found = undefined;
            if(commands[2]) found = this.removeUserFromSession(commands[1],commands[2]);
            else found = this.removeUserFromSession(commands[1],u.id);
            if(found) {  u.sockets.ws.send(JSON.stringify({msg:'leftSession',id:commands[1]}));}
            else { u.sockets.ws.send(JSON.stringify({msg:'sessionNotFound',id:commands[1]}));}
        }
        else if(commands[0] === 'deleteSession') {
            let found = this.removeSessionStream(commands[1]);
            if(found) { u.sockets.ws.send(JSON.stringify({msg:'sessionDeleted',id:commands[1]}));}
            else { u.sockets.ws.send(JSON.stringify({msg:'sessionNotFound'}));}
        }

        // Test
        else if( commands[0] === 'ping' || commands === 'ping') {
            u.sockets.ws.send(JSON.stringify({msg:'pong'}))
        }

        // OSC (WebSocket calls handled internally)
        else if( commands[0] === 'startOSC') {
            u.sockets.osc.add(commands[1],commands[2],commands[3],commands[4])
        } else if( commands[0] === 'sendOSC') {
            if (commands.length > 2) u.sockets.osc.send(commands[1],commands[2],commands[3])
            else u.sockets.osc.send(commands[1])
            u.sockets.ws.send(JSON.stringify({msg:'Message sent over OSC'}))
        }else if( commands[0] === 'stopOSC') {
            u.sockets.osc.remove(commands[1], commands[2])
        }

        // // Robot
        // else if(commands[0] === 'moveMouse') {
        //     u.robot.move(commands[1])
        // }  else if (commands[0] === 'clickMouse') {
        //     u.robot.click()
        // } else if (commands[0] === 'setMouse') {
        //     u.robot.set(commands[1])
        // }
        
        // else if (commands[0] === 'typeKeys') {
        //     u.robot.move(keys)
        // }
    }

	//Received a message from a user socket, now parse it into system
	updateUserData(data={id:'',userData:{}}){ 
		//Send previous data off to storage
        if (this.userData.has(data.id)){

            let u = this.userData.get(data.id);

            for(const prop in data.userData) {
                u.props[prop] = data.userData[prop];
                if(u.updatedPropnames.indexOf(prop) < 0)
                    u.updatedPropnames.push(prop);
            }

            let now = Date.now();
            u.latency = now-u.lastUpdate;
            u.lastUpdate = now;

            this.userSubscriptions.forEach((o,i) => {
                if(o.source === data.id) {
                    o.newData = true;
                }
            });

            this.appSubscriptions.forEach((o,i) => {

                let u = o.users[data.id]
                let s = o.spectators[data.id]
                if(u != null && o.updatedUsers.indexOf(data.id) < 0 && s == null) {
                    o.updatedUsers.push(data.id);
                }
            });

            this.hostSubscriptions.forEach((o,i) => {
                let u = o.users[data.id]
                let s = o.spectators[data.id]

                if(u != null && o.updatedUsers.indexOf(data.id) < 0 && s == null) {
                    o.updatedUsers.push(data.id);
                }
            });

            //o.sockets.ws.send(JSON.stringify(o.props));
            
        }
	}

	streamBetweenUsers(listenerUser,sourceUser,propnames=[]) {

        console.log(listenerUser, sourceUser)
        let idx = undefined;
        let sub = this.userSubscriptions.find((o,i) => {
            if(o.listener === listenerUser && o.source === sourceUser) {
                idx = i;
                o.propnames = propnames;
                return true;
            }
        });
        if(sub === undefined) {
            let source = this.userData.get(sourceUser);
            if(propnames.length === 0) {
                for(const propname in source.props) {
                    propnames.push(propname);
                }
            }
            let u = this.userData.get(listenerUser);
            if(u !== undefined && source !== undefined) {
                this.userSubscriptions.push({
                    listener:listenerUser,
                    source:sourceUser,
                    id:sourceUser+"_"+Math.floor(Math.random()*10000000),
                    propnames:propnames,
                    settings:[],
                    newData:false,
                    lastTransmit:0
                });
                console.log('subscribed to user')
                u.sockets.ws.send(JSON.stringify({msg:'subscribedToUser', sub:this.userSubscriptions[this.userSubscriptions.length-1]}))
                return this.userSubscriptions[this.userSubscriptions.length-1];
            }
            else {
                u.sockets.ws.send(JSON.stringify({msg:'userNotFound', id:sourceUser}));
            }
            
        }
        else { 
            return idx;
        }
	}

    setUserStreamSettings(id='',settings={}) {
        let sub = this.userSubscriptions.find((o) => {
            if(o.id === id) {
                o.settings = settings;
                return true;
            }
        });
        return sub;
    }

	createAppSubscription(appname='',devices=[],propnames=[]) {
        // this.mongoClient.db("brainsatplay").collection('apps').find({ name: appname }).count().then(n => {
        //     if (n > 0){
                this.appSubscriptions.push({
                    appname:appname,
                    devices:devices,
                    id:appname+"_"+Math.floor(Math.random()*10000000),
                    users:{},
                    updatedUsers:[], //users with new data available (clears when read from subcription)
                    newUsers:[], //indicates users that just joined and have received no data yet
                    spectators:{}, //usernames of spectators
                    propnames:propnames,
                    host:'',
                    settings:[],
                    lastTransmit:Date.now()
                });
            // } else {
            //     console.log('error: app not configured.')
            // }
        // });

        return this.appSubscriptions.length - 1;
	}

	getAppSubscriptions(appname='') {
		let g = this.appSubscriptions.filter((o) => {
            if(o.appname === appname) return true;
        })
        if(g.length === 0) return undefined;
		else return g;
	}

    getAppSubscription(id='') {
		let g = this.appSubscriptions.find((o,i) => {
			if(o.id === id) {
				return true;
			}
		});
        return g;
	}

    setAppSettings(id='',settings={}) {
        let g = this.appSubscriptions.find((o,i) => {
			if(o.id === id) {
                o.settings = settings;
				return true;
			}
		});
        return g;
    }

    getSessionData(id='') {
        let sessionData = undefined;
        let s = this.appSubscriptions.find((sub,i) => {
            if(sub.id === id) {
                let updateObj = {
                    msg:'sessionData',
                    appname:sub.appname,
                    devices:sub.devices,
                    id:sub.id,
                    propnames:sub.propnames,
                    users:sub.users,
                    host:sub.host,
                    updatedUsers:sub.updatedUsers,
                    newUsers:sub.newUsers,
                    userData:[],
                    spectators:{}
                };
                
                let allIds = Object.assign({}, sub.users)
                allIds = Object.assign(allIds, sub.spectators)
                Object.keys(allIds).forEach((user,j) => { //get current relevant data for all players in session
                    if(sub.spectators[user] == null){
                        let userObj = {
                            id:user
                        }
                        let listener = this.userData.get(user);
                        if(listener) {
                            sub.propnames.forEach((prop,k) => {
                                userObj[prop] = listener.props[prop];
                            });
                            updateObj.userData.push(userObj);
                        }
                    }
                    else {
                        updateObj.spectators.push(user);
                    }
                });
                sessionData = updateObj;
                return true;
            }
        });
        return sessionData;
    }

	subscribeUserToSession(id,sessionId,spectating=false) {

        let g = this.getAppSubscription(sessionId);
        let u = this.userData.get(id);

		if(g !== undefined && u !== undefined) {

            if (Object.keys(g.users).length === 0 && !spectating){
                g.host = id;
            }

            if( g.users[id] == null && g.spectators[id] == null) { 
                if(spectating === true) g.spectators[id] = u.username
                else {
                    g.users[id] = u.username
                    g.newUsers.push(id);
                    g.updatedUsers.push(id);
                }
            }
			
			g.propnames.forEach((prop,j) => {
                if(!(prop in u.props)) u.props[prop] = '';
            });
            
            u.sessions.push(sessionId);
            
			//Now send to the user which props are expected from their client to the server on successful subscription
			u.sockets.ws.send(JSON.stringify({msg:'subscribedToSession',id:sessionId,sessionInfo:g}));
		}
		else {
			u.sockets.ws.send(JSON.stringify({msg:'sessionNotFound',id:sessionId}));
        }
	}

    createHostSubscription(appname='',devices=[],propnames=[], host='', hostprops=[]) {
        this.hostSubscriptions.push({
            appname:appname,
            devices:devices,
            id:appname+"_"+Math.floor(Math.random()*10000000),
            host:host,
            hostprops:hostprops,
            settings:[],
            users:{},
            updatedUsers:[], //users with new data available (clears when read from subcription)
            newUsers:[], //indicates users that just joined and have received no data yet
            spectators:{}, //usernames of spectators
            propnames:propnames,
            lastTransmit:Date.now()
        });

        return this.hostSubscriptions.length-1;
    }

    getHostSubscriptions(appname='') {
		let g = this.hostSubscriptions.filter((o) => {
            if(o.appname === appname) return true;
        })
        if(g.length === 0) return undefined;
		else return g;
	}

    getHostSubscription(id='') {
		let g = this.hostSubscriptions.find((o,i) => {
			if(o.id === id) {
				return true;
			}
		});
        return g;
	}

    setHostAppSettings(id='',settings={}) {
        let g = this.hostSubscriptions.find((o,i) => {
			if(o.id === id) {
                o.settings = settings;
				return true;
			}
		});
        return g;
    }

    getHostSessionData(id='') {
        let sessionData = undefined;
        let s = this.appSubscriptions.find((sub,i) => {
            if(sub.id === id) {
                let updateObj = {
                    msg:'sessionData',
                    appname:sub.appname,
                    devices:sub.devices,
                    id:sub.id,
                    host:sub.host,
                    hostprops:sub.hostprops,
                    propnames:sub.propnames,
                    users:sub.users,
                    updatedUsers:sub.updatedUsers,
                    newUsers:sub.newUsers,
                    hostData:{},
                    userData:[],
                    spectators:{}
                };
                
                let allIds = Object.assign({}, sub.users)
                allIds = Object.assign(allIds, sub.spectators)
                Object.keys(allIds).forEach((user,j) => { //get current relevant data for all players in game
                    if(sub.spectators[user] == null){
                        let userObj = {
                            id:user
                        }
                        let listener = this.userData.get(user);
                        if(listener) {
                            sub.propnames.forEach((prop,k) => {
                                userObj[prop] = listener.props[prop];
                            });
                            updateObj.userData.push(userObj);
                        }
                    }
                    else {
                        spectators.push(user);
                    }
                });

                let host = this.userData.get(sub.host);
                if(host) {
                    sub.hostprops.forEach((prop,j) => {
                        updateObj.hostData[prop] = host.props[prop];
                    })
                }

                sessionData = updateObj;
                return true;
            }
        });
        return sessionData;
    }

	subscribeUserToHostSession(id,sessionId,spectating=false,hosting=false) {
		let g = this.getHostSubscription(sessionId);
        let u = this.userData.get(id);
		if(g !== undefined && u !== undefined) {
            if( g.users[id] == null && g.spectators[id] == null ) { 
                if(spectating === true) g.spectators[id] = u.username
                else {
                    g.users[id] = u.username
                    g.newUsers.push(id);
                    g.updatedUsers.push(id);
                }
            }

            if(hosting === true) g.host = id;
			
			g.propnames.forEach((prop,j) => {
				if(!(prop in u.props)) u.props[prop] = '';
			});
			//Now send to the user which props are expected from their client to the server on successful subscription
			u.sockets.ws.send(JSON.stringify({msg:'subscribedToSession',id:appname,devices:g.devices,propnames:g.propnames,host:g.host,hostprops:g.hostprops}));
		}
		else {
			u.sockets.ws.send(JSON.stringify({msg:'sessionNotFound',id:appname}));
		}
	}

    updateUserSubscriptions = (time) => {
        this.userSubscriptions.forEach((sub,i) => {
            //Should create a dispatcher that accumulates all user and app subscription data to push all concurrent data in one message per listening user
            if(time - sub.lastTransmit > this.subUpdateInterval){
                let listener = this.userData.get(sub.listener);
                let source = this.userData.get(sub.source);

                if(listener === undefined || source === undefined ) {
                    this.userSubscriptions.splice(i,1);
                }
                else if(sub.newData === true) {
                    let dataToSend = {
                        msg:'userData',
                        id:sub.source,
                        session: sub.id, // TO FIX
                        userData:{}
                    };
                    sub.propnames.forEach((prop,j) => {
                        if(source.updatedPropnames.indexOf(prop) > -1)
                            dataToSend.userData[prop] = source.props[prop];
                    });
                    sub.newData = false;
                    sub.lastTransmit = time;
                    listener.sockets.ws.send(JSON.stringify(dataToSend));
                }
            }
		});
    } 


    removeUserData(id, updateObj){
        // Don't Receive Your Own Data
        let objToFilter = JSON.parse(JSON.stringify(updateObj))
        let idx = objToFilter.userData.findIndex((d) => d.id == id)
        if (idx >= 0) objToFilter.userData.splice(idx,1)
        return objToFilter
    }


    getFullUserData(user,sub) {
        if(sub.spectators[user] == null) {
            let userObj = {
                id:user
            }
            let listener = this.userData.get(user);
            if(listener){ 
                sub.propnames.forEach((prop,k) => {
                    userObj[prop] = listener.props[prop];
                });
                return userObj
            }
        }
    }

    updateAppSubscriptions = (time) => {
        this.appSubscriptions.forEach((sub,i) => {
            if(time - sub.lastTransmit > this.subUpdateInterval){

                //let t = this.userData.get('guest');
                //if(t!== undefined) t.sockets.ws.send(JSON.stringify(sub));

                let updateObj = {
                    msg:'sessionData',
                    appname:sub.appname,
                    devices:sub.devices,
                    id:sub.id,
                    propnames:sub.propnames,
                    users:sub.users,
                    spectators:sub.spectators,
                    updatedUsers:sub.updatedUsers,
                    newUsers:sub.newUsers,
                    userData:[],
                    host: sub.host
                };

                if(sub.newUsers.length > 0) { //If new users, send them all of the relevant props from other users

                    let fullUserData = [];

                    let allIds = Object.assign({}, sub.users)
                    allIds = Object.assign(allIds, sub.spectators)

                    Object.keys(allIds).forEach((user, j) => {
                        let userObj = this.getFullUserData(user, sub)
                        if (userObj != null) fullUserData.push(userObj)
                    });

                    let fullUpdateObj = Object.assign({},updateObj);

                    fullUpdateObj.userData = fullUserData;

                    sub.newUsers.forEach((user, j) => {
                        let u = this.userData.get(user);

                        if(u !== undefined) {
                            let filteredObj = this.removeUserData(user, fullUpdateObj)
                            u.sockets.ws.send(JSON.stringify(filteredObj));
                        }
                        else {
                            delete sub.users[user]
                            delete sub.spectators[user]
                        }
                    });

                }
                
                if(sub.updatedUsers.length > 0) { //only send data if there are updates
                    let userObj;
                    sub.updatedUsers.forEach((user,j) => {
                        if (sub.newUsers.includes(user)){ // Grab full data of new users
                            userObj = this.getFullUserData(user, sub)
                            if (userObj != null) updateObj.userData.push(userObj)
                        } else { // Grab updated data for old users
                            if(sub.spectators[user] == null){
                                let userObj = {
                                    id:user
                                }

                                let listener = this.userData.get(user);
                                if(listener.props.devices) userObj.devices = listener.props.devices;
                                if(listener) {
                                    sub.propnames.forEach((prop,k) => {
                                        if(listener.updatedPropnames.indexOf(prop) > -1)
                                            userObj[prop] = listener.props[prop];
                                    });
                                    updateObj.userData.push(userObj);
                                }
                            }
                        }
                    });

                    let allIds = Object.assign({}, sub.users)
                    allIds = Object.assign(allIds, sub.spectators)

                    Object.keys(allIds).forEach((user,j) => {
                        if(sub.newUsers.indexOf(user) < 0) { //new users will get a different data struct with the full data from other users
                            let u = this.userData.get(user);
                            if(u !== undefined) {
                                let filteredObj = this.removeUserData(user, updateObj)
                                u.sockets.ws.send(JSON.stringify(filteredObj));
                                u.lastUpdate = time; //prevents timing out for long spectator sessions
                            } else {
                                delete sub.users[user]
                                delete sub.spectators[user]
                            }
                        }
                    });

                }
                
                sub.updatedUsers = [];
                sub.newUsers = [];
            }
            sub.lastTransmit = time;
		});
    }

    updateHostAppSubscriptions = (time) => {
        this.hostSubscriptions.forEach((sub,i) => {
            if(time - sub.lastTransmit > this.subUpdateInterval){
                
                //let t = this.userData.get('guest');
                //if(t!== undefined) t.sockets.ws.send(JSON.stringify(sub));

                let updateObj = {
                    msg:'sessionData',
                    appname:sub.appname,
                    devices:sub.devices,
                    id:sub.id,
                    host:sub.host,
                    hostprops:sub.hostprops,
                    propnames:sub.propnames,
                    users:sub.users,
                    spectators:sub.spectators,
                    updatedUsers:sub.updatedUsers,
                    newUsers:sub.newUsers,
                    hostData:{},
                    userData:[],
                };

                
                let hostUpdateObj = Object.assign({},updateObj);

                let host = this.userData.get(sub.host);
                if(host) {
                    sub.hostprops.forEach((prop,j) => {
                        updateObj.hostData[prop] = host.props[prop];
                    });
                }

                if(host) {
                    if(sub.updatedUsers.length > 0) { //only send data if there are updates
                        sub.updatedUsers.forEach((user,j) => {
                            if(sub.spectators[user] == null && sub.newUsers.indexOf(user) < 0){
                                let userObj = {
                                    id:user
                                }
                                let listener = this.userData.get(user);
                                if(listener.props.devices) userObj.devices = listener.props.devices;
                                if(listener) {
                                    sub.propnames.forEach((prop,k) => {
                                        if(listener.updatedPropnames.indexOf(prop) > -1)
                                            userObj[prop] = listener.props[prop];
                                    });
                                    hostUpdateObj.userData.push(userObj);
                                }
                            }
                        });
                    }

                    sub.newUsers.forEach((user,j) => {
                        if(sub.spectators[user] == null){
                            let userObj = {
                                id:user
                            }
                            let listener = this.userData.get(user);
                            if(listener) {
                                sub.propnames.forEach((prop,k) => {
                                    userObj[prop] = listener.props[prop];
                                });
                                hostUpdateObj.userData.push(userObj);
                            }
                        }
                    });
                    let filteredObj = this.removeUserData(u.id, hostUpdateObj)
                    host.sockets.ws.send(JSON.stringify(filteredObj));
                }

                //send latest host data to users
                let allIds = Object.assign({}, sub.users)
                allIds = Object.assign(allIds, sub.spectators)
                Object.keys(allIds).forEach((user,j) => {
                    let u = this.userData.get(user);
                    if(u !== undefined) {
                        let filteredObj = this.removeUserData(u.id, updateObj) 
                        u.sockets.ws.send(JSON.stringify(filteredObj));
                        u.lastUpdate = time; //prevents timing out for long spectator sessions
                    } else {
                        delete sub.users[user]
                        delete sub.spectators[user]

                    }
                });

                sub.updatedUsers = [];
                sub.newUsers = [];
                
            }
            sub.lastTransmit = time;
		});
    }

	subscriptionLoop = () => {
        let time = Date.now();
        //Should have delay interval checks for each subscription update for rate limiting
        this.updateUserSubscriptions(time);

        //optimized to only send updated data
		this.updateAppSubscriptions(time);

        //optimized to only send updated data
		this.updateHostAppSubscriptions(time);

        this.userData.forEach((u,i) => {
            u.updatedPropnames = [];
            if(time - u.lastUpdate > this.serverTimeout) {
                this.userData.sockets.ws.close();
                this.userData.delete(u.id);
            }
        })

		setTimeout(() => {this.subscriptionLoop();},10);
    }

}

module.exports = DataServer