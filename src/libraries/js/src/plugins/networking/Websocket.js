export class Websocket{

    static id = String(Math.floor(Math.random()*1000000))
    
    constructor(label, session, params={}) {
        this.label = label
        this.session = session
        

        this.props = {
            socket: null,
            connected: false
        }

        this.ports = {
            url: {
                default: this.session.info.auth.url.href,
                input: {type: 'string'},
                output: {type: null},
                onUpdate: (user) => {
                    let valid = this.validURL(user.data)
                    if (valid){
                        this.ports.url.data = user.data
                        this.session.graph.runSafe(this,'connected', {data: true, forceUpdate: true})
                    }
                }
            }, 
            connected: {
                default: false,
                input: {type: 'boolean'},
                output: {type: 'boolean'},
                onUpdate: (user) => {
                    return new Promise(resolve => {
                        let choice = uuser.data
                        if (choice){
                            let url = new URL(this.ports.url.data)
                            if (this.props.socket == null || this.props.socket.url.split('://')[1] != url.href.split('://')[1]){
                                this._createWebsocket(url, () => {
                                    resolve({data: true})
                                })                             
                            }
                
                        } else {
                            this._closeSocket()
                            resolve({data: false})
                        }
                    })
                }
            }, 
            message: {
                input: {type: null},
                output: {type: undefined},
                onUpdate: (user) => {
                    return user
                }
            },
            send: {
                input: {type: undefined},
                output: {type: null},
                onUpdate: (user) => {
                    if (this.props.socket != null){
                        this.props.socket.send(JSON.stringify(user.data))
                    }
                }
            },
        }
    }

    init = () => {
        this.session.graph.runSafe(this, 'connected', {data: true, forceUpdate: true})
    }

    deinit = () => {
        this._closeSocket()
    }

    _closeSocket = () => {
        if (this.props.socket) this.props.socket.close()
    }

    _createWebsocket = (url, connectCallback=()=>{}) => {

        let socket
        if (url.protocol === 'http:') {
            socket = new WebSocket(`ws://` + url.host)
        } else if (url.protocol === 'https:') {
            socket = new WebSocket(`wss://` + url.host)
        } else {
            console.log('invalid protocol')
            return;
        }
        
        socket.onerror = (e) => {console.error(e)}

        socket.onopen = () => {
            console.log('WebSocket opened')
            this.props.socket = socket
            this.ports.connected.data = true
            connectCallback()
        };

        socket.onmessage = (msg) => {
            console.log('Message recieved', msg.data)
            this.session.graph.runSafe(this,'message', {data: msg.data, forceUpdate: true})
        }

        socket.onclose = (msg) => {
            console.log('WebSocket closed')
            this.props.socket = null
            this.ports.connected.data = false
        }
    }

    validURL = (str) => {
        var pattern = new RegExp('^(https?:\\/\\/)?'+ // protocol
          '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|'+ // domain name
          '((\\d{1,3}\\.){3}\\d{1,3}))'+ // OR ip (v4) address
          '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*'+ // port and path
          '(\\?[;&a-z\\d%_.~+=-]*)?'+ // query string
          '(\\#[-a-z\\d_]*)?$','i'); // fragment locator
        return !!pattern.test(str)
      }
}