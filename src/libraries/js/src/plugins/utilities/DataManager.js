export class DataManager{
    
    static id = String(Math.floor(Math.random()*1000000))

    constructor(label, session, params={}) {
        this.label = label
        this.session = session
        

        this.ports = {
            log:{
                input: {type: undefined},
                output: {type: null},
                onUpdate: (user) => {
                    this.session.atlas.makeNote(`${user.meta.label} ${user.data}`)
                }
            },
            get:{
                input: {type: 'boolean'},
                output: {type: Object},
                onUpdate: (user) => {
                    return new Promise((resolve) => {
                        let trigger = user.data
                        if (trigger) {
                            this.session.dataManager.readFromDB(undefined, undefined,undefined, (data) => {
                                resolve(data)
                            })
                        }
                    })
                }
            },
            csv:{
                input: {type: 'boolean'},
                output: {type: null},
                onUpdate:(user) => {
                    let trigger = user.data
                    if (trigger) {
                        this.session.dataManager.save()
                    }
                }
            },
            latest:{
                input: {type: 'boolean'},
                output: {type: Object},
                onUpdate: () => {
                    return new Promise((resolve) => {
            
                    let loaded
                    this.session.dataManager.getFilenames(files => {
                        let filename = files[files.length -1]
                        this.session.dataManager.getFileSize(filename,(size) => {
                        this.session.dataManager.readFromDB(filename, 0,size, (data,file) => {
                            this.session.dataManager.getCSVHeader(filename, (header)=> { 
                            loaded = this.session.dataManager.parseDBData(data,header.split(','),file,true);
                            resolve({data: loaded, meta:{label: `${this.label}_loaded`}})
                        });
                        })
                        })
                    })
                })
                }
            },
        }

        this.props = {}
    }

    init = () => {
        if (this.ports.latest.output.active){
            this.session.graph.runSafe(this,'latest',{data: true})
        }
    }

    deinit = () => {}
}