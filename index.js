let Time = 100 // 毫秒
const SnakeSize = 8 // 蛇的大小，也是运动距离
const Speed = (SnakeSize + 2) / Time // 速度
const Status = {
    'death': 0,
    'health': 1
}
let AudioObj  // 音乐
let FoodPosition = []// 食物位置
let GameOver = false // 游戏是否结束
let Pause = false    // 暂停游戏
let SnakeArray = []  // 蛇
let Fraction = 0

/**
 * 生成随机数，取整
 * @param {number} n 
 */
const renderRandom = (n) => (Math.random() * n) | 0 

/**
 * 生成随机颜色
 */
const generateRandomColor = () => `hsl(${renderRandom(360)}, ${renderRandom(100)}%, ${renderRandom(80) + 20}%)`

/**
 * 睡眠，控制运动时间间隔
 * @param {number} ms 
 */
const sleep = ms => {
    return new Promise((resolve, reject) => {
        setTimeout(resolve, ms)
    })
}

/**
 * 键盘控制器，控制蛇的方向
 */
class pathManager {
    constructor(arrow) {
        this.arrow = arrow
        this.on()
    }
    getArrow() {
        return this.arrow
    }
    handler(fn) {
        this.fn = fn;
    }
    on() {
        document.addEventListener('keyup', e => {
            switch(e.code) {
                case 'ArrowLeft':
                    if (this.arrow !== 'right')
                        this.arrow = 'left';
                    break;
                case 'ArrowRight':
                    if (this.arrow !== 'left')
                        this.arrow = 'right';
                    break;
                case 'ArrowUp':
                    if (this.arrow !== 'bottom')
                        this.arrow = 'top';
                    break;
                case 'ArrowDown':
                    if (this.arrow !== 'top')
                        this.arrow = 'bottom';
                    break;
                case 'Space':
                    Pause = !Pause;
                    this.fn();
                    break
            }
        })
        const list = document.querySelectorAll('.c')
        list.forEach(item => {
            item.addEventListener('touchend', e => {
                this.arrow = e.target.dataset.arrow
            })
        })
    }
}

/**
 * 基本的绘制与擦除画布类
 */
class Canvas {
    constructor(ctx) {
        this.ctx = ctx
    }
    draw([x, y], color) {
        this.ctx.fillStyle = color
        this.ctx.fillRect(x, y, SnakeSize, SnakeSize)
    }
    clear([x, y]) {
        this.ctx.clearRect(x, y, SnakeSize, SnakeSize)
    }
}

let Lightness = 0
/**
 * 蛇的最小单位
 * {
 *   color: '颜色',
 *   status: '状态',
 *   path: '等待移动的位置数组',
 *   leave: '等级'
 * }
 */
class Snake extends Canvas {
    /**
     * @param {CanvasRenderingContext2D} ctx 
     * @param {[number[]]} path 
     */
    constructor(ctx, path, leave) {
        super(ctx)
        this.Lightness = 0
        this.leaveMap = {
            1: 188,
            2: 244,
            3: 302,
            4: 42,
            5: 0
        }
        this.status = Status.health  // 默认健康
        this.path = path             // 需要移动的初始化路径
        this.currentPosition = this.path[0] // 当前位置
        this.leave = leave || 1;              // 等级
        this.color = this.generateColor(this.leaveMap[this.leave]) // 生成默认渐变色
        this.draw(this.currentPosition, this.color)
    }
    move() {
        if (this.status === Status.health) {
            // 健康状态
            this.currentPosition = this.path.shift()
            const [x, y] = this.path[0]
            if (x >= 600 || x < 0 || y >= 300 || y < 0)  {
                this.status = Status.death
                GameOver = true // 结束游戏
                AudioObj.pause()
                mask.innerText = '你"死"了！要么刷新重来，要么就离开吧。'
                mask.classList.add('show')
            } else {
                this.clear(this.currentPosition)        // 擦除蛇当前位置
                this.draw([x, y], this.color)     // 绘制运动过后的位置
            }
        }
    }
    upgrade() {
        this.color = this.generateColor(this.leaveMap[(++this.leave > 5 ? 5 : this.leave)], true)
        leave.innerText = this.leave
    }
    generateColor(h, up) {
        if (!up) {
            Lightness += 2
            this.Lightness = Lightness
        }
        return `hsl(${h}, ${50}%, ${this.Lightness}%)`
    }
    setPath(...path) {
        this.path = this.path.concat(path)
    }
    getPath(n) {
        if (typeof n === 'number') {
            return this.path[n]
        }
        return this.path
    }
}

/**
 * 食物，和蛇都继承基本的绘制能力
 */
class Food extends Canvas {
    /**
     * @param {CanvasRenderingContext2D} ctx 
     * @param {[number]} position 
     */
    constructor(ctx, position) {
        super(ctx)
        this.position = position
        this.color = generateRandomColor() // 随机生成默认颜色
        this.draw(this.position, this.color)
    }
    eaten() {
        this.clear(this.position)
    }
}

/**
 * 生成食物函数
 * @param {CanvasRenderingContext2D} ctx 
 * @returns {Food}
 */
const FoodManager = (ctx) => {
    const position = [renderRandom(60 - 1) * 10, renderRandom(30 - 1) * 10]
    const food = new Food(ctx, position)
    return food
}

/**
 * 生成一条蛇的函数
 * @param {CanvasRenderingContext2D} ctx 
 */
const SnakeManager = async (ctx) => {
    const head = [300, 150] // 蛇头在哪里

    let tp = []
    for (let i = 0; i < 10; i++) {
        const [x, y] = [head[0] - i * (SnakeSize + 2), head[1]] // 蛇初始化的位置
        const snake = new Snake(ctx, [[x, y]])
        snake.setPath(...([].concat(tp).reverse()))             // 拷贝上一条蛇的位置作为这条蛇的下一个位置
        tp.push([x, y])
        SnakeArray.push(snake)
    }
}

/**
 * 和控制器结合，计算蛇的下一步位置
 * @param {pathManager} gesture 
 * @param {[x, y]} position 
 * @param {string} type 
 */
const calcPosition = (gesture, position, type) => {
    const copyPosition = [].concat(position)
    const temp = (SnakeSize + 2)
    let negate = 1
    if (type === 'new') {
        negate = -1
    }
    switch(gesture.getArrow()) {
        case 'left':
            copyPosition[0] = copyPosition[0] - temp * negate; break;
        case 'right':
            copyPosition[0] = copyPosition[0] + temp * negate; break;
        case 'top':
            copyPosition[1] = copyPosition[1] - temp * negate; break;
        case 'bottom':
            copyPosition[1] = copyPosition[1] + temp * negate; break;
    }
    return copyPosition
}

const snakeMotion = async (ctx, gesture) => {
    await sleep(Time)
    let upgrade = false
    for (var i = 0; i < SnakeArray.length; i++) {
        const snake = SnakeArray[i]
        if (GameOver || Pause) return // 防止最后一次绘制
        let position = snake.getPath()
        if (i === 0) {
            const [x, y] = FoodPosition   // 食物
            const [[x1, y1]] = position    // 蛇
            if (x1 === x && y1 === y) {
                // 检测蛇是否吃到了食物
                upgrade = true
                fraction.innerText = ++Fraction
                const lastSnake = SnakeArray[SnakeArray.length - 1]
                let lastSnakePosition = lastSnake.getPath(0)    // 当前位置
                lastSnakePosition = calcPosition(gesture, lastSnakePosition, 'new')
                const newSnake = new Snake(ctx, [lastSnakePosition], snake.leave)
                newSnake.setPath(...lastSnake.getPath())
                SnakeArray.push(newSnake)
                FoodPosition = FoodManager(ctx).position
            }
        }
        if (SnakeArray.length % 4 === 0 && upgrade) {
            SnakeArray.forEach(item => item.upgrade())
            upgrade = false
        }
        let lastPosition = [].concat(position[position.length - 1]) // 蛇的运动路径 最后一个未执行的运动点 (拷贝一个)
        lastPosition = calcPosition(gesture, lastPosition)
        snake.setPath(lastPosition)
        snake.move()
    }
}
/**
 * 开始游戏函数
 * @param {CanvasRenderingContext2D} ctx 
 * @param {pathManager} gesture 
 */
const startGame = async (ctx, gesture) => {
    while(!GameOver && !Pause) {
        await snakeMotion(ctx, gesture)
    }
}

/**
 * 初始化函数
 */
const init = () => {
    btn.addEventListener('click', e => {
        try {
            btn.disabled = true
            const canvas = document.getElementById('canvas')
            const ctx = canvas.getContext('2d')
            canvas.addEventListener('touchmove', e => {
                e.preventDefault()
            })
            FoodPosition = FoodManager(ctx).position
            SnakeManager(ctx)
            AudioObj = mediaManager() // 音乐控制器
            const gesture = new pathManager('right')
            gesture.handler(() => {
                if (!Pause) {
                    startGame(ctx, gesture)
                    AudioObj.play()
                    mask.classList.remove('show')
                } else {
                    AudioObj.pause()
                    mask.classList.add('show')
                }
            })
            startGame(ctx, gesture)
        } catch (e) {
            alert(e)
        }
    })
}

const mediaManager = () => {
    var ctx = new (window.AudioContext || window.webkitAudioContext)()
          , url = 'https://linkorg.club/www/music.mp3'  
          , AudioObj = new Audio(url)
          , processor = ctx.createScriptProcessor(2048, 1, 1)
          , source;
          
    AudioObj.crossOrigin = 'anonymous'
    
    AudioObj.addEventListener('canplaythrough', function(){
        source = ctx.createMediaElementSource(AudioObj)
        source.connect(processor)
        source.connect(ctx.destination)
        processor.connect(ctx.destination)
    }, false)
    AudioObj.play()
    processor.onaudioprocess = function(evt){
        var input = evt.inputBuffer.getChannelData(0)
        , len = input.length   
        , total = i = 0
        , rms
        while ( i < len ) total += Math.abs( input[i++] )
        rms = Math.sqrt( total / len )
        const decibel = ((rms * 100) | 0)
        if (decibel > 20) 
            Time = ((80 - decibel) * 100 / 30) | 0
            speed.innerText = Time
    }
    return AudioObj
}

document.addEventListener('DOMContentLoaded', init)

function isPC(){  
    var userAgentInfo = navigator.userAgent;
    var Agents = new Array("Android", "iPhone", "SymbianOS", "Windows Phone", "iPad", "iPod");  
    var flag = true;  
    for (var v = 0; v < Agents.length; v++) {  
        if (userAgentInfo.indexOf(Agents[v]) > 0) { flag = false; break; }  
    }  
    return flag;  
}
if (isPC()) {
    document.querySelector('.mobile-control').style.display = 'none'
}