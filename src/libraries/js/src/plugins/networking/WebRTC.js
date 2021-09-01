export class WebRTC{

    static id = String(Math.floor(Math.random()*1000000))
    static hidden = true

    constructor(label, session, params={}) {
        this.label = label
        this.session = session
        

        this.props = {
            channel: null,
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
                        let choice = user.data
                        if (choice){
                            let url = new URL(this.ports.url.data)
                            if (this.props.channel == null){
                                this._createWebRTCConnection(url, () => {
                                    resolve({data: true})
                                })                             
                            }
                
                        } else {
                            this._closeDataChannel()
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
                    if (this.props.channel != null){
                        this.props.channel.send(JSON.stringify(user.data))

                    }
                }
            },
        }
    }

    init = () => {
        this.session.graph.runSafe(this, 'connected', {data: true, forceUpdate: true})
    }

    deinit = () => {
        this._closeDataChannel()
    }

    _closeDataChannel = () => {
        if (this.props.channel) this.props.channel.close()
    }

    _createWebRTCConnection = (url, connectCallback=()=>{}) => {
        const peerConnection = new RTCPeerConnection();
        const dataChannel = peerConnection.createDataChannel();
        
        // Enable textarea and button when opened
        dataChannel.addEventListener('open', event => {
            console.log('WebRTC opened')
            this.props.channel = dataChannel
            this.ports.connected.data = true
            connectCallback()
        });
        
        // Disable input when closed
        dataChannel.addEventListener('close', event => {
            console.log('WebRTC closed')
            this.props.channel = null
            this.ports.connected.data = false
        });

        window.onkeypress = () => {
            const message = 'sent'
            dataChannel.send(message);
        }

        // Append new messages to the box of incoming messages
        dataChannel.addEventListener('message', event => {
            const msg = event.data;
            console.log(msg)
            this.session.graph.runSafe(this,'message', {data: msg, forceUpdate: true})
        });
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