import * as THREE from 'three'

class Trees{

    static id = String(Math.floor(Math.random()*1000000))

    constructor(label, session, params={}) {

        // Generic Plugin Attributes
        this.label = label
        this.session = session


        // UI Identifier
        this.props = {
            id: String(Math.floor(Math.random()*1000000)),
            meshes: [],
            maxSize: .1,
            segments: 8,
            spheres: [],
            scale: .1,
            groups: []
        }

        // Port Definition
        this.ports = {
            add: {
                edit: false,
                input: {type: null},
                output: {type: Object, name: 'Mesh'},
                onUpdate: () => {
                    console.log('ADDING TREE')
                    return {data: this.props.groups}
                }
            },
            count: {
                data: 1,
                input: {type: 'number'},
                output: {type: null},
                onUpdate: (user) => {
                    this.ports.count.data = user.data
                }
            },
        }
    }

    init = () => {
        // const hemisphereLight = new THREE.HemisphereLight(0xff0000, 0x0000ff, 0.8)
        // this.props.meshes.add(hemisphereLight)
        function brand(){
            return 2 * (Math.random() - 0.5)
        }
        //growth parameters
        var stages = [
            {
                name: 'trunk',
                sizeDistribution:[0.9,1.3],
                minHeight: 0,
                maxHeight: 11,
                minRadius: 0,
                maxRadius: .8,
                count: 10
            },
            {
                name: 'stageA',
                sizeDistribution:[0.4,0.8],
                minHeight: 10,
                maxHeight: 15,
                minRadius: 0,
                maxRadius: 8,
                count: 400,
            },
            {
                name: 'stageB',
                sizeDistribution:[0.3,0.7],
                minHeight: 12,
                maxHeight: 20,
                minRadius: 0,
                maxRadius: 9,
                count: 600,
            },
            {
                name: 'stageC',
                sizeDistribution:[0.1,0.4],
                minHeight: 13,
                maxHeight: 20,
                minRadius: 0,
                maxRadius: 10,
                count: 1500
            }
        ]


        const map_range = (value, low1, high1, low2, high2)  => {
            return low2 + (high2 - low2) * (value - low1) / (high1 - low1);
        }

        for (let n = 0; n < this.ports.count.data; n++){

            const initialSphereGeometry = new THREE.SphereGeometry(this.props.maxSize,this.props.segments,this.props.segments)
            const woodMaterial = new THREE.MeshToonMaterial({color: 0xBF784E})
            const initialSphere = new THREE.Mesh(initialSphereGeometry,woodMaterial)

            let group = new THREE.Group()
            group.add(initialSphere)

            var funMaterials = []
            for(var i =0; i < 1000; i++){
                funMaterials.push(new THREE.MeshToonMaterial({color: Math.random() * 0xFFFFFF}))
            }

            const addASphere = ( sizeDistribution, minHeight, maxHeight,minRadius, maxRadius) => {
                var y = map_range(Math.random(),0,1,minHeight,maxHeight)
                let nInitPos = new THREE.Vector3(brand()*maxRadius,y,brand()*maxRadius)
                let nScale = map_range(Math.random(),0,1,sizeDistribution[0],sizeDistribution[1])
                
                //get nearest sphere
                let nearestSphere = group.children[0]

                if (nearestSphere){
                    for(var i = 0; i < group.children.length; i++){
                        if( nInitPos.distanceTo(group.children[i].position)< nInitPos.distanceTo(nearestSphere.position) ){
                            nearestSphere = group.children[i]
                        }
                    }
                    // let nPos = nInitPos.sub(nearestSphere.position).normalize().multiplyScalar(nScale + nearestSphere.scale.x)
                    let nPos = nInitPos.sub(nearestSphere.position).normalize().multiplyScalar(this.props.maxSize *nScale + this.props.maxSize * nearestSphere.scale.x)
                    let funMaterial = funMaterials[Math.floor(Math.random() * funMaterials.length)]
                    let nSphere = new THREE.Mesh(initialSphereGeometry,funMaterial)
                    // let nSphere = new THREE.Mesh(initialSphereGeometry,woodMaterial)
                    nSphere.scale.set(nScale,nScale,nScale)
                    let temp = new THREE.Vector3().copy(nearestSphere.position)
                    temp.add(nPos)
                    nSphere.position.add(temp)
                    group.add(nSphere)
                    // nSphere.lookAt(nearestSphere)
                    group.add(nSphere)
                }
            }
            var growing = true
            var trees = 0
            var sphereCounter = 0;
            var stage = 0;
            while(growing){
                if(growing){
                    if(stage < stages.length) {
                        for( var i = 0; i < 30; i++){
                            addASphere(stages[stage].sizeDistribution,stages[stage].minHeight
                                ,stages[stage].maxHeight,stages[stage].minRadius,stages[stage].maxRadius)
                            sphereCounter++
                        }
                        if(sphereCounter > stages[stage].count){
                            sphereCounter = 0
                            stage++
                        }
                    } else {
                        growing = false;
                    }
                    
                } else{
                    for(var i = 0; i <= 30; i++){
                        group.children.pop()
                    }
                
                    if(group.children.length < 10){
                        growing = true
                        group = new THREE.Group()
                        group.add(initialSphere)
                        sphereCounter = 0
                        stage = 0
                        trees++
                    }
                }
            }

            let variance = 5
            group.position.set(-5 + variance*Math.random(),group.position.y,-5 + variance*Math.random())
            group.scale.set(0.5,0.5,0.5)
            this.props.groups.push(group)
        }

        this.ports.add.data = this.props.groups
        this.session.graph.runSafe(this,'add',{forceRun: true, forceUpdate: true})
    }

    deinit = () => {}
}

export {Trees}