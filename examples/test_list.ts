import galaxyvis from '../src/galaxyVis'

let renderer = 'webgpu'
let galaxyVis = new galaxyvis({
    container: 'container',
    renderer: renderer,
    options: {
        backgroundColor: '#F9FBFF',
    },
})

let k3 = [
    "",
    "1",
    "\ue63a",
    "\ue63a",
]

let imgs = [
    "/public/img/sky.jpg"
]

const testEvent = () => {
    let colors = [
        '#965E04',
        '#C89435',
        '#F7A456',
        '#AFCF8A',
        '#7B39DE',
        '#B095C0',
        '#D24556',
        '#93C2FA',
        '#9DB09E',
        '#F8C821',
    ]
    const drawNum = 100
    let arr = new Array()
    let num = Math.floor(Math.sqrt(drawNum) + 0.5)
    for (let i = 0; i < drawNum; i++) {
        arr[i] = {
            id: `n${i}`,
            attribute: {
                x: (i % num) * 100 - 400,
                y: Math.floor(i / num) * 100 - 400,
                color: colors[Math.floor(Math.random() * colors.length) || 0],
                // text: `n${i}`,
                innerStroke: {
                    width: 2.0,
                    color: colors[Math.floor(Math.random() * colors.length) || 0],
                },
                icon: {
                    content: k3[i%4],
                    font: "iconfont"
                },
                image: {
                    url: i % 4 == 3 ? imgs[0] : "",
                },
            },
        }
    }
    
    galaxyVis.gpu.then(()=>{
        galaxyVis.addGraph({
            nodes: arr,
            // edges: line
        }).then(()=>{
            // galaxyVis.layouts.force({})
        })
    })

    
}

// @ts-ignore
window.galaxyVis = galaxyVis;

testEvent()

export default testEvent
