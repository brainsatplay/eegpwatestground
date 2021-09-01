class UI{

    static id = String(Math.floor(Math.random()*1000000))

    constructor(label, session, params={}) {

        // Generic Plugin Attributes
        this.label = label
        this.session = session

        // UI Identifier
        this.props = {
            id: String(Math.floor(Math.random()*1000000)),
            snake: [],
            dx: 0,
            dy: 0,
            speed: 10,
            size: 10
        }

        // Port Definition
        this.ports = {
            up: {
                output: {type: null},
                onUpdate: (user) => {
                    if (user.data === true){
                        this.props.dy = -this.props.speed
                        this.props.dx = 0
                    }
                    return user
                }
            },
            down: {
                output: {type: null},
                onUpdate: (user) => {
                    if (user.data === true){
                        this.props.dy = this.props.speed
                        this.props.dx = 0
                    }
                    return user
                }
            },
            left: {
                output: {type: null},
                onUpdate: (user) => {
                    if (user.data === true){
                        this.props.dx = -this.props.speed
                        this.props.dy = 0
                    }
                return user
            }
            },
            right: {
                output: {type: null},
                onUpdate: (user) => {
                    if (user.data === true){
                        this.props.dx = this.props.speed
                        this.props.dy = 0
                    }
                    return user
                }
            }
        }
    
    }

    init = () => {

        let HTMLtemplate = () => {
            return `
            <div id='${this.props.id}' style='display: flex; align-items: center; justify-content: center; width: 100%; height: 100%;'>
                <canvas id="${this.props.id}gameCanvas" style="border: 1px solid white;" ></canvas>
            </div>`
        }


        let setupHTML = (app) => {

const container = document.getElementById(`${this.props.id}`);
const canvas = document.getElementById(`${this.props.id}gameCanvas`);
const context = canvas.getContext("2d");

let squareLength = Math.min(container.offsetHeight*.8, container.offsetWidth*.8)
canvas.width = squareLength
canvas.height = squareLength


let getPosition = () => {return {x: Math.floor((canvas.width-this.props.size)*Math.random()/this.props.speed)*this.props.speed, y:Math.floor((canvas.height-this.props.size)*Math.random() /this.props.speed)*this.props.speed}}
this.props.snake = [getPosition()]
let initialGoal = getPosition()
let currentGoal = initialGoal;

const drawSnake = (segment) => {
    context.fillStyle = 'lightblue'
    context.strokeStyle = 'darkblue'
    context.fillRect(segment.x, segment.y, this.props.size,this.props.size)
    context.strokeRect(segment.x, segment.y, this.props.size,this.props.size)
}

const clearCanas = () => {
    context.fillStyle = 'black';
    context.stokeStyle =  'white';
    context.fillRect(0,0, canvas.width,canvas.height)
    context.strokeRect(0,0, canvas.width,canvas.height)
}

const drawSnack = (pos) => {
    context.fillStyle = 'red'
    context.strokeStyle = 'darkred'
    context.fillRect(pos.x, pos.y, this.props.size,this.props.size)
    context.strokeRect(pos.x, pos.y, this.props.size,this.props.size) 
}

const moveSnake = () => {
    let head = {
        x: this.props.snake[0].x + this.props.dx, 
        y: this.props.snake[0].y + this.props.dy
    }
    this.props.snake.unshift(head);
    this.props.snake.pop()
}

            const main =  () => {
           
                clearCanas()
                drawSnack({x: currentGoal.x,y:currentGoal.y})
                this.props.snake.forEach(drawSnake);
                moveSnake()
                if(this.props.snake[0].x == currentGoal.x && this.props.snake[0].y == currentGoal.y){
                    this.props.snake.push({
                        x: currentGoal.x,
                        y: currentGoal.y
                    })
                    currentGoal = getPosition()
                    clearCanas()
                    drawSnack({x: currentGoal.x,y:currentGoal.y})
                    this.props.snake.forEach(drawSnake);
                    moveSnake()
                }

                // Correct Snake Position
                if(this.props.snake[0].x >= canvas.width) this.props.snake[0].x = 0;
                if(this.props.snake[0].x < 0)this.props.snake[0].x = canvas.width;
                if(this.props.snake[0].y >= canvas.height)this.props.snake[0].y = 0;
                if(this.props.snake[0].y < 0) this.props.snake[0].y = canvas.height;
                
                // Correct Snack Position
                if(currentGoal.x >= canvas.width) currentGoal.x = 0;
                if(currentGoal.x < 0) currentGoal.x = canvas.width;
                if(currentGoal.y >= canvas.height) currentGoal.y = 0;
                if(currentGoal.y < 0) currentGoal.y = canvas.height;
                                
                setTimeout(() => {main()},500)
            }

            main()
        }

        return {HTMLtemplate, setupHTML}
    }

    responsive = () => {
        const container = document.getElementById(`${this.props.id}`);
        const canvas = document.getElementById(`${this.props.id}gameCanvas`);
        let squareLength = Math.min(container.offsetHeight*.8, container.offsetWidth*.8)
        canvas.width = squareLength
        canvas.height = squareLength
    }

    deinit = () => {
        
    }
}

export {UI}